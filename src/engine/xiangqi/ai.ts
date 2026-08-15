// 中国象棋 AI：Negamax + Alpha-Beta + 静态搜索 + 迭代加深
//
// 核心机制：
// - MVV-LVA 走法排序（吃子按 被害子价值*10 - 攻击子价值 排序）提升剪枝效率
// - 静态搜索（Quiescence）：叶子节点沿吃子线延伸，消除水平线效应
//   （避免"吃子后立刻被反吃"的误判；被将时延伸所有应将着法）
// - 迭代加深 + 可选时限：在时限内逐层加深，超时保留上一层结果；minDepth 深度下限保证
//   慢设备上的保底强度（未达下限时延长一个时限周期重试，总时长硬上限 2×时限）
// - 杀棋距离分：越快将死分越高，避免拖延取胜
// - 置换表（Transposition Table）：缓存已搜索局面，层间复用，同等时限搜更深
// - Killer moves + History heuristic：非吃子着法排序增强，提升剪枝效率
// - 晚移约减（LMR）：排序靠后的非吃子/非将军着法减 1 层试搜，突破 alpha 再重搜
// - 空着剪枝（Null Move Pruning）：非根/非被将/非残局时试探不走子，快速剪枝（显著加深有效深度）
// - 将军延伸（Check Extension）：中局被将时多搜一层，减少漏算杀棋
// - Zobrist 哈希：置换表 key 用 64 位哈希替代字符串，命中更快；含 side-to-move 保证跨步复用语义；走子增量更新（O(1)/节点）
// - 根节点 PVS：首着全窗口搜索、其余着法零窗口试探，突破 alpha 再重搜，根分支多时显著提速
// - 被将判定轻量化：isSquareAttacked 直扫（4 向 + 马 + 兵）替代全盘伪走法生成，语义等价、显著提速
// - 置换表/killer/history 跨着法复用：同对局内逐着累加，搜得更深（带 size 上限清理）
// - 重复局面规避：搜索路径内局面重复 >= 2 次给予强负分，避免 AI 主动长将/长捉被判负
// - 评估：子力 + PST（机动性与王安全因搜索热路径性能权衡移除，见 2026-08-10-xiangqi-search-optimization R2）

import { Side, PieceType, Piece, Board, Move, ROWS, COLS } from './types'
import { generateMoves, getGameStatus } from './rules'

// 子力基础价值（百分制）
const PIECE_VALUE: Record<PieceType, number> = {
  king: 10000,
  rook: 900,
  cannon: 450,
  horse: 400,
  elephant: 200,
  advisor: 200,
  pawn: 100
}

// 位置加成表（红方视角，黑方镜像）
const POSITION_BONUS: Record<PieceType, number[][]> = {
  pawn: [
    // 红方视角正确梯度：越往前（过河→纵深）越值钱；row 7-9 红兵不可达恒为 0。
    // 修复 P0：旧表方向写反（在家 row 6 最高分、过河反而贬值），导致 AI 全难度不愿挺兵过河。
    [60, 80, 90, 100, 100, 100, 90, 80, 60],
    [50, 70, 80, 90, 90, 90, 80, 70, 50],
    [40, 60, 70, 80, 80, 80, 70, 60, 40],
    [25, 40, 50, 60, 60, 60, 50, 40, 25],
    [15, 25, 35, 45, 45, 45, 35, 25, 15],
    [5, 15, 20, 25, 25, 25, 20, 15, 5],
    [0, 5, 10, 10, 10, 10, 10, 5, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  horse: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 10, 20, 20, 20, 10, 0, 0],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [0, 20, 30, 40, 40, 40, 30, 20, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0]
  ],
  rook: [
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10]
  ],
  cannon: [
    [0, 10, 20, 30, 30, 30, 20, 10, 0],
    [0, 10, 20, 30, 30, 30, 20, 10, 0],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [10, 20, 30, 40, 40, 40, 30, 20, 10],
    [0, 10, 20, 30, 30, 30, 20, 10, 0],
    [0, 10, 20, 30, 30, 30, 20, 10, 0]
  ],
  king: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 10, 20, 10, 0, 0, 0],
    [0, 0, 0, 10, 20, 10, 0, 0, 0],
    [0, 0, 0, 10, 20, 10, 0, 0, 0]
  ],
  advisor: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 10, 0, 10, 0, 0, 0],
    [0, 0, 0, 0, 15, 0, 0, 0, 0],
    [0, 0, 0, 10, 0, 10, 0, 0, 0]
  ],
  elephant: [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 10, 0, 0, 0, 10, 0, 0],
    [0, 0, 0, 0, 15, 0, 0, 0, 0],
    [0, 0, 10, 0, 0, 0, 10, 0, 0]
  ]
}

