<template>
  <div class="game-container">
    <div v-if="room.status.value === 'no-supabase'" class="notice">
      <div class="notice-icon">&#x1F50C;</div>
      <h3>联机功能未开启</h3>
      <p>本项目用 Supabase Realtime 做双人实时对战。在 <code>.env</code> 配置
        <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_ANON_KEY</code>（参考 <code>.env.example</code>）后重启即可联机。</p>
    </div>
    <template v-else>
      <div class="room-bar">
        <span class="room-label">房间号</span>
        <span class="room-code">{{ roomCode }}</span>
        <button class="copy-btn" @click="copyRoom">{{ copied ? '已复制 ✓' : '复制邀请链接' }}</button>
      </div>
      <!-- 状态 banners（优先级：error > reconnecting > 观战(含玩家离开) > opponentLeft > connecting > waiting）-->
      <div v-if="room.status.value === 'error'" class="banner banner-warn">连接异常，请刷新重试</div>
      <div v-else-if="room.status.value === 'reconnecting'" class="banner banner-warn">网络不稳定，正在重新连接…</div>
      <div v-else-if="amSpectator && lockedPresentCount < 2" class="banner banner-warn">有玩家已离开，对局中断</div>
      <div v-else-if="amSpectator" class="banner">观战中 · 双方走子实时同步，点击棋盘无效</div>
      <div v-else-if="opponentLeft" class="banner banner-warn">对手已离开，可点"重新开始"重置或刷新重新匹配</div>
      <div v-else-if="room.status.value === 'connecting'" class="banner">连接中…</div>
      <div v-else-if="!opponentPresent" class="banner banner-wait">等待对手加入…</div>
      <div class="turn-indicator">
        <span class="turn-dot"></span>{{ turnLabel }}
      </div>
      <!-- 黑方玩家视角翻转；观战者默认红方视角，可用「切换视角」按钮翻转 -->
      <XiangqiBoard :board="board" :selected="selected" :legalTargets="legalTargets" :interactive="myTurn" :lastMove="lastMove" :check-side="checkSide" :flipped="amSpectator ? spectFlipped : myRole === 'black'" @tap="handleTap" />
      <div class="score-row">
        <div class="score-box"><span class="score-label">{{ amSpectator ? '身份' : '我方' }}</span><span class="score-value">{{ myLabel }}</span></div>
      </div>
      <!-- 联机控制按钮：仅玩家可用；观战者只提供视角切换 -->
      <div v-if="!amSpectator" class="online-controls">
        <button class="ctrl-btn" @click="offerDraw" :disabled="!opponentPresent || result !== null">求和</button>
        <button class="ctrl-btn" @click="surrender" :disabled="!opponentPresent || result !== null">认输</button>
        <button class="reset-btn" @click="resetConfirm = true">重新开始</button>
      </div>
      <div v-else class="online-controls">
        <button class="ctrl-btn" @click="spectFlipped = !spectFlipped">切换视角：{{ spectFlipped ? '黑方' : '红方' }}在下</button>
      </div>
    </template>
  </div>
  <!-- 求和确认弹窗：对齐认输弹窗（GameDialog 固定居中遮罩），不再用文档流内卡片 -->
  <GameDialog v-model:visible="drawOfferConfirm" accentColor="#FF9E00" icon="info" title="对手求和" message="对手提出求和，是否接受？">
    <template #action>
      <button class="dialog-btn" @click="acceptDraw">接受</button>
      <button class="dialog-btn dialog-btn-ghost" @click="declineDraw">拒绝</button>
    </template>
  </GameDialog>
  <!-- 重新开始二次确认：防误触，确认后才执行重置并广播 -->
  <GameDialog v-model:visible="resetConfirm" accentColor="#FF9E00" icon="info" title="重新开始" message="确定要重新开始吗？当前对局将被重置">
    <template #action>
      <button class="dialog-btn" @click="confirmRestart">确认重置</button>
      <button class="dialog-btn dialog-btn-ghost" @click="resetConfirm = false">取消</button>
    </template>
  </GameDialog>
  <GameDialog v-model:visible="gameOverDialog" accentColor="#FF9E00" :icon="resultIcon" :title="resultTitle" :message="resultMessage">
    <template #action>
      <!-- 观战者不能发起「再来一局」（reset 会广播给双方玩家） -->
      <button v-if="amSpectator" class="dialog-btn dialog-btn-ghost" @click="gameOverDialog = false">返回棋盘</button>
      <button v-else class="dialog-btn" @click="resetBoard(true)">再来一局</button>
    </template>
  </GameDialog>
  <!-- 认输对话框 -->
  <GameDialog v-model:visible="surrenderDialog" accentColor="#FF9E00" icon="fail" title="对手认输" message="对手选择认输，你赢了！">
    <template #action><button class="dialog-btn" @click="resetBoard(true)">再来一局</button></template>
  </GameDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useRealtimeRoom } from '@/composables/useRealtimeRoom'
