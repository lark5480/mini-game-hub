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

// ============================================================
// 重复局面判定（长将/长捉/双方长打）
// ============================================================

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const pa = a[r][c]
      const pb = b[r][c]
      if (!pa || !pb) {
        if (pa !== pb) return false
        continue
      }
      if (pa.type !== pb.type || pa.side !== pb.side) return false
    }
  }
  return true
}

// 直线（同行或同列）两端点之间是否无子（不含端点）
function isLineClear(board: Board, r1: number, c1: number, r2: number, c2: number): boolean {
  if (r1 === r2) {
    const lo = Math.min(c1, c2)
    const hi = Math.max(c1, c2)
    for (let c = lo + 1; c < hi; c++) if (board[r1][c]) return false
    return true
  }
  if (c1 === c2) {
    const lo = Math.min(r1, r2)
    const hi = Math.max(r1, r2)
    for (let r = lo + 1; r < hi; r++) if (board[r][c1]) return false
    return true
  }
  return false
}

function countBetween(board: Board, r1: number, c1: number, r2: number, c2: number): number {
  let count = 0
  if (r1 === r2) {
    const lo = Math.min(c1, c2)
    const hi = Math.max(c1, c2)
    for (let c = lo + 1; c < hi; c++) if (board[r1][c]) count++
  } else if (c1 === c2) {
    const lo = Math.min(r1, r2)
    const hi = Math.max(r1, r2)
    for (let r = lo + 1; r < hi; r++) if (board[r][c1]) count++
  }
  return count
}

/**
 * 纯几何吃子判定（不考虑走后是否送将）：
 * (pieceRow,pieceCol) 处的棋子下一步能否吃到 (targetRow,targetCol) 处的敌方棋子。
 * 用于「捉」的判定。
 */
function canCaptureAt(board: Board, pieceRow: number, pieceCol: number, targetRow: number, targetCol: number): boolean {
  const piece = board[pieceRow][pieceCol]
  if (!piece) return false
  const target = board[targetRow][targetCol]
  if (!target || target.side === piece.side) return false
  const dr = targetRow - pieceRow
  const dc = targetCol - pieceCol
  switch (piece.type) {
    case 'king':
      return Math.abs(dr) + Math.abs(dc) === 1 && isInPalace({ row: targetRow, col: targetCol }, piece.side)
    case 'advisor':
      return Math.abs(dr) === 1 && Math.abs(dc) === 1 && isInPalace({ row: targetRow, col: targetCol }, piece.side)
    case 'elephant':
      if (Math.abs(dr) !== 2 || Math.abs(dc) !== 2) return false
      if (piece.side === 'red' ? targetRow < 5 : targetRow > 4) return false
      return board[pieceRow + dr / 2][pieceCol + dc / 2] === null
    case 'horse': {
      const adr = Math.abs(dr)
      const adc = Math.abs(dc)
      if (!((adr === 2 && adc === 1) || (adr === 1 && adc === 2))) return false
      const legRow = adr === 2 ? pieceRow + dr / 2 : pieceRow
      const legCol = adc === 2 ? pieceCol + dc / 2 : pieceCol
      return board[legRow][legCol] === null
    }
    case 'rook':
      return (dr === 0 || dc === 0) && isLineClear(board, pieceRow, pieceCol, targetRow, targetCol)
    case 'cannon':
      return (dr === 0 || dc === 0) && countBetween(board, pieceRow, pieceCol, targetRow, targetCol) === 1
    case 'pawn': {
      const forward = piece.side === 'red' ? -1 : 1
      if (dr === forward && dc === 0) return true
      const crossed = piece.side === 'red' ? pieceRow <= 4 : pieceRow >= 5
      return crossed && dr === 0 && Math.abs(dc) === 1
    }
  }
}

// 「杀」判定：side 刚走完一步，轮到对方走；若对方无论怎么应，
// side 下一步都存在将死/困毙着法 → 该走子构成叫杀。
// 仅重复局面触发时调用（低频路径），1 层搜索成本可接受。
function isMateThreat(board: Board, side: Side): boolean {
  const opp = side === 'red' ? 'black' : 'red'
  const oppMoves = generateMoves(board, opp)
  if (oppMoves.length === 0) return false // 已直接致胜（将死/困毙），不是「杀」
  for (const m of oppMoves) {
    const b2 = applyMove(board, m)
    const sideMoves = generateMoves(b2, side)
    let hasMate = false
    for (const sm of sideMoves) {
      const b3 = applyMove(b2, sm)
      const st = getGameStatus(b3, opp)
      if (st === 'checkmate' || st === 'stalemate') { hasMate = true; break }
    }
    if (!hasMate) return false
  }
  return true
}

export type RepetitionVerdict =
  | { type: 'violation'; side: Side; reason: 'perpetual_check' | 'perpetual_chase' | 'perpetual_mate' | 'perpetual_attack' }
  | { type: 'mutual_draw'; reason: 'mutual_attack' | 'mutual_idle' }