// 杀棋基准分（远大于任何子力价值之和）
const MATE = 1000000
// 静态搜索最大延伸半步数（防止吃子长链爆炸；4 整步为业界常规深度，长链 stand-pat 兜底）
const MAX_QUIESCENCE_DEPTH = 8

// ---- 评估权重 ----
// （机动性 / 王安全已移除：每叶子 2 次全量 generateMoves + 每评估 2 次 findKing 扫描，
//   与搜索内 isInCheckLight 重复计算，开销与收益不成比例，R2 提速时去除）

// ---- 结构评估权重（2026-08-11 新增：车半开放线 + 兵形 + 王翼保护）----
// 设计约束：只做单遍扫描内收集的轻量特征（无走法生成、无二次全盘扫描，规避 R2 性能教训）；
// 权重宁小勿大，总影响 < 1 个兵（100 分），不颠覆子力主导。
const ROOK_SEMI_OPEN = 25 // 车在半开放线（该列无己方兵）
const ROOK_OPEN = 15      // 车在开放线（该列无任何兵，与半开放叠加）
const PAWN_CONNECTED = 8  // 连兵（邻列有己方兵且行差 <= 1）
const PAWN_ISOLATED = -12 // 孤兵（左右邻列无己方兵）
const PAWN_DOUBLED = -8   // 叠兵（同列多兵，每个多余兵）
const KING_SHIELD = 6     // 王翼兵保护（王所在列 +/-1 内的己方兵）

// ---- 走法排序基差 ----
const SCORE_CAPTURE = 100000
const SCORE_KILLER = 50000
const SCORE_HISTORY = 30000

function getPositionBonus(piece: Piece, row: number, col: number): number {
  const table = POSITION_BONUS[piece.type]
  if (!table) return 0
  const r = piece.side === 'red' ? row : ROWS - 1 - row
  return table[r][col]
}

// ---- 局面序列化（置换表 key + 重复局面检测共用）----
// Zobrist 哈希：64 位 bigint，比字符串拼接 + Map 字符串 key 快一个数量级；
// key 含 side-to-move（该谁走），保证跨着法复用 TT 时语义正确（避免同布局不同走子方误命中）。
const PIECE_TYPES_FOR_HASH: PieceType[] = ['king', 'rook', 'cannon', 'horse', 'elephant', 'advisor', 'pawn']
function rand64(): bigint {
  let s = ''
  for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 65536).toString(16).padStart(4, '0')
  return BigInt('0x' + s)
}
const ZOBRIST: Record<Side, Record<PieceType, bigint[]>> = {
  red: { king: [], rook: [], cannon: [], horse: [], elephant: [], advisor: [], pawn: [] },
  black: { king: [], rook: [], cannon: [], horse: [], elephant: [], advisor: [], pawn: [] }
}
for (const side of ['red', 'black'] as Side[]) {
  for (const t of PIECE_TYPES_FOR_HASH) {
    ZOBRIST[side][t] = Array.from({ length: ROWS * COLS }, () => rand64())
  }
}
const ZOBRIST_TURN: Record<Side, bigint> = { red: rand64(), black: rand64() }

// 测试导出：供 tests/test-xiangqi.cjs 对照增量 key 一致性
// （Zobrist 表为模块内部随机生成，测试无法自行复制，故导出 boardKey 作基准）
export function boardKey(board: Board, side: Side): bigint {
  let h = 0n
  for (let r = 0; r < ROWS; r++) {
    const row = board[r]
    for (let c = 0; c < COLS; c++) {
      const p = row[c]
      if (p) h ^= ZOBRIST[p.side][p.type][r * COLS + c]
    }
  }
  h ^= ZOBRIST_TURN[side]
  return h
}

// 走子后增量更新 Zobrist key（O(1)）：移子 XOR from/to 索引、吃子 XOR victim、换手 XOR turn
// 测试导出：供 tests/test-xiangqi.cjs 断言与 boardKey 全量一致
// （board 为走子前局面，move 必须合法）
export function nextKey(key: bigint, board: Board, move: Move, side: Side): bigint {
  const piece = board[move.from.row][move.from.col]!
  const victim = board[move.to.row][move.to.col]
  let k = key ^ ZOBRIST[side][piece.type][move.from.row * COLS + move.from.col]
  k ^= ZOBRIST[side][piece.type][move.to.row * COLS + move.to.col]
  if (victim) k ^= ZOBRIST[victim.side][victim.type][move.to.row * COLS + move.to.col]
  k ^= ZOBRIST_TURN[side] ^ ZOBRIST_TURN[opposite(side)]
  return k
}

