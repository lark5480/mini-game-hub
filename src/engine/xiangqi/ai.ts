// 中国象棋 AI：Negamax + Alpha-Beta + 静态搜索 + 迭代加深
//
// 核心机制：
// - MVV-LVA 走法排序（吃子按 被害子价值*10 - 攻击子价值 排序）提升剪枝效率
// - 静态搜索（Quiescence）：叶子节点沿吃子线延伸，消除水平线效应
//   （避免"吃子后立刻被反吃"的误判；被将时延伸所有应将着法）
// - 迭代加深 + 可选时限：在时限内逐层加深，超时保留上一层结果
// - 杀棋距离分：越快将死分越高，避免拖延取胜
// - 置换表（Transposition Table）：缓存已搜索局面，层间复用，同等时限搜更深
// - Killer moves + History heuristic：非吃子着法排序增强，提升剪枝效率
// - 晚移约减（LMR）：排序靠后的非吃子/非将军着法减 1 层试搜，突破 alpha 再重搜
// - 重复局面规避：搜索路径内局面重复 >= 2 次给予强负分，避免 AI 主动长将/长捉被判负
// - 评估增强：子力 + PST + 机动性（双方走法数差）+ 王安全（将帅受威胁）

import { Side, PieceType, Piece, Board, Move, ROWS, COLS } from './types'
import { generateMoves, getGameStatus, isInCheck } from './rules'

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
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [10, 10, 20, 30, 30, 30, 20, 10, 10],
    [20, 20, 30, 40, 40, 40, 30, 20, 20],
    [30, 30, 40, 50, 50, 50, 40, 30, 30],
    [40, 40, 50, 60, 60, 60, 50, 40, 40],
    [50, 50, 60, 70, 70, 70, 60, 50, 50],
    [60, 60, 70, 80, 80, 80, 70, 60, 60],
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
// 静态搜索最大延伸半步数（防止吃子长链爆炸）
const MAX_QUIESCENCE_DEPTH = 12

// ---- 评估权重 ----
// 机动性：每步走法数差值（红方视角）
const MOBILITY_WEIGHT = 4
// 王安全：将/帅九宫邻格被攻击（每格）与本身被将军的减分
const KING_THREAT_PENALTY = 40
const KING_CHECK_PENALTY = 60

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
// 每格 1 字符：'.' 空；红方大写、黑方小写（type 首字母唯一：K/R/C/H/E/A/P）
const TYPE_UPPER: Record<PieceType, string> = {
  king: 'K', rook: 'R', cannon: 'C', horse: 'H', elephant: 'E', advisor: 'A', pawn: 'P'
}
const TYPE_LOWER: Record<PieceType, string> = {
  king: 'k', rook: 'r', cannon: 'c', horse: 'h', elephant: 'e', advisor: 'a', pawn: 'p'
}

function boardKey(board: Board): string {
  const chars = new Array(ROWS * COLS)
  let i = 0
  for (let r = 0; r < ROWS; r++) {
    const row = board[r]
    for (let c = 0; c < COLS; c++) {
      const p = row[c]
      chars[i++] = p ? (p.side === 'red' ? TYPE_UPPER[p.type] : TYPE_LOWER[p.type]) : '.'
    }
  }
  return chars.join('')
}

// ---- 搜索状态（模块级，单次 findBestMove 内共享）----
let searchNodes = 0
let searchDeadline = Infinity

class SearchTimeout extends Error {
  constructor() {
    super('search timeout')
  }
}

function tickTimeout(): void {
  // 每 1024 节点检查一次时间，降低 Date.now() 开销
  if ((searchNodes & 1023) === 0 && Date.now() > searchDeadline) {
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
let tt = new Map<string, TTEntry>()

// ---- Killer moves（按 ply 至多 2 个）----
const MAX_PLY = 40
let killerMoves: (Move | null)[][] = Array.from({ length: MAX_PLY }, () => [null, null])

// ---- History heuristic（跨层共享的着法加分表）----
let historyTable = new Int32Array(ROWS * COLS * ROWS * COLS)

function histIndex(move: Move): number {
  return (move.from.row * COLS + move.from.col) * (ROWS * COLS) + move.to.row * COLS + move.to.col
}

function sameMove(a: Move, b: Move): boolean {
  return a.from.row === b.from.row && a.from.col === b.from.col &&
    a.to.row === b.to.row && a.to.col === b.to.col
}

// 评估函数：从红方视角（正=红优势，负=黑优势）
// mobilityScore：机动性分（红方视角），由搜索叶子传入（双方走法数差 * 权重）
function evaluateBoard(board: Board, mobilityScore = 0): number {
  let score = mobilityScore
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue
      const value = PIECE_VALUE[p.type] + getPositionBonus(p, r, c)
      score += p.side === 'red' ? value : -value
    }
  }
  score += kingSafetyScore(board)
  return score
}