import GameDialog from '@/components/GameDialog.vue'
import XiangqiBoard from '@/components/XiangqiBoard.vue'
import { copyText } from '@/lib/clipboard'
import { useToast } from '@/composables/useToast'
import { useAchievements } from '@/stores/achievements'
import type { Board, Position, Move, Side } from '@/engine/xiangqi/types'
import { initialBoard, generateMoves, applyMove, isInCheck, getGameStatus, isLegalMove, classifyMove, isPinned } from '@/engine/xiangqi/rules'

const router = useRouter()
const route = useRoute()
const sound = useSound()
const haptics = useHaptics()
const toast = useToast()
  const achievements = useAchievements()

  const board = ref<Board>(initialBoard())
const currentTurn = ref<Side>('red')
const lastMove = ref<Move | null>(null)
const gameOverDialog = ref(false)
const surrenderDialog = ref(false)
const drawOfferConfirm = ref(false)
const resetConfirm = ref(false)
const surrenderByMe = ref(false)
const result = ref<'win' | 'lose' | 'draw' | null>(null)
const roomCode = ref(typeof route.query.room === 'string' ? route.query.room : genCode())
const copied = ref(false)

const room = useRealtimeRoom(roomCode.value, { game: 'xiangqi' })

const myRole = ref<Side | null>(null)
const opponentId = ref<string | null>(null)
const lockedPlayers = ref<string[]>([])

const selected = ref<Position | null>(null)
const legalTargets = ref<Position[]>([])

// 观战状态：视角切换（复用 flipped）+ 观战端终局结果 + 入场提示只弹一次
const spectFlipped = ref(false)
const spectResult = ref<'red-win' | 'black-win' | 'draw' | null>(null)
let spectToastShown = false

const amSpectator = computed(() => lockedPlayers.value.length >= 2 && !lockedPlayers.value.includes(room.myId))
// 锁定的两名玩家中仍在线的人数：观战端据此提示「有玩家已离开」
const lockedPresentCount = computed(() => lockedPlayers.value.filter(id => room.peerIds.value.includes(id)).length)
const opponentPresent = computed(() => !!opponentId.value && room.peerIds.value.includes(opponentId.value))
const opponentLeft = computed(() => !opponentPresent.value && boardHasMoves())
const myTurn = computed(() => myRole.value !== null && result.value === null && currentTurn.value === myRole.value && opponentPresent.value)

const myLabel = computed(() => {
  if (!myRole.value) return '观战'
  return myRole.value === 'red' ? '红方' : '黑方'
})

const turnLabel = computed(() => {
  if (amSpectator.value) {
    if (spectResult.value) return '对局已结束'
    return `观战中 · ${currentTurn.value === 'red' ? '红方' : '黑方'}走子`
  }
  if (room.status.value !== 'connected') return '连接中…'
  if (!opponentPresent.value) return '等待对手加入…'
  if (result.value === 'win') return '你赢了！'
  if (result.value === 'lose') return '你输了'
  if (result.value) return '和棋'
  return currentTurn.value === myRole.value ? '你的回合' : '对手回合'
})