// ---- 搜索状态（模块级，单次 findBestMove 内共享）----
let searchNodes = 0
let searchDeadline = Infinity
// 取消标志：Worker 环境收到 cancel 消息后置位，tickTimeout 检查中断当前搜索
// （复用 SearchTimeout 超时路径，findBestMove 入口重置；不用 terminate 以免丢 TT）
let cancelRequested = false
export function cancelSearch(): void { cancelRequested = true }

// 测试导出：清空搜索状态（置换表 / killer / history）。
// 跨调用状态复用是性能设计（同对局内搜更深），但会让测试的「冷态参照值」
// 被先前搜索的 TT 污染（浅层直接命中深层 TT 条目返回不同着法）；测试在每个
// 测量前重置以获得确定性的冷态对照。生产路径不调用。
export function resetSearchState(): void {
  tt.clear()
  killerMoves = Array.from({ length: MAX_PLY }, () => [null, null])
  historyTable = new Int32Array(2 * ROWS * COLS * ROWS * COLS)
}

class SearchTimeout extends Error {
  constructor() {
    super('search timeout')
  }
}

function tickTimeout(): void {
  // 每 4096 节点检查一次时间，降低 Date.now() 开销
  if ((searchNodes & 4095) === 0 && (cancelRequested || Date.now() > searchDeadline)) {
    throw new SearchTimeout()
  }
}

// ---- 置换表 ----
// flag：0=exact 精确值；1=lower（beta 剪枝下界）；2=upper（fail-low 上界）
type TTFlag = 0 | 1 | 2
interface TTEntry {
  depth: number
  score: number
  flag: TTFlag
  move: Move | null
}
let tt = new Map<bigint, TTEntry>()

// ---- Killer moves（按 ply 至多 2 个）----
const MAX_PLY = 40
let killerMoves: (Move | null)[][] = Array.from({ length: MAX_PLY }, () => [null, null])

// ---- TT 杀棋分 ply 校正 ----
// 存储时剥离 ply（统一为 ±MATE），命中时按当前 ply 恢复，消除跨着法命中语义错位
// （只影响速杀/拖延偏好精度，不影响胜负判定；仅在 |score| 接近 MATE 时转换，安全边界）
function ttScoreToPly(score: number, ply: number): number {
  if (score >= MATE - MAX_PLY) return score + ply
  if (score <= -(MATE - MAX_PLY)) return score - ply
  return score
}
function ttScoreFromPly(score: number, ply: number): number {
  if (score >= MATE - MAX_PLY) return score - ply
  if (score <= -(MATE - MAX_PLY)) return score + ply
  return score
}

// ---- History heuristic（跨层共享的着法加分表，红黑分表避免镜像着法互污染）----
let historyTable = new Int32Array(2 * ROWS * COLS * ROWS * COLS)

function histIndex(move: Move, side: Side): number {
  const base = side === 'red' ? 0 : ROWS * COLS * ROWS * COLS
  return base + (move.from.row * COLS + move.from.col) * (ROWS * COLS) + move.to.row * COLS + move.to.col
}

function sameMove(a: Move, b: Move): boolean {
  return a.from.row === b.from.row && a.from.col === b.from.col &&
    a.to.row === b.to.row && a.to.col === b.to.col
}

// 评估函数：从红方视角（正=红优势，负=黑优势）
// 结构评估（车半开放线/兵形/王翼保护）在单遍扫描内顺带收集，无二次全盘扫描、无走法生成
// （测试导出：Suite 36 用行为断言验证各评估项方向与幅度）
export function evaluateBoard(board: Board): number {
  let score = 0
  // 单遍扫描收集轻量特征（每列兵数、每列兵行位图、车所在列、王位置）
  const filePawns = [new Int8Array(COLS), new Int8Array(COLS)]
  const pawnMask = [new Int32Array(COLS), new Int32Array(COLS)] // 每列兵行位图（1 << row）
  const rookFiles = [new Int8Array(COLS), new Int8Array(COLS)]
  const kingPos: ({ row: number; col: number } | null)[] = [null, null]
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue
      const value = PIECE_VALUE[p.type] + getPositionBonus(p, r, c)
      score += p.side === 'red' ? value : -value
      const i = p.side === 'red' ? 0 : 1
      if (p.type === 'pawn') { filePawns[i][c]++; pawnMask[i][c] |= 1 << r }
      else if (p.type === 'rook') rookFiles[i][c]++
      else if (p.type === 'king') kingPos[i] = { row: r, col: c }
    }
  }
  score += evalStructure(0, filePawns, pawnMask, rookFiles, kingPos) -
    evalStructure(1, filePawns, pawnMask, rookFiles, kingPos)
  return score
}