// ---- 王安全：将/帅本身被将军 + 九宫邻格被攻击数 ----
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

function kingSafetyScore(board: Board): number {
  let score = 0
  const redKing = findKing(board, 'red')
  const blackKing = findKing(board, 'black')
  if (redKing) {
    if (isSquareAttacked(board, redKing.row, redKing.col, 'black')) score -= KING_CHECK_PENALTY
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = redKing.row + dr
      const cc = redKing.col + dc
      if (rr >= 7 && rr <= 9 && cc >= 3 && cc <= 5 && isSquareAttacked(board, rr, cc, 'black')) score -= KING_THREAT_PENALTY
    }
  }
  if (blackKing) {
    if (isSquareAttacked(board, blackKing.row, blackKing.col, 'red')) score += KING_CHECK_PENALTY
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const rr = blackKing.row + dr
      const cc = blackKing.col + dc
      if (rr >= 0 && rr <= 2 && cc >= 3 && cc <= 5 && isSquareAttacked(board, rr, cc, 'red')) score += KING_THREAT_PENALTY
    }
  }
  return score
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
  const killers = killerMoves[ply]
  if (killers[0] && sameMove(move, killers[0])) return SCORE_KILLER
  if (killers[1] && sameMove(move, killers[1])) return SCORE_KILLER - 1
  const h = historyTable[histIndex(move)]
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
function applyMoveForAI(board: Board, move: Move): Board {
  const newBoard = board.map(row => row.slice())
  const piece = newBoard[move.from.row][move.from.col]
  newBoard[move.to.row][move.to.col] = piece
  newBoard[move.from.row][move.from.col] = null
  return newBoard
}

/**
 * 静态搜索：只沿吃子线延伸，消除水平线效应。
 * 返回值为「当前走子方 side」视角的分数（negamax 约定）。
 * 被将时不能 stand-pat，必须搜索所有应将着法。
 * mobilityScore / leafMoves 仅由 negamax 叶子传入（机动性评估 + 复用已生成的着法）。
 */
