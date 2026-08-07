// 中国象棋核心类型定义（纯数据，零 Vue/DOM 依赖）
// 棋盘坐标：10 行 × 9 列，board[row][col]
// 红方在下（row 7-9），黑方在上（row 0-2）

export type Side = 'red' | 'black'

export type PieceType = 'king' | 'advisor' | 'elephant' | 'horse' | 'rook' | 'cannon' | 'pawn'

export interface Piece {
  type: PieceType
  side: Side
}

export type Board = (Piece | null)[][]

export interface Position {
  row: number
  col: number
}

export interface Move {
  from: Position
  to: Position
  captured?: Piece
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate'

// 走法三态分类：合法 / 符合走子规则但走后会送将（被送将规则拦截）/ 不符合走法
export type MoveClass = 'legal' | 'exposes-general' | 'illegal'

export interface GameRecord {
  moves: Move[]
  sides: Side[]
}

export const ROWS = 10
export const COLS = 9

// 九宫格边界
export const RED_PALACE = { minRow: 7, maxRow: 9, minCol: 3, maxCol: 5 }
export const BLACK_PALACE = { minRow: 0, maxRow: 2, minCol: 3, maxCol: 5 }

export function isInPalace(pos: Position, side: Side): boolean {
  const palace = side === 'red' ? RED_PALACE : BLACK_PALACE
  return pos.row >= palace.minRow && pos.row <= palace.maxRow &&
         pos.col >= palace.minCol && pos.col <= palace.maxCol
}

export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(cell => cell ? { ...cell } : null))
}

// 点击坐标 → 行/列索引：以交叉点为中心对齐命中区（±半格）。
// 必须用 round 而非 floor：floor 会把命中区整体平移半格，
// 表现为「必须点到交叉点下方才选中棋子」的纵向偏移 bug。
export function indexFromOffset(offset: number, pad: number, cell: number, count: number): number | null {
  if (cell <= 0) return null
  const idx = Math.round((offset - pad) / cell)
  if (idx < 0 || idx >= count) return null
  return idx
}

// 视角翻转映射：棋盘行列索引 180° 翻转（i ↔ count-1-i）。
// 仅用于渲染/命中层（联机黑方视角），引擎层 board 数组坐标不变。
// 自反性：flipIndex(flipIndex(i, n), n) === i，渲染与命中用同一函数保证点哪打哪。
export function flipIndex(index: number, count: number): number {
  return count - 1 - index
}