// 单方结构评估（红方视角正值；sideIdx 0=红 1=黑，黑方结果在调用处取负）
function evalStructure(
  sideIdx: number,
  filePawns: Int8Array[],
  pawnMask: Int32Array[],
  rookFiles: Int8Array[],
  kingPos: ({ row: number; col: number } | null)[]
): number {
  let s = 0
  const other = 1 - sideIdx
  // 车：半开放线（列内无己方兵）+ 开放线（列内无任何兵）
  for (let c = 0; c < COLS; c++) {
    if (!rookFiles[sideIdx][c]) continue
    if (filePawns[sideIdx][c] === 0) {
      s += ROOK_SEMI_OPEN
      if (filePawns[other][c] === 0) s += ROOK_OPEN
    }
  }
  // 兵：连兵/孤兵（行位图 O(1) 判定，行差 <= 1）、叠兵
  for (let c = 0; c < COLS; c++) {
    const own = filePawns[sideIdx][c]
    if (own === 0) continue
    for (let b = 0; b < ROWS; b++) {
      if (!(pawnMask[sideIdx][c] & (1 << b))) continue
      // 邻列同行差 <= 1 的己方兵（掩码 & 0x3ff 截取行 0-9 有效位）
      const nb = c > 0 && (pawnMask[sideIdx][c - 1] & (((1 << (b - 1)) | (1 << b) | (1 << (b + 1))) & 0x3ff)) !== 0
      const nb2 = c < COLS - 1 && (pawnMask[sideIdx][c + 1] & (((1 << (b - 1)) | (1 << b) | (1 << (b + 1))) & 0x3ff)) !== 0
      if (nb || nb2) s += PAWN_CONNECTED
      else {
        const left = c > 0 ? filePawns[sideIdx][c - 1] : 0
        const right = c < COLS - 1 ? filePawns[sideIdx][c + 1] : 0
        if (left === 0 && right === 0) s += PAWN_ISOLATED
      }
    }
    if (own > 1) s += PAWN_DOUBLED * (own - 1)
  }
  // 王翼兵保护：王所在列 +/-1 内的己方兵
  const kp = kingPos[sideIdx]
  if (kp) {
    for (let c = Math.max(0, kp.col - 1); c <= Math.min(COLS - 1, kp.col + 1); c++) {
      s += KING_SHIELD * filePawns[sideIdx][c]
    }
  }
  return s
}

// 王位置查找（isInCheckLight / 飞将判定共用）
function findKing(board: Board, side: Side): { row: number; col: number } | null {
  for (let r = 0; r < ROWS; r++) {
    const row = board[r]
    for (let c = 0; c < COLS; c++) {
      const p = row[c]
      if (p && p.type === 'king' && p.side === side) return { row: r, col: c }
    }
  }
  return null
}

// 轻量被将判定（测试导出）：findKing + isSquareAttacked，无走法生成。
// 语义与 rules.isInCheck 等价：士/象攻击范围到不了对方九宫王位；飞将已含在 isSquareAttacked 的 4 向扫描（列向敌方帅将即攻）。
export function isInCheckLight(board: Board, side: Side): boolean {
  const king = findKing(board, side)
  return king ? isSquareAttacked(board, king.row, king.col, opposite(side)) : false
}

// 轻量攻击判定（不生成 moves）：判断 (r, c) 是否被 by 方攻击
function isSquareAttacked(board: Board, r: number, c: number, by: Side): boolean {
  // 兵/卒：正前方直攻；过河后可斜攻（红兵 row<=4 过河，黑兵 row>=5 过河）
  const fwd = by === 'red' ? 1 : -1 // 攻击者相对 (r,c) 的行偏移（红兵在下方）
  const pr = r + fwd
  if (pr >= 0 && pr < ROWS) {
    const p = board[pr][c]
    if (p && p.side === by && p.type === 'pawn') return true
    const crossed = by === 'red' ? pr <= 4 : pr >= 5
    if (crossed) {
      if (c > 0) {
        const pl = board[pr][c - 1]
        if (pl && pl.side === by && pl.type === 'pawn') return true
      }
      if (c < COLS - 1) {
        const pr2 = board[pr][c + 1]
        if (pr2 && pr2.side === by && pr2.type === 'pawn') return true
      }
    }
  }

  // 马：8 个日字位，需无蹩马腿
  const horseDirs = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]
  for (const [dr, dc] of horseDirs) {
    const hr = r + dr
    const hc = c + dc
    if (hr < 0 || hr >= ROWS || hc < 0 || hc >= COLS) continue
    const p = board[hr][hc]
    if (!p || p.side !== by || p.type !== 'horse') continue
    const legR = Math.abs(dr) === 2 ? r + dr / 2 : r
    const legC = Math.abs(dc) === 2 ? c + dc / 2 : c
    if (!board[legR][legC]) return true
  }

  // 车/炮/对面帅将：4 向扫描（车直击；炮隔一子击；帅将列向对脸）
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (const [dr, dc] of dirs) {
    let rr = r + dr
    let cc = c + dc
    let jumped = false
    while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) {
      const p = board[rr][cc]
      if (p) {
        if (!jumped) {
          if (p.side === by && (p.type === 'rook' || (dc === 0 && p.type === 'king'))) return true
          jumped = true // 首个棋子作为炮架
        } else {
          if (p.side === by && p.type === 'cannon') return true
          break
        }
      }
      rr += dr
      cc += dc
    }
  }
  return false
}

