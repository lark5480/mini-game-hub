import { ref, computed, type ComputedRef, type Ref } from 'vue'
import { useRealtimeRoom, type RoomStatus } from '@/composables/useRealtimeRoom'

export interface RaceSettleResult {
  me: number
  opponent: number
  outcome: 'win' | 'lose' | 'draw' | 'opponent-left'
}

export interface RaceRoomApi {
  status: Ref<RoomStatus>
  peerCount: Ref<number>
  isHost: ComputedRef<boolean>
  opponentPresent: ComputedRef<boolean>
  opponentLeft: ComputedRef<boolean>
  amSpectator: ComputedRef<boolean>
  opponentScore: Ref<number>
  difficulty: Ref<string>
  /** 节流广播（间隔 ≥ 1s） */
  sendScore: (score: number) => void
  /** 立即发送最终分数（结算用，不走节流） */
  sendFinalScore: (score: number) => void
  requestStart: () => void
  requestPlayAgain: () => void
  acceptPlayAgain: () => void
  declinePlayAgain: () => void
  setDifficulty: (d: string) => void
  leave: () => void
}

export interface RaceRoomOptions {
  game?: string
  onOpponentScore?: (score: number) => void
  onOpponentLeave?: () => void
  onStartCountdown?: () => void
  onSettle?: (result: RaceSettleResult) => void
  onPlayAgainRequest?: () => void
  onPlayAgainAccept?: () => void
  onPlayAgainDeclined?: () => void
  onDifficulty?: (d: string) => void
}

/**
 * 竞速对战房间封装：基于 useRealtimeRoom 的房间生命周期，叠加「记分竞速」语义
 *  - 房主判定：presence 排序后第一个 id（确定性，两端一致）
 *  - 分数节流同步（≥ 1s），结算时立即 flush
 *  - 开始 / 难度 / 结算 / 再来一局 / 断线 路由
 * 不含任何打地鼠专有逻辑，后续竞速游戏可复用。
 */
export function useRaceRoom(roomCode: string, opts: RaceRoomOptions = {}): RaceRoomApi {
  const room = useRealtimeRoom(roomCode, { game: opts.game ?? 'race' })

  const opponentScore = ref(0)
  const difficulty = ref('normal')

  // 锁定两名玩家：排序后前两位 = [房主, 客人]；仅当两人都离开才解锁重排。
  const lockedPlayers = ref<string[]>([])
  const opponentId = ref<string | null>(null)
  const hadOpponent = ref(false)
  let leftNotified = false

  // 结算状态：双方最终分收集完毕后触发 onSettle。
  const myFinal = ref<number | null>(null)
  const opponentFinal = ref<number | null>(null)
  let settled = false

  // 节流时间戳
  let lastSendTs = 0

  const isHost = computed(() => {
    const ids = lockedPlayers.value
    return ids.length >= 1 && ids[0] === room.myId
  })
  const opponentPresent = computed(
    () => !!opponentId.value && room.peerIds.value.includes(opponentId.value),
  )
  const amSpectator = computed(
    () => lockedPlayers.value.length >= 2 && !lockedPlayers.value.includes(room.myId),
  )
  // 对手中途离开：曾经有对手、当前不在、且不是自己房满了（房主视角对手掉线）
  const opponentLeft = computed(() => hadOpponent.value && !opponentPresent.value)

  function trySettle() {
    if (settled) return
    if (myFinal.value === null) return
    // 对手已离开：直接结算，不等对手最终分
    if (opponentLeft.value) {
      settled = true
      opts.onSettle?.({
        me: myFinal.value,
        opponent: opponentFinal.value ?? opponentScore.value,
        outcome: 'opponent-left',
      })
      return
    }
    if (opponentFinal.value === null) return
    settled = true
    let outcome: RaceSettleResult['outcome']
    if (myFinal.value > opponentFinal.value) outcome = 'win'
    else if (myFinal.value < opponentFinal.value) outcome = 'lose'
    else outcome = 'draw'
    opts.onSettle?.({ me: myFinal.value, opponent: opponentFinal.value, outcome })
  }

  room.onPresenceSync((ids: string[]) => {
    const present = ids.slice().sort()
    if (lockedPlayers.value.length >= 2) {
      const here = lockedPlayers.value.filter(id => present.includes(id))
      if (here.length === 0) lockedPlayers.value = []
    }
    if (lockedPlayers.value.length === 0 && present.length >= 2) {
      lockedPlayers.value = present.slice(0, 2)
    }
    const iAmP = lockedPlayers.value.includes(room.myId)
    opponentId.value = iAmP ? (lockedPlayers.value.find(id => id !== room.myId) ?? null) : null

    if (iAmP && opponentId.value) hadOpponent.value = true
    // 对手掉线：回调仅触发一次，opponentLeft 计算属性持续反映
    if (hadOpponent.value && !opponentPresent.value && !leftNotified) {
      leftNotified = true
      opts.onOpponentLeave?.()
    }
  })

  // 对手分数（节流同步）
  room.on('score', (data: any) => {
    if (typeof data === 'number') {
      opponentScore.value = data
      opts.onOpponentScore?.(data)
    }
  })
  // 对手最终分（结算）
  room.on('final', (data: any) => {
    if (typeof data === 'number') {
      opponentFinal.value = data
      opponentScore.value = data
      trySettle()
    }
  })
  // 房主广播开始
  room.on('start', () => opts.onStartCountdown?.())
  // 房主广播难度
  room.on('difficulty', (data: any) => {
    if (typeof data === 'string') {
      difficulty.value = data
      opts.onDifficulty?.(data)
    }
  })
  // 再来一局：客人收到房主请求
  room.on('play-again', () => opts.onPlayAgainRequest?.())
  // 再来一局：房主收到客人接受
  room.on('play-again-accept', () => opts.onPlayAgainAccept?.())
  // 再来一局：房主收到客人拒绝
  room.on('play-again-decline', () => opts.onPlayAgainDeclined?.())

  function sendScore(score: number) {
    const now = Date.now()
    if (now - lastSendTs < 1000) return
    lastSendTs = now
    room.send('score', score)
  }

  function sendFinalScore(score: number) {
    lastSendTs = Date.now()
    room.send('final', score)
    myFinal.value = score
    trySettle()
  }

  function requestStart() {
    if (!isHost.value) return
    myFinal.value = null
    opponentFinal.value = null
    settled = false
    room.send('start', {})
  }

  function requestPlayAgain() {
    if (!isHost.value) return
    myFinal.value = null
    opponentFinal.value = null
    opponentScore.value = 0
    hadOpponent.value = false
    leftNotified = false
    settled = false
    room.send('play-again', {})
  }

  function acceptPlayAgain() {
    myFinal.value = null
    opponentFinal.value = null
    opponentScore.value = 0
    hadOpponent.value = false
    leftNotified = false
    settled = false
    room.send('play-again-accept', {})
  }

  function declinePlayAgain() {
    room.send('play-again-decline', {})
  }

  function setDifficulty(d: string) {
    if (!isHost.value) return
    difficulty.value = d
    room.send('difficulty', d)
  }

  function leave() {
    room.leave()
  }

  return {
    status: room.status,
    peerCount: room.peerCount,
    isHost,
    opponentPresent,
    opponentLeft,
    amSpectator,
    opponentScore,
    difficulty,
    sendScore,
    sendFinalScore,
    requestStart,
    requestPlayAgain,
    acceptPlayAgain,
    declinePlayAgain,
    setDifficulty,
    leave,
  }
}
