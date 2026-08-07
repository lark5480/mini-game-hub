// 中国象棋规则引擎（纯函数，零 Vue/DOM 依赖）
// 所有函数均为纯函数，不修改输入参数

import {
  Side, PieceType, Piece, Board, Position, Move, GameStatus, MoveClass,
  ROWS, COLS, isInPalace, cloneBoard
} from './types'

// ============================================================
// 初始棋盘布局
// ============================================================

function createPiece(type: PieceType, side: Side): Piece {
  return { type, side }
}

export function initialBoard(): Board {
  const board: Board = Array.from({ length: ROWS }, () => Array(COLS).fill(null))

  // 黑方（上方，row 0-2）
  const backRow: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook']
  for (let c = 0; c < COLS; c++) {
    board[0][c] = createPiece(backRow[c], 'black')
  }
  // 黑方炮 (2,1) 和 (2,7)
  board[2][1] = createPiece('cannon', 'black')
  board[2][7] = createPiece('cannon', 'black')
  // 黑方卒 (3,0), (3,2), (3,4), (3,6), (3,8)
  board[3][0] = createPiece('pawn', 'black')
  board[3][2] = createPiece('pawn', 'black')
  board[3][4] = createPiece('pawn', 'black')
  board[3][6] = createPiece('pawn', 'black')
  board[3][8] = createPiece('pawn', 'black')

  // 红方（下方，row 7-9）
  const redBackRow: PieceType[] = ['rook', 'horse', 'elephant', 'advisor', 'king', 'advisor', 'elephant', 'horse', 'rook']
  for (let c = 0; c < COLS; c++) {
    board[9][c] = createPiece(redBackRow[c], 'red')
  }
  // 红方炮 (7,1) 和 (7,7)
  board[7][1] = createPiece('cannon', 'red')
  board[7][7] = createPiece('cannon', 'red')
  // 红方兵 (6,0), (6,2), (6,4), (6,6), (6,8)
  board[6][0] = createPiece('pawn', 'red')
  board[6][2] = createPiece('pawn', 'red')
  board[6][4] = createPiece('pawn', 'red')
  board[6][6] = createPiece('pawn', 'red')
  board[6][8] = createPiece('pawn', 'red')

  return board
}

// ============================================================
// 辅助函数
// ============================================================

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < ROWS && col >= 0 && col < COLS
}

function isRiverCrossed(row: number, side: Side): boolean {
  return side === 'red' ? row <= 4 : row >= 5
}

// ============================================================
// 棋子走法生成（不考虑送将）
// ============================================================

function generateKingMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr
    const nc = pos.col + dc
    if (!inBounds(nr, nc)) continue
    if (!isInPalace({ row: nr, col: nc }, side)) continue
    const target = board[nr][nc]
    if (target && target.side === side) continue
    moves.push({ row: nr, col: nc })
  }
  return moves
}

function generateAdvisorMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr
    const nc = pos.col + dc
    if (!inBounds(nr, nc)) continue
    if (!isInPalace({ row: nr, col: nc }, side)) continue
    const target = board[nr][nc]
    if (target && target.side === side) continue
    moves.push({ row: nr, col: nc })
  }
  return moves
}

function generateElephantMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const dirs = [[2, 2], [2, -2], [-2, 2], [-2, -2]]
  for (const [dr, dc] of dirs) {
    const nr = pos.row + dr
    const nc = pos.col + dc
    if (!inBounds(nr, nc)) continue
    // 不能过河
    if (side === 'red' && nr < 5) continue
    if (side === 'black' && nr > 4) continue
    // 塞象眼
    const eyeRow = pos.row + dr / 2
    const eyeCol = pos.col + dc / 2
    if (board[eyeRow][eyeCol] !== null) continue
    const target = board[nr][nc]
    if (target && target.side === side) continue
    moves.push({ row: nr, col: nc })
  }
  return moves
}

function generateHorseMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  // 蹩马腿规则：马走日字，先沿一个方向走1格（蹩马腿位置），再斜走1格（落点）
  // leg = 蹩马腿位置（马先走1格的方向），jump = 跳跃目标（日字对角）
  const horseOffsets = [
    { leg: [-1, 0], jumps: [-2, -1] },   // 往上走1格，再往左跳
    { leg: [-1, 0], jumps: [-2, 1] },    // 往上走1格，再往右跳
    { leg: [1, 0], jumps: [2, -1] },     // 往下走1格，再往左跳
    { leg: [1, 0], jumps: [2, 1] },      // 往下走1格，再往右跳
    { leg: [0, -1], jumps: [-1, -2] },   // 往左走1格，再往上跳
    { leg: [0, -1], jumps: [1, -2] },    // 往左走1格，再往下跳
    { leg: [0, 1], jumps: [-1, 2] },     // 往右走1格，再往上跳
    { leg: [0, 1], jumps: [1, 2] }       // 往右走1格，再往下跳
  ]
  for (const { leg, jumps } of horseOffsets) {
    const legRow = pos.row + leg[0]
    const legCol = pos.col + leg[1]
    if (!inBounds(legRow, legCol)) continue
    // 蹩马腿
    if (board[legRow][legCol] !== null) continue
    const nr = pos.row + jumps[0]
    const nc = pos.col + jumps[1]
    if (!inBounds(nr, nc)) continue
    const target = board[nr][nc]
    if (target && target.side === side) continue
    moves.push({ row: nr, col: nc })
  }
  return moves
}

function generateRookMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
  for (const [dr, dc] of dirs) {
    let nr = pos.row + dr
    let nc = pos.col + dc
    while (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (target === null) {
        moves.push({ row: nr, col: nc })
      } else {
        if (target.side !== side) moves.push({ row: nr, col: nc })
        break
      }
      nr += dr
      nc += dc
    }
  }
  return moves
}

function generateCannonMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]]
  for (const [dr, dc] of dirs) {
    let nr = pos.row + dr
    let nc = pos.col + dc
    let jumped = false
    while (inBounds(nr, nc)) {
      const target = board[nr][nc]
      if (!jumped) {
        if (target === null) {
          moves.push({ row: nr, col: nc })
        } else {
          jumped = true
        }
      } else {
        if (target !== null) {
          if (target.side !== side) moves.push({ row: nr, col: nc })
          break
        }
      }
      nr += dr
      nc += dc
    }
  }
  return moves
}

function generatePawnMoves(board: Board, pos: Position, side: Side): Position[] {
  const moves: Position[] = []
  const crossed = isRiverCrossed(pos.row, side)

  // 前进方向
  const forward = side === 'red' ? -1 : 1
  const nr = pos.row + forward
  if (inBounds(nr, pos.col)) {
    const target = board[nr][pos.col]
    if (!target || target.side !== side) moves.push({ row: nr, col: pos.col })
  }

  // 过河后可左右
  if (crossed) {
    for (const dc of [-1, 1]) {
      const nc = pos.col + dc
      if (!inBounds(pos.row, nc)) continue
      const target = board[pos.row][nc]
      if (!target || target.side !== side) moves.push({ row: pos.row, col: nc })
    }
  }

  return moves
}

function generatePseudoMoves(board: Board, pos: Position): Position[] {
  const piece = board[pos.row][pos.col]
  if (!piece) return []

  switch (piece.type) {
    case 'king': return generateKingMoves(board, pos, piece.side)
    case 'advisor': return generateAdvisorMoves(board, pos, piece.side)
    case 'elephant': return generateElephantMoves(board, pos, piece.side)
    case 'horse': return generateHorseMoves(board, pos, piece.side)
    case 'rook': return generateRookMoves(board, pos, piece.side)
    case 'cannon': return generateCannonMoves(board, pos, piece.side)
    case 'pawn': return generatePawnMoves(board, pos, piece.side)
  }
}

// ============================================================
// 将帅位置查找
// ============================================================

function findKing(board: Board, side: Side): Position | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (p && p.type === 'king' && p.side === side) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

// ============================================================
// 将军检测
// ============================================================