// 残局判定：非空格（含王）总数 >= 4 才做空着剪枝，避免王兵残局 zugzwang 下空着剪枝误杀正确着法
function hasZugzwangSafePiece(board: Board): boolean {
  let n = 0
  for (let r = 0; r < ROWS; r++) {
    const row = board[r]
    for (let c = 0; c < COLS; c++) {
      if (row[c]) { n++; if (n >= 4) return true }
    }
  }
  return false
}

function opposite(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}

// 走法排序分：吃子 MVV-LVA > TT 着法 > killer > history > 位置增益
function moveOrderScore(board: Board, move: Move, ply: number, ttMove: Move | null): number {
  const victim = board[move.to.row][move.to.col]
  const attacker = board[move.from.row][move.from.col]
  if (!attacker) return 0
  if (victim) {
    return SCORE_CAPTURE + PIECE_VALUE[victim.type] * 10 - PIECE_VALUE[attacker.type]
  }
  if (ttMove && sameMove(move, ttMove)) return SCORE_KILLER + 1
  const killers = ply < MAX_PLY ? killerMoves[ply] : null
  if (killers && killers[0] && sameMove(move, killers[0])) return SCORE_KILLER
  if (killers && killers[1] && sameMove(move, killers[1])) return SCORE_KILLER - 1
  const h = historyTable[histIndex(move, attacker.side)]
  if (h > 0) return SCORE_HISTORY + Math.min(h, SCORE_KILLER - SCORE_HISTORY - 2)
  return getPositionBonus(attacker, move.to.row, move.to.col) -
    getPositionBonus(attacker, move.from.row, move.from.col)
}

function orderMoves(board: Board, moves: Move[], ply: number, ttMove: Move | null = null): Move[] {
  return [...moves].sort((a, b) => moveOrderScore(board, b, ply, ttMove) - moveOrderScore(board, a, ply, ttMove))
}

// 搜索专用走子：浅拷贝（行 slice，棋子对象共享引用）。
// 刻意不复用 rules.applyMove —— 后者经 cloneBoard 深拷贝每子，搜索热路径下
// GC 压力大；搜索全程只读棋子对象、不 mutate，共享引用安全。
// 行级拷贝：只复制受影响的行，其余行共享引用（board 永不 mutate，只读共享安全），
// 比全量 map+slice 少约 80% 数组分配。
function applyMoveForAI(board: Board, move: Move): Board {
  const newBoard = board.slice()
  const piece = board[move.from.row][move.from.col]
  if (move.from.row === move.to.row) {
    const row = board[move.from.row].slice()
    row[move.to.col] = piece
    row[move.from.col] = null
    newBoard[move.from.row] = row
  } else {
    const fromRow = board[move.from.row].slice()
    fromRow[move.from.col] = null
    newBoard[move.from.row] = fromRow
    const toRow = board[move.to.row].slice()
    toRow[move.to.col] = piece
    newBoard[move.to.row] = toRow
  }
  return newBoard
}

/**
 * 静态搜索：只沿吃子线延伸，消除水平线效应。
 * 返回值为「当前走子方 side」视角的分数（negamax 约定）。
 * 被将时不能 stand-pat，必须搜索所有应将着法。
 */
