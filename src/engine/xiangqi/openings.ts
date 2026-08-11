// 中国象棋 AI 开局库：手工 UCCI 主变棋谱 → 局面哈希表（bigint key → 着法池）。
// - 查表在视图层（主线程）调用：命中直接走，零搜索延迟；未命中才进 Worker 搜索。
// - 构建期用 generateMoves 自检每个着法合法，棋谱笔误立即抛错暴露。
// - 同局面多着法随机选一，避免每局开局雷同。
import { boardKey } from './ai'
import { initialBoard, applyMove, generateMoves } from './rules'
import type { Board, Side, Move } from './types'

// UCCI 坐标 → 代码坐标：列 a-i（a=红方视角最右=代码 col 8），行 0-9（0=红方底线=代码 row 9）
function ucciToMove(s: string): Move {
  const c1 = 8 - (s.charCodeAt(0) - 97), r1 = 9 - (s.charCodeAt(1) - 48)
  const c2 = 8 - (s.charCodeAt(2) - 97), r2 = 9 - (s.charCodeAt(3) - 48)
  return { from: { row: r1, col: c1 }, to: { row: r2, col: c2 } }
}

function samePos(a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  return a.row === b.row && a.col === b.col
}

// 主变棋谱（UCCI，红黑交替，均红先）。覆盖：中炮对屏风马（直车/进七兵）、顺炮、
// 列炮、单提马、反宫马、仙人指路对卒底炮、飞相局。
const LINES = [
  'b2e2 b9c7 b0c2 a9b9 a0b0 h9g7', // 中炮直车对屏风马（炮二平五 马8进7 马二进三 车9平8 车一平二 马2进3）
  'b2e2 b9c7 g3g4 c6c5 b0c2 h9g7 a0b0 a9b9', // 中炮进七兵对屏风马
  'b2e2 b7e7 b0c2 b9c7 a0b0 a9a8', // 中炮对顺炮（横车）
  'b2e2 h7e7 b0c2 b9a7 a0b0 a9b9', // 中炮对列炮
  'b2e2 h9g7 b0c2 b9a7', // 中炮对单提马
  'b2e2 h9g7 b0c2 b7d7 a0b0 b9c7', // 中炮对反宫马
  'g3g4 h7g7 b2e2 b9c7 b0c2 a9b9', // 仙人指路对卒底炮
  'c0e2 b9c7 c3c4 g6g5', // 飞相局
]

function buildOpeningTable(): Map<bigint, Move[]> {
  const table = new Map<bigint, Move[]>()
  for (const line of LINES) {
    let board = initialBoard()
    let side: Side = 'red'
    for (const token of line.split(' ')) {
      const move = ucciToMove(token)
      // 构建期自检：棋谱着法必须合法，笔误立即暴露
      const legal = generateMoves(board, side).some(m =>
        samePos(m.from, move.from) && samePos(m.to, move.to))
      if (!legal) throw new Error('开局库棋谱非法着法: ' + token + ' @ ' + line)
      const key = boardKey(board, side)
      const list = table.get(key)
      if (list) {
        if (!list.some(m => samePos(m.from, move.from) && samePos(m.to, move.to))) list.push(move)
      } else {
        table.set(key, [move])
      }
      board = applyMove(board, move)
      side = side === 'red' ? 'black' : 'red'
    }
  }
  return table
}

const OPENING_TABLE = buildOpeningTable() // 模块加载时构建 + 自检

/** 开局库查表：命中返回一个库着法（随机变着），未命中返回 null（进入正常搜索） */
export function lookupOpening(board: Board, side: Side): Move | null {
  const moves = OPENING_TABLE.get(boardKey(board, side))
  if (!moves) return null
  return moves[Math.floor(Math.random() * moves.length)]
}
