// 中国象棋 AI：Negamax + Alpha-Beta + 静态搜索 + 迭代加深
//
// 核心机制：
// - MVV-LVA 走法排序（吃子按 被害子价值*10 - 攻击子价值 排序）提升剪枝效率
// - 静态搜索（Quiescence）：叶子节点沿吃子线延伸，消除水平线效应
//   （避免"吃子后立刻被反吃"的误判；被将时延伸所有应将着法）
// - 迭代加深 + 可选时限：在时限内逐层加深，超时保留上一层结果
// - 杀棋距离分：越快将死分越高，避免拖延取胜

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

function getPositionBonus(piece: Piece, row: number, col: number): number {
  const table = POSITION_BONUS[piece.type]
  if (!table) return 0
  const r = piece.side === 'red' ? row : ROWS - 1 - row
  return table[r][col]
}

// 评估函数：从红方视角（正=红优势，负=黑优势）
function evaluateBoard(board: Board): number {
  let score = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p) continue
      const value = PIECE_VALUE[p.type] + getPositionBonus(p, r, c)
      score += p.side === 'red' ? value : -value
    }
  }
  return score
}

function opposite(side: Side): Side {
  return side === 'red' ? 'black' : 'red'
}

// 走法排序分：MVV-LVA（大子吃小子优先），非吃子按位置增益做次级排序
function moveOrderScore(board: Board, move: Move): number {
  const victim = board[move.to.row][move.to.col]
  const attacker = board[move.from.row][move.from.col]
  if (!attacker) return 0
  if (victim) {
    return 100000 + PIECE_VALUE[victim.type] * 10 - PIECE_VALUE[attacker.type]
  }
  return getPositionBonus(attacker, move.to.row, move.to.col) -
    getPositionBonus(attacker, move.from.row, move.from.col)
}

function orderMoves(moves: Move[], board: Board): Move[] {
  return [...moves].sort((a, b) => moveOrderScore(board, b) - moveOrderScore(board, a))
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

// ---- 搜索状态（模块级，单次 findBestMove 内共享） ----
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

  const inCheck = isInCheck(board, side)
  const standPat = side === 'red' ? evaluateBoard(board) : -evaluateBoard(board)

  if (!inCheck) {
    if (standPat >= beta) return standPat
    if (standPat > alpha) alpha = standPat
    if (qdepth <= 0) return standPat
  }

  let moves = generateMoves(board, side)
  if (moves.length === 0) {
    // 无子可走：象棋中困毙也判负
    return -(MATE - ply)
  }
  if (!inCheck) {
    moves = moves.filter(m => board[m.to.row][m.to.col] !== null)
    if (moves.length === 0) return standPat
  }

  const ordered = orderMoves(moves, board)
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
 */
function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  side: Side,
  ply: number
): number {
  searchNodes++
  tickTimeout()

  if (depth <= 0) {
    return quiescence(board, alpha, beta, side, ply, MAX_QUIESCENCE_DEPTH)
  }

  const moves = orderMoves(generateMoves(board, side), board)
  if (moves.length === 0) {
    // 被将死或困毙都算负；越快被杀分越低（偏好拖延），反之偏好速杀
    return -(MATE - ply)
  }

  let best = -Infinity
  for (const move of moves) {
    const score = -negamax(applyMoveForAI(board, move), depth - 1, -beta, -alpha, opposite(side), ply + 1)
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
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

  searchDeadline = timeLimitMs !== undefined ? Date.now() + timeLimitMs : Infinity
  searchNodes = 0

  let ordered = orderMoves(rootMoves, board)
  let bestMove: Move = ordered[0]

  for (let d = 1; d <= depth; d++) {
    let alpha = -Infinity
    let bestAtDepth: Move | null = null
    let bestScore = -Infinity

    try {
      for (const move of ordered) {
        const score = -negamax(applyMoveForAI(board, move), d - 1, -Infinity, -alpha, opposite(side), 1)
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
      ordered = [bestMove, ...ordered.filter(m => m !== bestMove)]
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