const checkSide = computed(() => {
  if (result.value !== null) return null
  if (isInCheck(board.value, currentTurn.value)) return currentTurn.value
  return null
})

const resultTitle = computed(() => {
  if (surrenderByMe.value) return '你认输'
  if (amSpectator.value) return '对局结束'
  if (result.value === 'win') return '恭喜你获胜'
  if (result.value === 'lose') return '再接再厉'
  return '势均力敌'
})

const resultMessage = computed(() => {
  if (amSpectator.value) {
    if (spectResult.value === 'red-win') return '红方获胜'
    if (spectResult.value === 'black-win') return '黑方获胜'
    return '双方言和'
  }
  if (surrenderByMe.value) return '你选择认输，对手获胜'
  if (result.value === 'draw') return '双方握手言和'
  return result.value === 'win' ? '你成功将死了对手' : '对手技高一筹'
})

const resultIcon = computed<'success' | 'fail' | 'info'>(() => {
  if (amSpectator.value) return 'info'
  if (surrenderByMe.value) return 'fail'
  if (result.value === 'win') return 'success'
  if (result.value === 'lose') return 'fail'
  return 'info'
})

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function copyRoom() {
  const url = `${window.location.origin}${window.location.pathname}#/xiangqi?room=${roomCode.value}`
  copyText(url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function boardHasMoves(): boolean {
  const init = initialBoard()
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      if (board.value[r][c] && (board.value[r][c]?.type !== init[r][c]?.type || board.value[r][c]?.side !== init[r][c]?.side)) {
        return true
      }
    }
  }
  return false
}

// 角色分配 + 断线恢复
let peerCountPrev = 0
room.onPresenceSync((ids: string[]) => {
  const present = ids.slice().sort()
  if (lockedPlayers.value.length === 2) {
    const here = lockedPlayers.value.filter(id => present.includes(id))
    if (here.length === 0) lockedPlayers.value = []
  }
  if (lockedPlayers.value.length === 0 && present.length >= 2) {
    lockedPlayers.value = present.slice(0, 2)
  }
  const i_am = lockedPlayers.value.includes(room.myId)
  myRole.value = i_am ? (lockedPlayers.value[0] === room.myId ? 'red' : 'black') : null
  opponentId.value = i_am ? (lockedPlayers.value.find(id => id !== room.myId) ?? null) : null
  // 满员分流：第三人不再被硬拒绝，而是以观战者身份进入（myRole 保持 null → 棋盘只读）
  const i_am_spectator = lockedPlayers.value.length >= 2 && !i_am
  if (i_am_spectator && !spectToastShown) {
    spectToastShown = true
    toast.show('房间已满，已为你开启观战模式', '👀')
    // 观战者拉取当前局面：复用 sync-req/state 协议（空开局无人应答也正确）
    if (!boardHasMoves()) setTimeout(() => room.send('sync-req', {}), 300)
  } else if (!i_am_spectator) {
    spectToastShown = false
  }
  // 中途加入 / 重连且本地无棋局 → 向对手请求权威状态
  if (peerCountPrev < 2 && present.length >= 2 && !boardHasMoves() && i_am) {
    setTimeout(() => room.send('sync-req', {}), 300)
  }
  peerCountPrev = present.length
})

room.on('move', (data: any, from?: string) => {
  if (!from || !data || !data.from || !data.to) return
  if (amSpectator.value) {
    // 观战：接受双方走子只读同步（合法性校验兜底乱序/重复消息）
    if (!isLegalMove(board.value, data.from, data.to)) return
    const move: Move = { from: data.from, to: data.to, captured: board.value[data.to.row][data.to.col] || undefined }
    board.value = applyMove(board.value, move)
    lastMove.value = move
    currentTurn.value = currentTurn.value === 'red' ? 'black' : 'red'
    sound.select()
    checkGame()
    return
  }
  if (from !== opponentId.value) return
  // 回合守卫：只接受轮到对手走的那一步，拒绝乱序/重复的走子消息，
  // 避免回合被异常翻转（对手连走两步 / 我方回合被吞）
  const movingSide: Side = currentTurn.value
  if (!myRole.value || movingSide === myRole.value) return
  if (!isLegalMove(board.value, data.from, data.to)) return
  const move: Move = { from: data.from, to: data.to, captured: board.value[data.to.row][data.to.col] || undefined }
  board.value = applyMove(board.value, move)
  lastMove.value = move
  currentTurn.value = currentTurn.value === 'red' ? 'black' : 'red'
  // 收到对方走子后清除本地选中态，避免落点提示残留
  clearSelection()
  sound.select()
  haptics.tap()
  checkGame()
})