function quiescence(
  board: Board,
  alpha: number,
  beta: number,
  side: Side,
  ply: number,
  qdepth: number
): number {
  searchNodes++
  tickTimeout()

  // 深链防御：被将时的应将/吃子链不受 qdepth 限制（必须搜索应将着法），
  // 极端互将长链可使 ply 超过 MAX_PLY（killerMoves 定长数组越界），达上限按被杀处理
  if (ply >= MAX_PLY) return -(MATE - ply)

  const inCheck = isInCheckLight(board, side)
  const standPat = (side === 'red' ? evaluateBoard(board) : -evaluateBoard(board))

  if (!inCheck) {
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat
    if (qdepth <= 0) return standPat
  }

  const moves = generateMoves(board, side)
  if (moves.length === 0) {
    // 无子可走：象棋中困毙也判负
    return -(MATE - ply)
  }
  const searchMoves = inCheck ? moves : moves.filter(m => board[m.to.row][m.to.col] !== null)
  if (searchMoves.length === 0) return standPat

  const ordered = orderMoves(board, searchMoves, ply)
  let best = inCheck ? -Infinity : standPat
  for (const move of ordered) {
    const score = -quiescence(applyMoveForAI(board, move), -beta, -alpha, opposite(side), ply + 1, qdepth - 1)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/**
 * Negamax + Alpha-Beta。返回「当前走子方 side」视角的分数。
 * ply = 距根节点的半步数（用于杀棋距离修正）。
 * repPath = 搜索路径上的局面 key（含根局面），用于重复局面规避。
 * enableRep = false 时跳过重复检测（空着剪枝试探用，避免棋盘未变污染路径）。
 */
function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  side: Side,
  ply: number,
  repPath: bigint[],
  key: bigint,
  enableRep = true
): number {
  searchNodes++
  tickTimeout()

  // 重复局面规避（AI 不主动走进长将/长捉被判负）：
  // 罚分 2*MATE - ply 严格劣于任何真实将杀分（MATE - ply 随层数衰减，败局中可能高于
  // 「下一步被将死」，AI 会理性选择违规拖延）。
  // 归属判定按「当前方是否被将」区分长将循环的两种局面（4 步循环含两个交替局面）：
  // - 被将节点（应将局面，由将军方走出）：违规方 = 将军方 → 当前方得强正分（对方判负）；
  // - 未被将节点（前置局面，由应将方走出）：违规方 = 当前方 → 强负分。
  // 旧实现一律归责最后走子方：根局面已在历史中时，前置局面先于将军局面到达第 3 次出现，
  // 罚分误归应将方、反而奖励将军方；且「连将与送杀同分」时排序可恰好选中连将走满周期。
  // 因此在被将局面的第 2 次重复即惩罚将军方（再一轮即触发视图长将判负，提前阻断）。
  // TT 杀棋分校正阈值 |score| >= MATE - MAX_PLY 自动覆盖双倍分（存储剥离/恢复 ply 仍一致）。
  if (enableRep) {
    let repeats = 0
    for (let i = 0; i < repPath.length; i++) {
      if (repPath[i] !== key) continue
      if (++repeats >= 2) {
        return isInCheckLight(board, side) ? 2 * MATE - ply : -(2 * MATE - ply)
      }
      if (isInCheckLight(board, side)) return 2 * MATE - ply
    }
  }

  // 置换表
  const entry = tt.get(key)
  if (entry && entry.depth >= depth) {
    const s = ttScoreFromPly(entry.score, ply)
    if (entry.flag === 0) return s
    if (entry.flag === 1 && s >= beta) return s
    if (entry.flag === 2 && s <= alpha) return s
  }

  // 当前是否被将（用于将军延伸 + 跳过空着剪枝）
  const inCheck = isInCheckLight(board, side)

  // 将军延伸：中局被将时多搜一层，减少漏算杀棋；限制 ply 避免残局 zugzwang 无限延伸
  let searchDepth = depth
  if (inCheck && ply < 16 && depth < 24) searchDepth = depth + 1

  if (searchDepth <= 0) {
    // 叶子：进入静态搜索（吃子线延伸，消除水平线效应）
    return quiescence(board, alpha, beta, side, ply, MAX_QUIESCENCE_DEPTH)
  }

  if (enableRep) repPath.push(key)
  const moves = orderMoves(board, generateMoves(board, side), ply, entry ? entry.move : null)
  if (moves.length === 0) {
    if (enableRep) repPath.pop()
    // 被将死或困毙都算负；越快被杀分越低（偏好拖延），反之偏好速杀
    return -(MATE - ply)
  }

  // 空着剪枝（Null Move Pruning）：非根、非被将、深度足够、非残局时，
  // 试探"不走子"对方能否仍达成 beta；若能，则当前节点必有更好着法可达 beta，直接剪枝。
  // 用 enableRep=false 调用，避免空着（棋盘未变）污染重复检测路径。
  if (searchDepth >= 3 && ply > 1 && !inCheck && hasZugzwangSafePiece(board)) {
    const R = 2
    const nullScore = -negamax(board, searchDepth - 1 - R, -beta, -beta + 1, opposite(side), ply + 1, repPath, key, false)
    if (nullScore >= beta) {
      // 空着剪枝返回上界 beta（非精确值，不写 TT）
      return beta
    }
  }

  let best = -Infinity
  let bestMove: Move | null = null
  const alpha0 = alpha
  let flag: TTFlag = 0

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const newBoard = applyMoveForAI(board, move)
    const newKey = nextKey(key, board, move, side)
    const isCapture = board[move.to.row][move.to.col] !== null
    let score: number

    if (searchDepth >= 3 && i >= 4 && !isCapture && !isInCheckLight(newBoard, opposite(side))) {
      // LMR：排序靠后的非吃子/非将军着法减 1 层试搜；突破 alpha 再全深度重搜
      score = -negamax(newBoard, searchDepth - 2, -beta, -alpha, opposite(side), ply + 1, repPath, newKey)
      if (score > alpha) {
        score = -negamax(newBoard, searchDepth - 1, -beta, -alpha, opposite(side), ply + 1, repPath, newKey)
      }
    } else {
      score = -negamax(newBoard, searchDepth - 1, -beta, -alpha, opposite(side), ply + 1, repPath, newKey)
    }

    if (score > best) {
      best = score
      bestMove = move
    }
    if (score > alpha) alpha = score
    if (alpha >= beta) {
      // beta 剪枝：非吃子着法记录 killer + history（加速后续同层排序）
      if (!isCapture) {
        if (ply < MAX_PLY) {
          const killers = killerMoves[ply]
          const isNewKiller = !(killers[0] && sameMove(move, killers[0])) &&
            !(killers[1] && sameMove(move, killers[1]))
          if (isNewKiller) {
            killers[1] = killers[0]
            killers[0] = move
          }
        }
        historyTable[histIndex(move, side)] = Math.min(historyTable[histIndex(move, side)] + depth * depth, 1 << 28)
      }
      flag = 1
      break
    }
  }
  if (enableRep) repPath.pop()

  if (best <= alpha0) flag = 2
  else if (best >= beta) flag = 1
  else flag = 0

  tt.set(key, { depth, score: ttScoreToPly(best, ply), flag, move: bestMove })
  return best
}

