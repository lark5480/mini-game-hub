// 中国象棋 AI：Minimax + Alpha-Beta 剪枝
// 子力价值表 + 位置加成，深度 2-3

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

// 走法排序：优先吃子（MVV-LVA 简化）
function orderMoves(moves: Move[], board: Board): Move[] {
  return [...moves].sort((a, b) => {
    const captureA = board[a.to.row][a.to.col]
    const captureB = board[b.to.row][b.to.col]
    const scoreA = captureA ? PIECE_VALUE[captureA.type] : 0
    const scoreB = captureB ? PIECE_VALUE[captureB.type] : 0
    return scoreB - scoreA
  })
}

function applyMoveForAI(board: Board, move: Move): Board {
  const newBoard = board.map(row => row.slice())
  const piece = newBoard[move.from.row][move.from.col]
  newBoard[move.to.row][move.to.col] = piece
  newBoard[move.from.row][move.from.col] = null
  return newBoard
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): number {
  if (depth === 0) {
    return evaluateBoard(board)
  }

  const side: Side = maximizing ? 'red' : 'black'
  const moves = generateMoves(board, side)

  if (moves.length === 0) {
    return maximizing ? -99999 + (10 - depth) : 99999 - (10 - depth)
  }

  const ordered = orderMoves(moves, board)

  if (maximizing) {
    let maxEval = -Infinity
    for (const move of ordered) {
      const newBoard = applyMoveForAI(board, move)
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, false)
      maxEval = Math.max(maxEval, evalScore)
      alpha = Math.max(alpha, evalScore)
      if (beta <= alpha) break
    }
    return maxEval
  } else {
    let minEval = Infinity
    for (const move of ordered) {
      const newBoard = applyMoveForAI(board, move)
      const evalScore = minimax(newBoard, depth - 1, alpha, beta, true)
      minEval = Math.min(minEval, evalScore)
      beta = Math.min(beta, evalScore)
      if (beta <= alpha) break
    }
    return minEval
  }
}

// 公共接口：选择最佳走法
export function findBestMove(board: Board, side: Side, depth = 3): Move | null {
  const moves = generateMoves(board, side)
  if (moves.length === 0) return null

  const maximizing = side === 'red'
  const ordered = orderMoves(moves, board)

  let bestMove: Move | null = null
  let bestScore = maximizing ? -Infinity : Infinity
  let alpha = -Infinity
  let beta = Infinity

  for (const move of ordered) {
    const newBoard = applyMoveForAI(board, move)
    const score = minimax(newBoard, depth - 1, alpha, beta, !maximizing)

    if (maximizing) {
      if (score > bestScore) {
        bestScore = score
        bestMove = move
      }
      alpha = Math.max(alpha, score)
    } else {
      if (score < bestScore) {
        bestScore = score
        bestMove = move
      }
      beta = Math.min(beta, score)
    }
  }

  return bestMove || ordered[0]
}

// 检查是否被将死或困毙
export function isGameOver(board: Board, side: Side): boolean {
  const status = getGameStatus(board, side)
  return status === 'checkmate' || status === 'stalemate'
}