room.on('reset', (_data: any, from?: string) => {
  if (from && opponentId.value && from !== opponentId.value) return
  resetBoard(false)
})

// 断线恢复：sync-req / state 协议
room.on('sync-req', () => {
  if (!boardHasMoves()) return
  room.send('state', authorizedState())
})
room.on('state', (s: any) => applyRemoteState(s))

function authorizedState() {
  return {
    board: board.value.map(row => row.map(cell => cell ? { ...cell } : null)),
    turn: currentTurn.value,
    gameOver: result.value !== null,
    winner: currentWinner(),
  }
}

// 终局时的胜方（供 state 协议同步给观战者）
function currentWinner(): 'red' | 'black' | 'draw' | null {
  if (result.value === null || !myRole.value) return null
  if (result.value === 'draw') return 'draw'
  const opp: Side = myRole.value === 'red' ? 'black' : 'red'
  return result.value === 'win' ? myRole.value : opp
}

function applyRemoteState(s: any) {
  if (!s || !Array.isArray(s.board) || s.board.length !== 10) return
  board.value = s.board
  currentTurn.value = s.turn === 'black' ? 'black' : 'red'
  if (s.gameOver) {
    if (amSpectator.value) {
      // 观战者：展示终局状态（winner 为协议扩展字段，缺失时退化为言和文案）
      spectResult.value = s.winner === 'red' ? 'red-win' : s.winner === 'black' ? 'black-win' : 'draw'
      gameOverDialog.value = true
    } else if (result.value === null && myRole.value) {
      const status = getGameStatus(board.value, myRole.value)
      if (status === 'checkmate') {
        result.value = 'lose'
      } else {
        result.value = 'draw'
      }
      gameOverDialog.value = true
    }
  } else {
    spectResult.value = null
    result.value = null
    gameOverDialog.value = false
  }
}

// 认输协议
function surrender() {
  if (!opponentPresent.value || result.value !== null) return
  room.send('surrender', {})
  surrenderByMe.value = true
  result.value = 'lose'
  sound.miss()
  haptics.error()
  gameOverDialog.value = true
}

room.on('surrender', (_data: any, from?: string) => {
  if (amSpectator.value) {
    // lockedPlayers[0] = 红方；据认输者 id 判定胜方，展示终局
    spectResult.value = lockedPlayers.value[0] === from ? 'black-win' : 'red-win'
    gameOverDialog.value = true
    return
  }
  surrenderDialog.value = true
})

// 求和协议
function offerDraw() {
  if (!opponentPresent.value || result.value !== null) return
  room.send('draw-offer', {})
}

room.on('draw-offer', () => {
  // 观战者不参与求和交互
  if (amSpectator.value) return
  drawOfferConfirm.value = true
})

function acceptDraw() {
  drawOfferConfirm.value = false
  room.send('draw-accept', {})
  result.value = 'draw'
  sound.win()
  haptics.success()
  gameOverDialog.value = true
}

function declineDraw() {
  drawOfferConfirm.value = false
  room.send('draw-decline', {})
}

// 重新开始二次确认：确认后才执行重置（重置的双端同步逻辑不变）
function confirmRestart() {
  resetConfirm.value = false
  resetBoard(true)
}

room.on('draw-accept', () => {
  if (amSpectator.value) {
    spectResult.value = 'draw'
    gameOverDialog.value = true
    return
  }
  result.value = 'draw'
  sound.win()
  haptics.success()
  gameOverDialog.value = true
})