// ---- 提前出手（early exit）配置 ----
// 中局 8 层在时限内到不了（实测 5 层 2.5s / 7 层 6.2s / 8 层 8.5s），迭代加深几乎必然耗尽时限；
// 对大局已定 / 最佳着法多轮稳定的局面继续加深收益趋零，提前终止显著改善响应体验，
// 焦灼局面（分数接近、着法不稳）不受影响，仍搜满时限保强度。
export interface EarlyExitOptions {
  /** 决定性优势：根分 ≥ score 且完成 ≥ minDepth 层即终止；null 关闭。默认 { score: 900, minDepth: 4 } */
  decisive?: { score: number; minDepth: number } | null
  /** 着法稳定：连续 runs 层同一最佳着法、完成 ≥ minDepth 层且 |根分| ≥ minAbsScore 即终止；
   *  minAbsScore 缺省 150、null 表示无分数护栏；null 关闭。默认 { runs: 3, minDepth: 5, minAbsScore: 150 } */
  stable?: { runs: number; minDepth: number; minAbsScore?: number | null } | null
}

/**
 * 选择最佳走法（公共接口，兼容旧签名）。
 * @param depth    最大搜索深度（迭代加深的上限）
 * @param timeLimitMs 可选时限：超时后返回已完成深度的最佳着法
 * @param historyKeys 对局历史局面 key（最近 32 半步，重复局面规避用）
 * @param minDepth 可选深度下限：超时回退前必须已完成该层（慢设备保底强度；
 *                 未达标则延长一个时限周期重试，总时长硬上限 2×timeLimitMs）
 * @param earlyExit 可选提前出手配置（默认开启；见 EarlyExitOptions）
 */