/**
 * 重复局面棋例判定（简化版中国棋规）。
 *
 * 约定：红方先行、严格交替（本应用恒成立），moves[k] 为第 k 个半步（0 起）；
 * positions[k] 为走完 k 个半步后的局面（positions[0] = 初始局面，
 * positions.length === moves.length + 1）。
 *
 * 触发条件：当前局面第 3 次出现，且最近两个周期（各 p 个半步）着法完全相同；
 * 周期 p 从最小可能值 4 起扫描到 MAX_PERIOD（4, 6, 8, ...），取第一个成立者
 * （周期 4 是最小可能的重复周期；更长的循环如周期 8 互捉同样可判罚）。
 *
 * 每步分类：将（走后对方被将军）/ 杀（走后对方无论怎么应，下一步都会被将死/困毙）
 * / 捉（走动子能吃到对方下一步逃走的非将非兵棋子）/ 闲。一方周期内全部为
 * 「打」（将/杀/捉）即构成该方长打。
 *
 * 判罚（中国棋规简化）：
 *  - 双方长打（含双方长将）→ 不变作和；
 *  - 一方长将、另一方其他长打 → 长将方负（长将优先判负）；
 *  - 单方长打 → 该方负（纯将/纯杀/纯捉/混合对应不同 reason）；
 *  - 双方均闲 → 双方不变作和。
 * 简化边界：将 > 杀 > 捉 的混合优先级（如一将一杀 vs 长杀）未实现，双方均非
 * 全将时混合双打一律判和；「捉」沿用简化定义（不含兑/献/根保护判定）。
 */
const MAX_PERIOD = 32 // 长周期扫描上限（半步数，偶数）
export function checkRepetitionViolation(moves: Move[], positions: Board[]): RepetitionVerdict | null {
  const last = moves.length
  if (last < 8) return null
  const current = positions[last]
  if (!current) return null
  // 扫描最小成立周期：当前局面第 3 次出现（间隔 p 与 2p 处相同），且两周期着法序列完全相同
  let cycleLen = -1
  for (let p = 4; p <= MAX_PERIOD && 2 * p <= last; p += 2) {
    if (!boardsEqual(positions[last - p], current)) continue
    if (!boardsEqual(positions[last - 2 * p], current)) continue
    let same = true
    for (let i = 0; i < p; i++) {
      const m1 = moves[last - 2 * p + i]
      const m2 = moves[last - p + i]
      if (m1.from.row !== m2.from.row || m1.from.col !== m2.from.col ||
          m1.to.row !== m2.to.row || m1.to.col !== m2.to.col) { same = false; break }
    }
    if (same) { cycleLen = p; break }
  }
  if (cycleLen < 0) return null

  // 对第一个周期的 cycleLen 步逐一分类（将/杀/捉/闲）
  const cycleStart = last - 2 * cycleLen
  type StrikeClass = 'check' | 'mate' | 'chase' | 'idle'
  const classes: StrikeClass[] = []
  for (let i = 0; i < cycleLen; i++) {
    const m = moves[cycleStart + i]
    // 对方循环内的下一步（i=cycleLen-1 时绕回周期首步，两周期相同故等价）
    const next = moves[cycleStart + ((i + 1) % cycleLen)]
    const boardAfter = positions[cycleStart + i + 1]
    const mover: Side = (cycleStart + i) % 2 === 0 ? 'red' : 'black'
    const opp: Side = mover === 'red' ? 'black' : 'red'
    if (isInCheck(boardAfter, opp)) {
      classes.push('check')
      continue
    }
    // 杀：对方无论怎么应，mover 下一步都能将死/困毙
    if (isMateThreat(boardAfter, mover)) {
      classes.push('mate')
      continue
    }
    // 捉：对方下一步逃走的棋子（next.from）即被捉子，走动子能吃到它
    const chased = boardAfter[next.from.row][next.from.col]
    if (chased && chased.side === opp && chased.type !== 'king' && chased.type !== 'pawn' &&
        canCaptureAt(boardAfter, m.to.row, m.to.col, next.from.row, next.from.col)) {
      classes.push('chase')
    } else {
      classes.push('idle')
    }
  }

  const half = cycleLen / 2
  const sideA: Side = cycleStart % 2 === 0 ? 'red' : 'black'
  const sideB: Side = sideA === 'red' ? 'black' : 'red'
  // 周期内 sideA 走偶数步、sideB 走奇数步
  const aCls: StrikeClass[] = []
  const bCls: StrikeClass[] = []
  for (let i = 0; i < half; i++) { aCls.push(classes[i * 2]); bCls.push(classes[i * 2 + 1]) }
  const isHitting = (cls: StrikeClass[]) => cls.every(c => c !== 'idle')
  const isAllCheck = (cls: StrikeClass[]) => cls.every(c => c === 'check')
  const isAllMate = (cls: StrikeClass[]) => cls.every(c => c === 'mate')
  const isAllChase = (cls: StrikeClass[]) => cls.every(c => c === 'chase')
  const reasonOf = (cls: StrikeClass[]): 'perpetual_check' | 'perpetual_chase' | 'perpetual_mate' | 'perpetual_attack' =>
    isAllCheck(cls) ? 'perpetual_check' : isAllMate(cls) ? 'perpetual_mate' :
    isAllChase(cls) ? 'perpetual_chase' : 'perpetual_attack'
  const aHitting = isHitting(aCls)
  const bHitting = isHitting(bCls)

  if (aHitting && bHitting) {
    // 长将优先：一方全将而另一方非全将 → 长将方负
    if (isAllCheck(aCls) && !isAllCheck(bCls)) return { type: 'violation', side: sideA, reason: 'perpetual_check' }
    if (isAllCheck(bCls) && !isAllCheck(aCls)) return { type: 'violation', side: sideB, reason: 'perpetual_check' }
    // 双方长打（含双方长将）→ 不变作和
    return { type: 'mutual_draw', reason: 'mutual_attack' }
  }
  if (aHitting) return { type: 'violation', side: sideA, reason: reasonOf(aCls) }
  if (bHitting) return { type: 'violation', side: sideB, reason: reasonOf(bCls) }
  // 双方均为允许着法，循环不变 → 判和
  return { type: 'mutual_draw', reason: 'mutual_idle' }
}

export { toNotation } from "./notation"