room.on('draw-decline', () => {
  if (amSpectator.value) return
  toast.show('对手拒绝求和', 'ℹ️')
})

// 送将提示节流：2 秒内不重复弹，避免连点刷屏
let lastExposeTipAt = 0
function showExposeTip(message: string) {
  const now = Date.now()
  if (now - lastExposeTipAt < 2000) return
  lastExposeTipAt = now
  toast.show(message, '⚠️')
  haptics.light()
}

// 将军提示节流：独立计时，2 秒内不重复弹，避免与送将提示互相压制
let lastCheckAlertAt = 0
function showCheckAlert() {
  const now = Date.now()
  if (now - lastCheckAlertAt < 2000) return
  lastCheckAlertAt = now
  // 统一走 useToast（GameToast）游戏内主题化反馈，不弹原生警告框
  toast.show('将军！', '⚔️')
  sound.hit()
  haptics.pulse()
}

function handleTap(pos: Position) {
  if (!myTurn.value || !opponentPresent.value) return
  const piece = board.value[pos.row][pos.col]

  // 已选棋子，点击落点
  if (selected.value) {
    const target = legalTargets.value.find(t => t.row === pos.row && t.col === pos.col)
    if (target) {
      executeMove(selected.value, target)
      return
    }
    // 点击其他己方棋子，切换选择
    if (piece && piece.side === currentTurn.value) {
      selectPiece(pos)
      return
    }
    // 送将拦截反馈：符合走子规则但走后会送将，明确告知玩家原因（保持选中便于另选落点）
    if (classifyMove(board.value, selected.value, pos) === 'exposes-general') {
      showExposeTip('不能送将：这样走会让自己的将/帅被将军')
      return
    }
    // 点击已选棋子或其他位置，取消选择
    clearSelection()
    return
  }

  // 未选棋子，选择己方棋子
  if (piece && piece.side === currentTurn.value) {
    selectPiece(pos)
  }
}

function selectPiece(pos: Position) {
  selected.value = pos
  legalTargets.value = generateMoves(board.value, currentTurn.value)
    .filter(m => m.from.row === pos.row && m.from.col === pos.col)
    .map(m => m.to)
  // 被钉死的棋子无任何合法落点，提示玩家原因，避免误以为棋子锁死/bug
  if (legalTargets.value.length === 0 && isPinned(board.value, pos)) {
    showExposeTip('该棋子被钉死：任何移动都会让将/帅被将军')
  }
  sound.select()
  haptics.tap()
}

function clearSelection() {
  selected.value = null
  legalTargets.value = []
}

function executeMove(from: Position, to: Position) {
  const move: Move = { from, to, captured: board.value[to.row][to.col] || undefined }
  board.value = applyMove(board.value, move)
  lastMove.value = move
  currentTurn.value = currentTurn.value === 'red' ? 'black' : 'red'
  // 走子后立即清除选中态与合法落点提示（修复：走子后提示点残留）
  clearSelection()
  room.send('move', { from, to })
  if (move.captured) {
    sound.hit()
    haptics.pulse()
  } else {
    sound.select()
    haptics.tap()
  }
  checkGame()
}

function checkGame() {
  const status = getGameStatus(board.value, currentTurn.value)
  const inCheck = isInCheck(board.value, currentTurn.value)
  if (inCheck && status !== 'checkmate' && status !== 'stalemate') {
    showCheckAlert()
  }
  if (status === 'checkmate') {
    if (amSpectator.value) {
      // 观战端：被将死的是当前行棋方，胜方为其对手
      spectResult.value = currentTurn.value === 'red' ? 'black-win' : 'red-win'
      sound.win()
      gameOverDialog.value = true
      return
    }
    result.value = myTurn.value ? 'lose' : 'win'
    if (result.value === 'win') {
      if (achievements.unlock('xiangqi_online_win')) {
        toast.show('成就解锁：联机先锋 🌐', '🏆')
      }
    }
    sound.win()
    haptics.win()
    gameOverDialog.value = true
  } else if (status === 'stalemate') {
    if (amSpectator.value) {
      spectResult.value = 'draw'
      gameOverDialog.value = true
      return
    }
    result.value = 'draw'
    sound.win()
    haptics.success()
    gameOverDialog.value = true
  }
}