function quiescence(
  board: Board,
  alpha: number,
  beta: number,
  side: Side,
  ply: number,
  qdepth: number,
  mobilityScore = 0,
  leafMoves?: Move[]
): number {
  searchNodes++
  tickTimeout()

  const inCheck = isInCheck(board, side)
  const standPat = (side === 'red' ? evaluateBoard(board, mobilityScore) : -evaluateBoard(board, mobilityScore))

  if (!inCheck) {
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat
    if (qdepth <= 0) return standPat
  }

  let moves = leafMoves !== undefined ? leafMoves : generateMoves(board, side)
  if (moves.length === 0) {
    // 无子可走：象棋中困毙也判负
    return -(MATE - ply)
  }
  if (!inCheck) {
    moves = moves.filter(m => board[m.to.row][m.to.col] !== null)
    if (moves.length === 0) return standPat
  }

  const ordered = orderMoves(board, moves, ply)
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
 */
function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  side: Side,
  ply: number,
  repPath: string[]
): number {
  searchNodes++
  tickTimeout()

  const key = boardKey(board)

  // 重复局面规避：路径中已出现 2 次 → 视为循环，给强负分（AI 不主动走进长将/长捉被判负）
  let repeats = 0
  for (let i = 0; i < repPath.length; i++) {
    if (repPath[i] === key && ++repeats >= 2) return -(Math.floor(MATE / 2) - ply)
  }

  // 置换表
  const entry = tt.get(key)
  if (entry && entry.depth >= depth) {
    if (entry.flag === 0) return entry.score
    if (entry.flag === 1 && entry.score >= beta) return entry.score
    if (entry.flag === 2 && entry.score <= alpha) return entry.score
  }

  if (depth <= 0) {
    // 叶子：生成双方走法计算机动性（红方视角），当前方着法传入静态搜索复用
    const redMoves = generateMoves(board, 'red')
    const blackMoves = generateMoves(board, 'black')
    const mobility = (redMoves.length - blackMoves.length) * MOBILITY_WEIGHT
    return quiescence(board, alpha, beta, side, ply, MAX_QUIESCENCE_DEPTH, mobility, side === 'red' ? redMoves : blackMoves)
  }

  repPath.push(key)
  const moves = orderMoves(board, generateMoves(board, side), ply, entry ? entry.move : null)
  if (moves.length === 0) {
    repPath.pop()
    // 被将死或困毙都算负；越快被杀分越低（偏好拖延），反之偏好速杀
    return -(MATE - ply)
  }

  let best = -Infinity
  let bestMove: Move | null = null
  const alpha0 = alpha
  let flag: TTFlag = 0

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i]
    const newBoard = applyMoveForAI(board, move)
    const isCapture = board[move.to.row][move.to.col] !== null
    let score: number

    if (depth >= 3 && i >= 4 && !isCapture && !isInCheck(newBoard, opposite(side))) {
      // LMR：排序靠后的非吃子/非将军着法减 1 层试搜；突破 alpha 再全深度重搜
      score = -negamax(newBoard, depth - 2, -beta, -alpha, opposite(side), ply + 1, repPath)
      if (score > alpha) {
        score = -negamax(newBoard, depth - 1, -beta, -alpha, opposite(side), ply + 1, repPath)
      }
    } else {
      score = -negamax(newBoard, depth - 1, -beta, -alpha, opposite(side), ply + 1, repPath)
    }

    if (score > best) {
      best = score
      bestMove = move
    }
    if (score > alpha) alpha = score
    if (alpha >= beta) {
      // beta 剪枝：非吃子着法记录 killer + history（加速后续同层排序）
      if (!isCapture) {
        const killers = killerMoves[ply]
        const isNewKiller = !(killers[0] && sameMove(move, killers[0])) &&
          !(killers[1] && sameMove(move, killers[1]))
        if (isNewKiller) {
          killers[1] = killers[0]
          killers[0] = move
        }
        historyTable[histIndex(move)] += depth * depth
      }
      flag = 1
      break
    }
  }
  repPath.pop()

  if (best <= alpha0) flag = 2
  else if (best >= beta) flag = 1
  else flag = 0

  tt.set(key, { depth, score: best, flag, move: bestMove })
  return best
}

/**
 * 选择最佳走法（公共接口，兼容旧签名）。
 * @param depth    最大搜索深度（迭代加深的上限）
 * @param timeLimitMs 可选时限：超时后返回已完成深度的最佳着法
 */
export function findBestMove(board: Board, side: Side, depth = 3, timeLimitMs?: number): Move | null {
  const rootMoves = generateMoves(board, side)
  if (rootMoves.length === 0) return null
  if (rootMoves.length === 1) return rootMoves[0]

  // 搜索状态重置（置换表 / killer / history 均为单次搜索内共享）
  tt.clear()
  killerMoves = Array.from({ length: MAX_PLY }, () => [null, null])
  historyTable.fill(0)
  searchDeadline = timeLimitMs !== undefined ? Date.now() + timeLimitMs : Infinity
  searchNodes = 0

  let ordered = orderMoves(board, rootMoves, 0)
  let bestMove: Move = ordered[0]
  // 重复局面检测路径：以初始局面为根（根着法后若回到初始局面即可检出）
  const repPath = [boardKey(board)]

  for (let d = 1; d <= depth; d++) {
    let alpha = -Infinity
    let bestAtDepth: Move | null = null
    let bestScore = -Infinity

    try {
      for (const move of ordered) {
        const score = -negamax(applyMoveForAI(board, move), d - 1, -Infinity, -alpha, opposite(side), 1, repPath)
        if (score > bestScore) {
          bestScore = score
          bestAtDepth = move
        }
        if (score > alpha) alpha = score
      }
    } catch (e) {
      if (e instanceof SearchTimeout) break // 本层未完成，保留上一层结果
      throw e
    }

    if (bestAtDepth) {
      bestMove = bestAtDepth
      // 上一层最佳着法置顶，提升下一层剪枝效率
      ordered = [bestMove, ...ordered.filter(m => !sameMove(m, bestMove))]
    }
    // 已找到杀棋（或必败），无需再加深
    if (bestScore >= MATE - 1000 || bestScore <= -(MATE - 1000)) break
  }

  return bestMove
}

// 检查是否被将死或困毙
export function isGameOver(board: Board, side: Side): boolean {
  const status = getGameStatus(board, side)
  return status === 'checkmate' || status === 'stalemate'
}
