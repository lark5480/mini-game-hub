// 中国象棋中文记谱（纯函数，零 Vue/DOM 依赖）
// 规则：以该方自身视角从右到左记列序 一~九；横向记落列、纵向记步数

import { Side, PieceType, Board, Move, Position } from './types'

const CHINESE_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']

const RED_NAMES: Record<PieceType, string> = {
  king: '帥', advisor: '仕', elephant: '相', horse: '馬',
  rook: '車', cannon: '炮', pawn: '兵'
}
const BLACK_NAMES: Record<PieceType, string> = {
  king: '將', advisor: '士', elephant: '象', horse: '馬',
  rook: '車', cannon: '炮', pawn: '卒'
}

function getPieceName(type: PieceType, side: Side): string {
  return side === 'red' ? RED_NAMES[type] : BLACK_NAMES[type]
}

/**
 * 列序：以该方自身视角从右到左记 一~九。
 * 红方（row 7-9）：redCol = 9 - col（col=8 → 一，col=0 → 九）
 * 黑方（row 0-2）：blackCol = col + 1（col=0 → 一，col=8 → 九）
 */
function getColumnNum(pos: Position, side: Side): number {
  return side === 'red' ? 9 - pos.col : pos.col + 1
}

/**
 * 将一步走法转换为中文记谱字符串（如「炮二平五」「马八進七」）。
 * 纯函数：输入 Move + Board，输出 string，零 Vue/DOM 依赖。
 *
 * 规则：
 * - 平（横向移动）：<名><起列><平><落列>
 * - 進/退：车/炮/兵/帅跟步数（纵向格数）；马/象/士跟落点列
 * - 進：朝对方阵营方向（红方 row 减小，黑方 row 增大）
 * - 退：背向对方阵营方向
 */
export function toNotation(move: Move, board: Board): string {
  const piece = board[move.from.row][move.from.col]
  if (!piece) return ''

  const name = getPieceName(piece.type, piece.side)
  const fromCol = getColumnNum(move.from, piece.side)
  const toCol = getColumnNum(move.to, piece.side)
  const dr = move.to.row - move.from.row

  // 平（横向移动，row 不变）
  if (dr === 0) {
    return `${name}${CHINESE_NUM[fromCol]}平${CHINESE_NUM[toCol]}`
  }

  // 進 / 退
  const forward = piece.side === 'red' ? dr < 0 : dr > 0
  const verb = forward ? '進' : '退'

  // 车/炮/兵/帅：進/退后跟步数（纵向格数）
  if (piece.type === 'rook' || piece.type === 'cannon' ||
      piece.type === 'king' || piece.type === 'pawn') {
    const steps = Math.abs(dr)
    return `${name}${CHINESE_NUM[fromCol]}${verb}${CHINESE_NUM[steps]}`
  }

  // 马/象/士：進/退后跟落点列
  return `${name}${CHINESE_NUM[fromCol]}${verb}${CHINESE_NUM[toCol]}`
}