defineExpose({ resetBoard })
function resetBoard(broadcast: boolean) {
  surrenderByMe.value = false
  gameOverDialog.value = false
  surrenderDialog.value = false
  drawOfferConfirm.value = false
  selected.value = null
  legalTargets.value = []
  board.value = initialBoard()
  currentTurn.value = 'red'
  lastMove.value = null
  result.value = null
  spectResult.value = null
  if (broadcast) {
    room.send('reset', {})
  }
}

onMounted(() => {
  if (!route.query.room && roomCode.value) {
    router.replace({ path: '/xiangqi', query: { room: roomCode.value } })
  }
})
</script>

<style scoped>
.game-container { display: flex; flex-direction: column; align-items: center; gap: 16px; }
.notice { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; background: rgba(255, 158, 0, 0.06); border: 1px solid rgba(255, 158, 0, 0.3); border-radius: 18px; padding: 28px 24px; color: #fff; }
.notice-icon { font-size: 2.4em; margin-bottom: 10px; } .notice h3 { font-size: 1.3em; margin-bottom: 12px; }
.room-bar { display: flex; align-items: center; gap: 12px; padding: 10px 18px; background: rgba(255, 158, 0, 0.07); border: 1px solid rgba(255, 158, 0, 0.3); border-radius: 30px; }
.room-label { color: #9aa0b5; font-size: 0.9em; } .room-code { font-size: 1.4em; font-weight: 700; letter-spacing: 4px; color: #FF9E00; }
.copy-btn { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; padding: 7px 14px; border-radius: 16px; font-size: 0.85em; cursor: pointer; }
.banner { font-size: 0.95em; padding: 9px 20px; border-radius: 20px; background: rgba(255, 255, 255, 0.05); color: #cfd3e0; }
.banner-wait { color: #FFD700; border-color: rgba(255, 215, 0, 0.3); background: rgba(255, 215, 0, 0.06); }
.banner-warn { color: #FF6B6B; border-color: rgba(255, 107, 107, 0.3); background: rgba(255, 107, 107, 0.06); }
.turn-indicator { display: flex; align-items: center; gap: 10px; padding: 10px 22px; background: rgba(255, 158, 0, 0.08); border: 1px solid rgba(255, 158, 0, 0.3); border-radius: 30px; }
.turn-dot { width: 12px; height: 12px; border-radius: 50%; background: #FF9E00; box-shadow: 0 0 12px #FF9E00; }
.score-row { display: flex; gap: 16px; }
.score-box { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 22px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; }
.score-label { font-size: 0.78em; color: #9aa0b5; } .score-value { font-size: 1.5em; font-weight: 700; color: #fff; }
.online-controls { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.ctrl-btn { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.12); color: #fff; padding: 10px 20px; border-radius: 14px; font-size: 0.95em; cursor: pointer; transition: all 0.2s ease; }
.ctrl-btn:hover:not(:disabled) { background: rgba(255, 158, 0, 0.15); border-color: #FF9E00; }
.ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.reset-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #FF9E00, #B967FF); color: #fff; border: none; padding: 12px 28px; border-radius: 14px; font-size: 1.05em; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
.reset-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(255, 158, 0, 0.4); }
.dialog-btn { background: linear-gradient(135deg, #FF9E00, #B967FF); color: #0D0D1A; border: none; padding: 12px 35px; font-size: 1.1em; font-weight: 600; border-radius: 25px; cursor: pointer; transition: all 0.2s; }
.dialog-btn:hover { transform: scale(1.05); }
.dialog-btn-ghost { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: #cfd3e0; }
.dialog-btn-ghost:hover { background: rgba(255, 255, 255, 0.12); }
@media (max-width: 640px) { .score-box { padding: 8px 14px; } .online-controls { gap: 6px; } .ctrl-btn { padding: 8px 14px; font-size: 0.85em; } }
</style>