export function isInCheck(board: Board, side: Side): boolean {
  const kingPos = findKing(board, side)
  if (!kingPos) return false

  // 检查所有敌方棋子是否能攻击到将/帅
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p || p.side === side) continue
      const moves = generatePseudoMoves(board, { row: r, col: c })
      for (const m of moves) {
        if (m.row === kingPos.row && m.col === kingPos.col) {
          return true
        }
      }
    }
  }

  // 飞将检测：将帅同列无阻隔
  const enemyKing = findKing(board, side === 'red' ? 'black' : 'red')
  if (enemyKing && kingPos.col === enemyKing.col) {
    const minR = Math.min(kingPos.row, enemyKing.row)
    const maxR = Math.max(kingPos.row, enemyKing.row)
    let blocked = false
    for (let r = minR + 1; r < maxR; r++) {
      if (board[r][kingPos.col] !== null) {
        blocked = true
        break
      }
    }
    if (!blocked) return true
  }

  return false
}

// ============================================================
// 走子应用
// ============================================================

export function applyMove(board: Board, move: Move): Board {
  const newBoard = cloneBoard(board)
  const piece = newBoard[move.from.row][move.from.col]
  if (!piece) return newBoard

  newBoard[move.to.row][move.to.col] = piece
  newBoard[move.from.row][move.from.col] = null
  return newBoard
}

// ============================================================
// 合法走法生成（过滤送将）
// ============================================================

export function generateMoves(board: Board, side: Side): Move[] {
  const moves: Move[] = []

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c]
      if (!p || p.side !== side) continue
      const from = { row: r, col: c }
      const pseudoMoves = generatePseudoMoves(board, from)
      for (const to of pseudoMoves) {
        const move: Move = { from, to }
        const newBoard = applyMove(board, move)
        // 过滤送将：走完后己方将/帅不得被攻击
        if (!isInCheck(newBoard, side)) {
          const captured = board[to.row][to.col] || undefined
          moves.push({ from, to, captured })
        }
      }
    }
  }

  return moves
}

// ============================================================
// 单步走子合法性检查
// ============================================================

export function isLegalMove(board: Board, from: Position, to: Position): boolean {
  const piece = board[from.row][from.col]
  if (!piece) return false
  const moves = generateMoves(board, piece.side)
  return moves.some(m => m.from.row === from.row && m.from.col === from.col &&
                          m.to.row === to.row && m.to.col === to.col)
}

// ============================================================
// 走法三态分类（送将拦截提示用）
// ============================================================

/**
 * 分类一步走法：
 *  - 'legal'：合法走法
 *  - 'exposes-general'：符合该棋子走子规则，但走完后己方将/帅被将军（送将，被拦截）
 *  - 'illegal'：根本不符合走子规则（起点无子/原地不动/非该棋子走法）
 * 复用 generatePseudoMoves / applyMove / isInCheck，不重写走法生成。
 */
export function classifyMove(board: Board, from: Position, to: Position): MoveClass {
  const piece = board[from.row][from.col]
  if (!piece) return 'illegal'
  if (from.row === to.row && from.col === to.col) return 'illegal'
  const pseudo = generatePseudoMoves(board, from)
  if (!pseudo.some(p => p.row === to.row && p.col === to.col)) return 'illegal'
  return isInCheck(applyMove(board, { from, to }), piece.side) ? 'exposes-general' : 'legal'
}

/**
 * 棋子是否被完全钉死：有伪合法走法，但每一步走完都会送将，
 * 即一条真正合法的走法都没有（选中时无任何绿点的原因）。
 */
export function isPinned(board: Board, pos: Position): boolean {
  const piece = board[pos.row][pos.col]
  if (!piece) return false
  const pseudo = generatePseudoMoves(board, pos)
  if (pseudo.length === 0) return false
  return pseudo.every(to => isInCheck(applyMove(board, { from: pos, to }), piece.side))
}

// ============================================================
// 游戏状态判定
// ============================================================

export function getGameStatus(board: Board, sideToMove: Side): GameStatus {
  const moves = generateMoves(board, sideToMove)
  const inCheck = isInCheck(board, sideToMove)

  if (moves.length === 0) {
    return inCheck ? 'checkmate' : 'stalemate'
  }

  return inCheck ? 'check' : 'playing'
}