export function findBestMove(board: Board, side: Side, depth = 3, timeLimitMs?: number, historyKeys?: bigint[], minDepth = 0, earlyExit?: EarlyExitOptions): Move | null {
  const rootMoves = generateMoves(board, side)
  if (rootMoves.length === 0) return null
  if (rootMoves.length === 1) return rootMoves[0]
  minDepth = Math.max(0, Math.min(minDepth, depth))

  // 搜索状态重置（置换表 / killer / history 跨着法保留复用，同对局内搜更深；
  // 仅当置换表过大时删半清理，避免内存无限增长 + 瞬时性能抖动）
  if (tt.size > 500000) {
    let i = 0
    for (const k of tt.keys()) {
      if ((i++ & 1) === 0) tt.delete(k) // Map 迭代序=插入序，保新弃旧
    }
  }
  searchDeadline = timeLimitMs !== undefined ? Date.now() + timeLimitMs : Infinity
  searchNodes = 0
  cancelRequested = false // 入口重置取消标志（防止上一次 cancel 残留污染本次搜索）

  let ordered = orderMoves(board, rootMoves, 0)
  let bestMove: Move = ordered[0]
  // 重复局面检测路径：以初始局面为根（根着法后若回到初始局面即可检出）；
  // 对局历史 key 并入路径：根着法后新局面若与历史重复 >= 2 次（即规则的第 3 次
  // 出现，长将/长捉判罚点）→ 搜索第一步即给强负分，AI 不会主动走进长将判负。
  // 历史 key 由视图层传入（最近 32 个半步，与 checkRepetitionViolation 的 MAX_PERIOD=32 判定窗口一致）
  const rootKey = boardKey(board, side)
  const repPath = historyKeys && historyKeys.length > 0 ? [...historyKeys, rootKey] : [rootKey]

  // 深度下限：未达标时延长搜索重试当前层；绝对硬截止 = 2×timeLimitMs（取消/超硬截止即中断，
  // 下限为硬截止内的尽力保证，避免慢设备无限等待）
  const hardDeadline = timeLimitMs !== undefined ? Date.now() + 2 * timeLimitMs : Infinity
  // 提前出手配置：undefined 用默认值，null 关闭该退出项
  const decisiveCfg = earlyExit?.decisive === null ? null : (earlyExit?.decisive ?? { score: 900, minDepth: 4 })
  const stableCfg = earlyExit?.stable === null ? null : (earlyExit?.stable ?? { runs: 3, minDepth: 5, minAbsScore: 150 })
  let prevBest: Move | null = null
  let stableRuns = 0
  let d = 1
  while (d <= depth) {
    let alpha = -Infinity
    let bestAtDepth: Move | null = null
    let bestScore = -Infinity

    try {
      // PVS：首着全窗口，其余着法零窗口试探、突破 alpha 才重搜全窗口
      for (let i = 0; i < ordered.length; i++) {
        const move = ordered[i]
        const newBoard = applyMoveForAI(board, move)
        const newKey = nextKey(rootKey, board, move, side)
        let score: number
        if (i === 0) {
          score = -negamax(newBoard, d - 1, -Infinity, -alpha, opposite(side), 1, repPath, newKey)
        } else {
          score = -negamax(newBoard, d - 1, -alpha - 1, -alpha, opposite(side), 1, repPath, newKey)
          if (score > alpha) {
            score = -negamax(newBoard, d - 1, -Infinity, -alpha, opposite(side), 1, repPath, newKey)
          }
        }
        if (score > bestScore) {
          bestScore = score
          bestAtDepth = move
        }
        if (score > alpha) alpha = score
      }
    } catch (e) {
      if (e instanceof SearchTimeout) {
        // 已完成深度不足 minDepth 且非取消（取消必须立即中断）且未到硬截止 → 延长一个时限周期重试本层
        if (d - 1 < minDepth && !cancelRequested && timeLimitMs !== undefined && Date.now() < hardDeadline) {
          searchDeadline = Math.min(Date.now() + timeLimitMs, hardDeadline)
          continue
        }
        break // 本层未完成，保留上一层结果
      }
      throw e
    }

    if (bestAtDepth) {
      stableRuns = prevBest && sameMove(prevBest, bestAtDepth) ? stableRuns + 1 : 1
      prevBest = bestAtDepth
      bestMove = bestAtDepth
      // 上一层最佳着法置顶，提升下一层剪枝效率
      ordered = [bestMove, ...ordered.filter(m => !sameMove(m, bestMove))]
    }
    // 已找到杀棋（或必败），无需再加深
    if (bestScore >= MATE - 1000 || bestScore <= -(MATE - 1000)) break
    // 提前出手：决定性优势（只在大优时退出；大劣保持深搜寻找翻盘机会）
    if (decisiveCfg && d >= decisiveCfg.minDepth && bestScore >= decisiveCfg.score) break
    // 提前出手：最佳着法连续多轮稳定且局面非极均势
    if (stableCfg && d >= stableCfg.minDepth && stableRuns >= stableCfg.runs &&
      (stableCfg.minAbsScore == null || Math.abs(bestScore) >= stableCfg.minAbsScore)) break
    d++
  }

  return bestMove
}

// 检查是否被将死或困毙
export function isGameOver(board: Board, side: Side): boolean {
  const status = getGameStatus(board, side)
  return status === 'checkmate' || status === 'stalemate'
}
