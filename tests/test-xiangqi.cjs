/**
 * 中国象棋规则引擎单元测试
 * 覆盖：七种棋子走法、全局约束、将死/困毙判定
 * 每条红线规则 >=2 个专项反例
 * 运行前需先编译：npx tsc -p tsconfig.xiangqi.json
 */

const path = require('path')
const { execSync } = require('child_process')

try {
  execSync('npx tsc -p tsconfig.xiangqi.json', { cwd: path.join(__dirname, '..'), stdio: 'inherit' })
} catch (e) {
  console.error('编译失败，请检查 TypeScript 源码')
  process.exit(1)
}

const {
  initialBoard, generateMoves, isLegalMove, applyMove,
  isInCheck, getGameStatus, classifyMove, isPinned, toNotation,
  checkRepetitionViolation
} = require(path.join(__dirname, '.tmp-xiangqi', 'rules'))
const { indexFromOffset, flipIndex } = require(path.join(__dirname, '.tmp-xiangqi', 'types'))

const ROWS = 10
const COLS = 9

let total = 0, passed = 0, failed = 0
const failures = []

function assert(cond, name, detail) {
  total++
  if (cond) { passed++; console.log('  PASS: ' + name) }
  else { failed++; const m = detail ? name + ' -- ' + detail : name; failures.push(m); console.log('  FAIL: ' + m) }
}
function assertEq(a, e, n) { assert(a === e, n, 'Expected ' + JSON.stringify(e) + ', Got ' + JSON.stringify(a)) }
function assertTrue(c, n) { assert(c === true, n) }
function assertFalse(c, n) { assert(c === false, n) }

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}
function place(board, row, col, type, side) {
  board[row][col] = { type, side }
}

// ============================================================
// Suite 1: 初始棋盘
// ============================================================
console.log('\n=== Suite 1: 初始棋盘 ===')
{
  const b = initialBoard()
  assertEq(b.length, 10, '棋盘 10 行')
  assertEq(b[0].length, 9, '棋盘 9 列')
  assertEq(b[0][0].type, 'rook', '黑车 (0,0)')
  assertEq(b[0][4].type, 'king', '黑将 (0,4)')
  assertEq(b[0][1].type, 'horse', '黑马 (0,1)')
  assertEq(b[0][2].type, 'elephant', '黑象 (0,2)')
  assertEq(b[0][3].type, 'advisor', '黑士 (0,3)')
  assertEq(b[2][1].type, 'cannon', '黑炮 (2,1)')
  assertEq(b[3][0].type, 'pawn', '黑卒 (3,0)')
  assertEq(b[9][0].type, 'rook', '红车 (9,0)')
  assertEq(b[9][4].type, 'king', '红帅 (9,4)')
  assertEq(b[7][1].type, 'cannon', '红炮 (7,1)')
  assertEq(b[6][0].type, 'pawn', '红兵 (6,0)')
  assertEq(b[0][0].side, 'black', '黑方 side')
  assertEq(b[9][4].side, 'red', '红方 side')
}

// ============================================================
// Suite 2: 将/帅走法（九宫一步直行）
// ============================================================
console.log('\n=== Suite 2: 将/帅走法 ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 8, col: 4 }), '红帅上移 (9,4)->(8,4)')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 9, col: 3 }), '红帅左移 (9,4)->(9,3)')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 9, col: 5 }), '红帅右移 (9,4)->(9,5)')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 7, col: 4 }), '红帅不可两步 (9,4)->(7,4)')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 9, col: 2 }), '红帅不可两步 (9,4)->(9,2)')
}
{
  const b = emptyBoard()
  place(b, 0, 4, 'king', 'black')
  assertTrue(isLegalMove(b, { row: 0, col: 4 }, { row: 1, col: 4 }), '黑将下移 (0,4)->(1,4)')
  assertTrue(isLegalMove(b, { row: 0, col: 4 }, { row: 0, col: 3 }), '黑将左移 (0,4)->(0,3)')
  assertFalse(isLegalMove(b, { row: 0, col: 4 }, { row: 0, col: 4 }), '将不可原地不动')
}
{
  const b = emptyBoard()
  place(b, 9, 3, 'king', 'red')
  assertFalse(isLegalMove(b, { row: 9, col: 3 }, { row: 9, col: 2 }), '红帅不可出九宫到 col=2')
  assertFalse(isLegalMove(b, { row: 9, col: 3 }, { row: 6, col: 3 }), '红帅不可出九宫到 row=6')
}

// ============================================================
// Suite 3: 士/仕走法（九宫斜一步）
// ============================================================
console.log('\n=== Suite 3: 士/仕走法 ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'advisor', 'red')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 8, col: 3 }), '红士斜上左 (9,4)->(8,3)')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 8, col: 5 }), '红士斜上右 (9,4)->(8,5)')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 9, col: 3 }), '士不可直行')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 7, col: 2 }), '士不可两步')
}
{
  const b = emptyBoard()
  place(b, 0, 4, 'advisor', 'black')
  assertTrue(isLegalMove(b, { row: 0, col: 4 }, { row: 1, col: 3 }), '黑士斜下左 (0,4)->(1,3)')
  assertTrue(isLegalMove(b, { row: 0, col: 4 }, { row: 1, col: 5 }), '黑士斜下右 (0,4)->(1,5)')
}
{
  const b = emptyBoard()
  place(b, 9, 3, 'advisor', 'red')
  assertFalse(isLegalMove(b, { row: 9, col: 3 }, { row: 8, col: 2 }), '红士不可出九宫到 col=2')
}

// ============================================================
// Suite 4: 象/相走法（田字+不过河+塞象眼）
// ============================================================
console.log('\n=== Suite 4: 象/相走法 ===')
{
  const b = emptyBoard()
  place(b, 9, 2, 'elephant', 'red')
  assertTrue(isLegalMove(b, { row: 9, col: 2 }, { row: 7, col: 0 }), '红象飞田左上 (9,2)->(7,0)')
  assertTrue(isLegalMove(b, { row: 9, col: 2 }, { row: 7, col: 4 }), '红象飞田右上 (9,2)->(7,4)')
  assertFalse(isLegalMove(b, { row: 9, col: 2 }, { row: 5, col: 2 }), '象不可走双田')
}
{
  const b = emptyBoard()
  place(b, 0, 2, 'elephant', 'black')
  assertTrue(isLegalMove(b, { row: 0, col: 2 }, { row: 2, col: 0 }), '黑象飞田左下 (0,2)->(2,0)')
  assertTrue(isLegalMove(b, { row: 0, col: 2 }, { row: 2, col: 4 }), '黑象飞田右下 (0,2)->(2,4)')
}
{
  const b = emptyBoard()
  place(b, 5, 2, 'elephant', 'red')
  assertFalse(isLegalMove(b, { row: 5, col: 2 }, { row: 3, col: 0 }), '红象不可过河到 row=3')
  assertFalse(isLegalMove(b, { row: 5, col: 2 }, { row: 3, col: 4 }), '红象不可过河到 row=3(右)')
}
{
  const b = emptyBoard()
  place(b, 9, 2, 'elephant', 'red')
  place(b, 8, 1, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 9, col: 2 }, { row: 7, col: 0 }), '塞象眼反例1：左上有子不可飞 (9,2)->(7,0)')
  assertTrue(isLegalMove(b, { row: 9, col: 2 }, { row: 7, col: 4 }), '塞象眼：右上无子仍可飞 (9,2)->(7,4)')
}
{
  const b = emptyBoard()
  place(b, 9, 6, 'elephant', 'red')
  place(b, 8, 7, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 9, col: 6 }, { row: 7, col: 8 }), '塞象眼反例2：右上有子不可飞 (9,6)->(7,8)')
}

// ============================================================
// Suite 5: 马走法（日字+蹩马腿）
// ============================================================
console.log('\n=== Suite 5: 马走法 ===')
{
  const b = emptyBoard()
  place(b, 5, 4, 'horse', 'red')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 3, col: 3 }), '马上2左1 (5,4)->(3,3)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 3, col: 5 }), '马上2右1 (5,4)->(3,5)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 7, col: 3 }), '马下2左1 (5,4)->(7,3)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 7, col: 5 }), '马下2右1 (5,4)->(7,5)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 4, col: 2 }), '马上1左2 (5,4)->(4,2)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 6, col: 2 }), '马下1左2 (5,4)->(6,2)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 4, col: 6 }), '马上1右2 (5,4)->(4,6)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 6, col: 6 }), '马下1右2 (5,4)->(6,6)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'horse', 'red')
  place(b, 4, 4, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 3, col: 3 }), '蹩马腿反例1a：正上方有子 (5,4)->(3,3)')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 3, col: 5 }), '蹩马腿反例1b：正上方有子 (5,4)->(3,5)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 7, col: 3 }), '蹩马腿：下方无子仍可走 (5,4)->(7,3)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'horse', 'red')
  place(b, 5, 3, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 4, col: 2 }), '蹩马腿反例2a：正左方有子 (5,4)->(4,2)')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 6, col: 2 }), '蹩马腿反例2b：正左方有子 (5,4)->(6,2)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 4, col: 6 }), '蹩马腿：右方无子仍可走 (5,4)->(4,6)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'horse', 'red')
  place(b, 5, 5, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 4, col: 6 }), '蹩马腿反例3a：正右方有子 (5,4)->(4,6)')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 6, col: 6 }), '蹩马腿反例3b：正右方有子 (5,4)->(6,6)')
}

// ============================================================
// Suite 6: 车走法（直线任意格）
// ============================================================
console.log('\n=== Suite 6: 车走法 ===')
{
  const b = emptyBoard()
  place(b, 5, 4, 'rook', 'red')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 0 }), '车左移到边 (5,4)->(5,0)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 8 }), '车右移到边 (5,4)->(5,8)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 0, col: 4 }), '车上移到边 (5,4)->(0,4)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 9, col: 4 }), '车下移到边 (5,4)->(9,4)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'rook', 'red')
  place(b, 5, 2, 'pawn', 'red')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 2 }), '车不能吃己方子')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'rook', 'red')
  place(b, 5, 2, 'pawn', 'black')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 2 }), '车可吃黑卒 (5,4)->(5,2)')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 1 }), '车不可穿越黑卒到 (5,1)')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 0 }), '车不可穿越黑卒到 (5,0)')
}

// ============================================================
// Suite 7: 炮走法（直线移动+隔一子吃子）
// ============================================================
console.log('\n=== Suite 7: 炮走法 ===')
{
  const b = emptyBoard()
  place(b, 5, 4, 'cannon', 'red')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 0 }), '炮左移 (5,4)->(5,0)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 8 }), '炮右移 (5,4)->(5,8)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 0, col: 4 }), '炮上移 (5,4)->(0,4)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'cannon', 'red')
  place(b, 5, 1, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 1 }), '无炮架反例1a：隔空吃子不合法 (5,4)->(5,1)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'cannon', 'red')
  place(b, 5, 3, 'pawn', 'red')
  place(b, 5, 1, 'pawn', 'black')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 1 }), '有炮架隔一子吃子合法 (5,4)->(5,1)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'cannon', 'red')
  place(b, 5, 3, 'pawn', 'red')
  place(b, 5, 2, 'pawn', 'black')
  place(b, 5, 0, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 0 }), '无炮架反例2：隔两子不能吃 (5,4)->(5,0)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'cannon', 'red')
  place(b, 5, 3, 'pawn', 'black')
  assertFalse(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 3 }), '无炮架反例3：紧邻有子无炮架不能吃 (5,4)->(5,3)')
}

// ============================================================
// Suite 8: 兵/卒走法（过河前只进+过河后可左右）
// ============================================================
console.log('\n=== Suite 8: 兵/卒走法 ===')
{
  const b = emptyBoard()
  place(b, 6, 4, 'pawn', 'red')
  assertTrue(isLegalMove(b, { row: 6, col: 4 }, { row: 5, col: 4 }), '红兵前进 (6,4)->(5,4)')
  assertFalse(isLegalMove(b, { row: 6, col: 4 }, { row: 6, col: 3 }), '红兵过河前不可左右 (6,4)->(6,3)')
  assertFalse(isLegalMove(b, { row: 6, col: 4 }, { row: 6, col: 5 }), '红兵过河前不可左右 (6,4)->(6,5)')
  assertFalse(isLegalMove(b, { row: 6, col: 4 }, { row: 7, col: 4 }), '红兵不可后退 (6,4)->(7,4)')
}
{
  const b = emptyBoard()
  place(b, 4, 4, 'pawn', 'red')
  assertTrue(isLegalMove(b, { row: 4, col: 4 }, { row: 3, col: 4 }), '红兵过河后可前进 (4,4)->(3,4)')
  assertTrue(isLegalMove(b, { row: 4, col: 4 }, { row: 4, col: 3 }), '红兵过河后可左 (4,4)->(4,3)')
  assertTrue(isLegalMove(b, { row: 4, col: 4 }, { row: 4, col: 5 }), '红兵过河后可右 (4,4)->(4,5)')
  assertFalse(isLegalMove(b, { row: 4, col: 4 }, { row: 5, col: 4 }), '红兵不可后退 (4,4)->(5,4)')
}
{
  const b = emptyBoard()
  place(b, 3, 4, 'pawn', 'black')
  assertTrue(isLegalMove(b, { row: 3, col: 4 }, { row: 4, col: 4 }), '黑卒前进 (3,4)->(4,4)')
  assertFalse(isLegalMove(b, { row: 3, col: 4 }, { row: 3, col: 3 }), '黑卒过河前不可左右 (3,4)->(3,3)')
}
{
  const b = emptyBoard()
  place(b, 5, 4, 'pawn', 'black')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 6, col: 4 }), '黑卒过河后可前进 (5,4)->(6,4)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 3 }), '黑卒过河后可左 (5,4)->(5,3)')
  assertTrue(isLegalMove(b, { row: 5, col: 4 }, { row: 5, col: 5 }), '黑卒过河后可右 (5,4)->(5,5)')
}

// ============================================================
// Suite 9: 将军检测
// ============================================================
console.log('\n=== Suite 9: 将军检测 ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 4, 'rook', 'black')
  assertTrue(isInCheck(b, 'red'), '车同列将军：红帅被黑车将军')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 7, 4, 'pawn', 'red')
  place(b, 0, 4, 'cannon', 'black')
  assertTrue(isInCheck(b, 'red'), '炮隔架将军：红帅被黑炮将军')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 7, 3, 'horse', 'black')
  assertTrue(isInCheck(b, 'red'), '马将军：红帅被黑马将军')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 3, 'rook', 'black')
  assertFalse(isInCheck(b, 'red'), '无将军：黑车不在同列')
}

// ============================================================
// Suite 10: 飞将（将帅对面）
// ============================================================
console.log('\n=== Suite 10: 飞将 ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 4, 'king', 'black')
  assertTrue(isInCheck(b, 'red'), '飞将反例1a：红帅与黑将同列无阻隔')
  assertTrue(isInCheck(b, 'black'), '飞将反例1b：黑将与红帅同列无阻隔')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 8, col: 4 }), '飞将反例1c：红帅不能移开暴露黑将')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 5, 4, 'pawn', 'red')
  place(b, 0, 4, 'king', 'black')
  assertFalse(isInCheck(b, 'red'), '飞将反例2：有子阻隔不飞将')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 3, 'king', 'black')
  assertFalse(isInCheck(b, 'red'), '飞将反例3：将帅不同列不飞将')
}

// ============================================================
// Suite 11: 送将（走完后己方将不被攻击）
// ============================================================
console.log('\n=== Suite 11: 送将 ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 8, 4, 'advisor', 'red')
  place(b, 0, 4, 'rook', 'black')
  assertFalse(isLegalMove(b, { row: 8, col: 4 }, { row: 7, col: 3 }), '送将反例1：士移开暴露红帅给黑车')
}
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 4, 'rook', 'black')
  assertFalse(isLegalMove(b, { row: 9, col: 4 }, { row: 8, col: 4 }), '送将反例2：红帅不能走到黑车攻击线上')
  assertTrue(isLegalMove(b, { row: 9, col: 4 }, { row: 9, col: 3 }), '送将：红帅可以走(9,3)避开')
}

// ============================================================
// Suite 12: 将死判定
// ============================================================
console.log('\n=== Suite 12: 将死判定 ===')
{
  const b = emptyBoard()
  place(b, 0, 4, 'king', 'black')
  place(b, 0, 0, 'rook', 'red')
  place(b, 1, 3, 'rook', 'red')
  place(b, 1, 5, 'rook', 'red')
  assertEq(getGameStatus(b, 'black'), 'checkmate', '将死1：双车错杀黑将')
}
{
  const b = emptyBoard()
  place(b, 0, 4, 'king', 'black')
  place(b, 2, 3, 'horse', 'red')
  place(b, 0, 8, 'rook', 'red')
  place(b, 9, 4, 'rook', 'red')
  assertEq(getGameStatus(b, 'black'), 'checkmate', '将死2：马+双车杀黑将')
}

// ============================================================
// Suite 13: 困毙判定
// ============================================================
console.log('\n=== Suite 13: 困毙判定 ===')
{
  const b = emptyBoard()
  place(b, 0, 4, 'king', 'black')
  place(b, 1, 3, 'rook', 'red')
  place(b, 1, 5, 'rook', 'red')
  place(b, 2, 3, 'rook', 'red')
  place(b, 2, 5, 'rook', 'red')
  assertEq(getGameStatus(b, 'black'), 'stalemate', '困毙1：黑将被红车围困(无将军)')
}
{
  const b = emptyBoard()
  place(b, 0, 4, 'king', 'black')
  place(b, 1, 3, 'rook', 'red')
  place(b, 1, 5, 'rook', 'red')
  place(b, 2, 3, 'rook', 'red')
  place(b, 2, 5, 'rook', 'red')
  place(b, 0, 0, 'advisor', 'black')
  place(b, 0, 8, 'advisor', 'black')
  assertEq(getGameStatus(b, 'black'), 'stalemate', '困毙2：黑将被红车围困(士堵位)')
}

// ============================================================
// Suite 14: applyMove 纯函数
// ============================================================
console.log('\n=== Suite 14: applyMove 纯函数 ===')
{
  const b = emptyBoard()
  place(b, 5, 4, 'rook', 'red')
  const newBoard = applyMove(b, { from: { row: 5, col: 4 }, to: { row: 5, col: 0 } })
  assertEq(b[5][4].type, 'rook', '原棋盘不变：起点仍有车')
  assertEq(newBoard[5][4], null, '新棋盘起点为空')
  assertEq(newBoard[5][0].type, 'rook', '新棋盘终点有车')
}

// ============================================================
// Suite 15: 游戏状态 playing
// ============================================================
console.log('\n=== Suite 15: 游戏状态 playing ===')
{
  const b = initialBoard()
  assertEq(getGameStatus(b, 'red'), 'playing', '初始局面红方 playing')
}

// ============================================================
// Suite 16: 游戏状态 check
// ============================================================
console.log('\n=== Suite 16: 游戏状态 check ===')
{
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 4, 'rook', 'black')
  place(b, 0, 0, 'king', 'black')
  assertEq(getGameStatus(b, 'red'), 'check', '红方被将军状态为 check')
}

// ============================================================
// Suite 17: 吃子与 captured 字段
// ============================================================
console.log('\n=== Suite 17: 吃子 captured ===')
{
  const b = emptyBoard()
  place(b, 5, 4, 'rook', 'red')
  place(b, 5, 1, 'pawn', 'black')
  const moves = generateMoves(b, 'red')
  const captureMove = moves.find(m => m.to.row === 5 && m.to.col === 1)
  assertTrue(!!captureMove, '存在吃子走法')
  assertEq(captureMove.captured.type, 'pawn', 'captured 记录被吃的卒')
  assertEq(captureMove.captured.side, 'black', 'captured 记录黑方')
}

// ============================================================
// Suite 18: 边界检查
// ============================================================
console.log('\n=== Suite 18: 边界检查 ===')
{
  const b = emptyBoard()
  place(b, 0, 0, 'horse', 'black')
  assertTrue(isLegalMove(b, { row: 0, col: 0 }, { row: 2, col: 1 }), '马在 (0,0) 可走 (2,1)')
  assertTrue(isLegalMove(b, { row: 0, col: 0 }, { row: 1, col: 2 }), '马在 (0,0) 可走 (1,2)')
  assertFalse(isLegalMove(b, { row: 0, col: 0 }, { row: 2, col: -1 }), '马不可越界到 col=-1')
}

// ============================================================
// Suite 19: 初始局面走法数量
// ============================================================
console.log('\n=== Suite 19: 初始局面走法数量 ===')
{
  const b = initialBoard()
  const moves = generateMoves(b, 'red')
  assertEq(moves.length, 44, '红方开局 44 种走法')
}

// ============================================================
// Suite 20: 整盘对弈（脚本化名局，红黑交替）
// 由规则引擎自对弈生成并冻结的合法序列（偏进攻启发式），覆盖开局→中局。
// 每手断言合法 + 双帅始终在场 + 无飞将违例；终局状态合法性断言。
// 注：弱 AI 自对弈不保证将死，故仅断言「整盘走子全程合法且局面始终有效」；
//     将死/困毙终局判定由 Suite 12 / Suite 13 覆盖。
// ============================================================
console.log('\n=== Suite 20: 整盘对弈（红黑交替走子）===')
{
  // 冻结的脚本化对局：坐标 row/col，row0=黑底线 / row9=红底线，红先走
  const GAME = [
    { from: { row: 7, col: 1 }, to: { row: 0, col: 1 }, captured: { type: 'horse', side: 'black' } },
    { from: { row: 2, col: 7 }, to: { row: 9, col: 7 }, captured: { type: 'horse', side: 'red' } },
    { from: { row: 9, col: 8 }, to: { row: 9, col: 7 }, captured: { type: 'cannon', side: 'black' } },
    { from: { row: 0, col: 0 }, to: { row: 0, col: 1 }, captured: { type: 'cannon', side: 'red' } },
    { from: { row: 7, col: 7 }, to: { row: 1, col: 7 } },
    { from: { row: 2, col: 1 }, to: { row: 2, col: 7 } },
    { from: { row: 9, col: 7 }, to: { row: 2, col: 7 }, captured: { type: 'cannon', side: 'black' } },
    { from: { row: 0, col: 1 }, to: { row: 9, col: 1 }, captured: { type: 'horse', side: 'red' } },
    { from: { row: 2, col: 7 }, to: { row: 2, col: 4 } },
    { from: { row: 0, col: 2 }, to: { row: 2, col: 4 }, captured: { type: 'rook', side: 'red' } },
    { from: { row: 9, col: 0 }, to: { row: 9, col: 1 }, captured: { type: 'rook', side: 'black' } },
    { from: { row: 0, col: 3 }, to: { row: 1, col: 4 } },
    { from: { row: 9, col: 1 }, to: { row: 0, col: 1 } },
    { from: { row: 2, col: 4 }, to: { row: 0, col: 2 } },
    { from: { row: 0, col: 1 }, to: { row: 0, col: 2 }, captured: { type: 'elephant', side: 'black' } },
    { from: { row: 1, col: 4 }, to: { row: 0, col: 3 } },
    { from: { row: 0, col: 2 }, to: { row: 0, col: 3 }, captured: { type: 'advisor', side: 'black' } },
    { from: { row: 0, col: 4 }, to: { row: 0, col: 3 }, captured: { type: 'rook', side: 'red' } },
    { from: { row: 6, col: 0 }, to: { row: 5, col: 0 } },
    { from: { row: 0, col: 5 }, to: { row: 1, col: 4 } },
    { from: { row: 5, col: 0 }, to: { row: 4, col: 0 } },
    { from: { row: 3, col: 0 }, to: { row: 4, col: 0 }, captured: { type: 'pawn', side: 'red' } },
    { from: { row: 6, col: 2 }, to: { row: 5, col: 2 } },
    { from: { row: 0, col: 8 }, to: { row: 1, col: 8 } },
    { from: { row: 5, col: 2 }, to: { row: 4, col: 2 } },
    { from: { row: 1, col: 8 }, to: { row: 1, col: 7 }, captured: { type: 'cannon', side: 'red' } },
    { from: { row: 4, col: 2 }, to: { row: 3, col: 2 }, captured: { type: 'pawn', side: 'black' } },
    { from: { row: 1, col: 7 }, to: { row: 8, col: 7 } },
    { from: { row: 9, col: 3 }, to: { row: 8, col: 4 } },
    { from: { row: 8, col: 7 }, to: { row: 8, col: 4 }, captured: { type: 'advisor', side: 'red' } },
    { from: { row: 9, col: 4 }, to: { row: 8, col: 4 }, captured: { type: 'rook', side: 'black' } },
    { from: { row: 0, col: 3 }, to: { row: 1, col: 3 } },
    { from: { row: 3, col: 2 }, to: { row: 2, col: 2 } },
    { from: { row: 0, col: 6 }, to: { row: 2, col: 8 } },
    { from: { row: 2, col: 2 }, to: { row: 1, col: 2 } },
    { from: { row: 1, col: 3 }, to: { row: 2, col: 3 } },
    { from: { row: 6, col: 4 }, to: { row: 5, col: 4 } },
    { from: { row: 0, col: 7 }, to: { row: 2, col: 6 } },
    { from: { row: 5, col: 4 }, to: { row: 4, col: 4 } },
    { from: { row: 3, col: 4 }, to: { row: 4, col: 4 }, captured: { type: 'pawn', side: 'red' } },
    { from: { row: 6, col: 6 }, to: { row: 5, col: 6 } },
    { from: { row: 1, col: 4 }, to: { row: 2, col: 5 } },
    { from: { row: 5, col: 6 }, to: { row: 4, col: 6 } },
    { from: { row: 2, col: 8 }, to: { row: 4, col: 6 }, captured: { type: 'pawn', side: 'red' } },
    { from: { row: 6, col: 8 }, to: { row: 5, col: 8 } },
    { from: { row: 2, col: 5 }, to: { row: 1, col: 4 } },
    { from: { row: 5, col: 8 }, to: { row: 4, col: 8 } },
    { from: { row: 3, col: 8 }, to: { row: 4, col: 8 }, captured: { type: 'pawn', side: 'red' } }
  ]

  const b0 = initialBoard()
  let board = b0
  let side = 'red'
  let ply = 0
  let redMoves = 0
  let blackMoves = 0

  for (const mv of GAME) {
    const tag = '第' + (ply + 1) + '手(' + side + ')'
    assertTrue(isLegalMove(board, mv.from, mv.to), tag + ' 合法')
    board = applyMove(board, mv)

    // 双帅始终在场
    let redKing = false
    let blackKing = false
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = board[r][c]
        if (p && p.type === 'king' && p.side === 'red') redKing = true
        if (p && p.type === 'king' && p.side === 'black') blackKing = true
      }
    }
    assertTrue(redKing && blackKing, tag + ' 后双帅仍在场')

    if (side === 'red') redMoves++
    else blackMoves++

    side = side === 'red' ? 'black' : 'red'
    ply++
  }

  // 整盘级断言
  assert(ply >= 40, '对局长度达到偏真实对局长度 (>=40 手, 实际 ' + ply + ' 手)')
  assertEq(redMoves, blackMoves, '红黑走子数严格相等（交替）')
  const finalStatus = getGameStatus(board, side)
  assertTrue(
    ['playing', 'check', 'checkmate', 'stalemate'].includes(finalStatus),
    '终局状态合法: ' + finalStatus + '，红' + redMoves + '手/黑' + blackMoves + '手'
  )
}

// ============================================================
// Suite 21: 强制将死（短杀序列）—— 红车+帅 vs 黑单将
// 由求解器生成（连续叫将剪枝 + 迭代加深），引擎实测终局为 checkmate。
// 红先走，红3手/黑2手，第5手将死。红车两次叫将 + 红帅一步锁飞将线做杀网。
// 验证：每手合法 + 红黑严格交替 + 终局将死。
// ============================================================
{
  console.log('\n[Suite 21] 强制将死（短杀序列）')

  const b = emptyBoard()
  place(b, 9, 3, 'king', 'red')    // 红帅
  place(b, 6, 0, 'rook', 'red')    // 红车
  place(b, 0, 4, 'king', 'black')  // 黑将

  const MATE = [
    { from: { row: 6, col: 0 }, to: { row: 6, col: 4 } }, // 红车第4列叫将
    { from: { row: 0, col: 4 }, to: { row: 0, col: 5 } }, // 黑将避至 (0,5)
    { from: { row: 9, col: 3 }, to: { row: 9, col: 4 } }, // 红帅占第4列，锁飞将线（静步做杀网）
    { from: { row: 0, col: 5 }, to: { row: 1, col: 5 } }, // 黑将退至 (1,5)
    { from: { row: 6, col: 4 }, to: { row: 6, col: 5 } }  // 红车第5列叫将 -> 将死
  ]

  // 起始局面红先走、未被将
  assertEq(getGameStatus(b, 'red'), 'playing', '起始：红先走且未被将')

  let board = b
  let side = 'red'
  let redCount = 0
  let blackCount = 0
  MATE.forEach((mv, i) => {
    const tag = '第' + (i + 1) + '手(' + side + ')'
    assertTrue(isLegalMove(board, mv.from, mv.to), tag + ' 合法')
    board = applyMove(board, mv)
    if (side === 'red') redCount++
    else blackCount++
    side = side === 'red' ? 'black' : 'red'
  })

  assert(MATE.length >= 2, '短杀序列：手数 >= 2 (实际 ' + MATE.length + ')')
  assertEq(redCount, 3, '红走 3 手')
  assertEq(blackCount, 2, '黑走 2 手（严格交替）')
  assertEq(getGameStatus(board, 'black'), 'checkmate', '终局：黑被将死')
}

// ============================================================
// Suite 22: 回归 — 炮隔一子吃中卒 + 回合严格交替
// 背景：用户报告「炮二平五 → 马八进七 → 炮五进四吃中卒」链路异常
// （回合错乱 / 吃子未生效），需固化引擎层正确性：
//   1) 红炮隔红中兵（己方炮架）吃黑中卒合法
//   2) 吃子后目标点为红炮、黑卒被移除、起点清空
//   3) 双方走子严格交替，任何一步后对方走子集合不含已走棋子的重复位移
// ============================================================
console.log('\n=== Suite 22: 回归 — 炮五进四吃中卒 ===')
{
  let b = initialBoard()

  // 第1手（红）：炮二平五 (7,7) -> (7,4)
  assertTrue(isLegalMove(b, { row: 7, col: 7 }, { row: 7, col: 4 }), '回归1：炮二平五合法')
  b = applyMove(b, { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } })
  assertEq(b[7][4].type, 'cannon', '回归1：中炮到位 (7,4)')
  assertEq(b[7][7], null, '回归1：炮原位移空')

  // 第2手（黑）：马八进七 (0,1) -> (2,2)
  assertTrue(isLegalMove(b, { row: 0, col: 1 }, { row: 2, col: 2 }), '回归2：马八进七合法')
  b = applyMove(b, { from: { row: 0, col: 1 }, to: { row: 2, col: 2 } })

  // 第3手（红）：炮五进四，隔红中兵 (6,4) 吃黑中卒 (3,4)
  assertEq(b[3][4].type, 'pawn', '回归3前置：黑中卒仍在 (3,4)')
  assertEq(b[3][4].side, 'black', '回归3前置：中卒为黑方')
  assertTrue(isLegalMove(b, { row: 7, col: 4 }, { row: 3, col: 4 }), '回归3：炮隔己方中兵吃黑中卒合法 (7,4)->(3,4)')
  const capMoves = generateMoves(b, 'red').filter(m => m.from.row === 7 && m.from.col === 4 && m.to.row === 3 && m.to.col === 4)
  assertEq(capMoves.length, 1, '回归3：generateMoves 恰含一条该吃子走法')
  assertEq(capMoves[0].captured.type, 'pawn', '回归3：captured 记录被吃的卒')
  assertEq(capMoves[0].captured.side, 'black', '回归3：captured 为黑方')

  b = applyMove(b, { from: { row: 7, col: 4 }, to: { row: 3, col: 4 } })
  assertEq(b[3][4].type, 'cannon', '回归3：吃子后目标点为红炮')
  assertEq(b[3][4].side, 'red', '回归3：吃子后目标点为红方')
  assertEq(b[7][4], null, '回归3：炮起点清空')
  assertEq(getGameStatus(b, 'black'), 'playing', '回归3：吃中卒后黑方 playing（未被将）')

  // 回合归属：轮到黑方时，黑方走子集合不得包含红炮的移动（防「代走/连走」）
  assertFalse(
    generateMoves(b, 'black').some(m => m.from.row === 7 && m.from.col === 4),
    '回归3：黑方走子集合不含红炮位移'
  )
  // 对照反例：无炮架不得隔空吃；炮架为对方子同样可吃（炮架不限敌我）
  const b2 = emptyBoard()
  place(b2, 9, 4, 'king', 'red')
  place(b2, 0, 4, 'king', 'black')
  place(b2, 5, 4, 'cannon', 'red')
  place(b2, 3, 4, 'pawn', 'black')
  assertFalse(isLegalMove(b2, { row: 5, col: 4 }, { row: 3, col: 4 }), '回归4：无炮架隔空吃中卒非法')
  place(b2, 4, 4, 'pawn', 'black')
  assertTrue(isLegalMove(b2, { row: 5, col: 4 }, { row: 3, col: 4 }), '回归4：炮架为对方子也可吃子')
}

// ============================================================
// Suite 23: 回归 — 走子后回合翻转与乱序走子拒绝
// 背景：联机回合错乱根因之一是走子消息未校验行棋方归属。
// 引擎层保证：任一方 generateMoves 仅含该方棋子；轮到某方时，
// 重复应用同一上一步（from 已空）不可能产生合法走法。
// ============================================================
console.log('\n=== Suite 23: 回归 — 回合翻转与乱序拒绝 ===')
{
  let b = initialBoard()
  const m1 = { from: { row: 7, col: 7 }, to: { row: 7, col: 4 } }
  b = applyMove(b, m1) // 红走一步，轮到黑

  // 乱序/重复：同一走法再执行一次，引擎判为非法（起点已空）
  assertFalse(isLegalMove(b, m1.from, m1.to), '重复同一走法非法（起点已空）')
  // 黑方不得走红方棋子：全部黑方走法的 from 均为黑子
  const blackMoves = generateMoves(b, 'black')
  assertTrue(blackMoves.length > 0, '黑方有合法应招')
  assertTrue(
    blackMoves.every(m => b[m.from.row][m.from.col] && b[m.from.row][m.from.col].side === 'black'),
    '黑方全部走法起点均为黑子'
  )
  // 交替两步后回到红方回合，红方走法起点均为红子
  const mv2 = blackMoves[0]
  b = applyMove(b, mv2)
  const redMoves = generateMoves(b, 'red')
  assertTrue(
    redMoves.length > 0 && redMoves.every(m => b[m.from.row][m.from.col] && b[m.from.row][m.from.col].side === 'red'),
    '交替两步后红方全部走法起点均为红子'
  )
}

// ============================================================
// Suite 24: 回归 — 点击坐标→行列映射（命中区以交叉点为中心）
// 背景：线上出现「必须点棋子下方才选中」的纵向偏移 bug，根因是
// 映射用了 floor（命中区上偏半格）；round 保证交叉点居中。
// ============================================================
console.log('\n=== Suite 24: 回归 — 坐标映射 ===')
{
  const pad = 38, cell = 64
  // 交叉点正中心 → 命中本行
  assertEq(indexFromOffset(pad + 3 * cell, pad, cell, 10), 3, '中心点命中本行')
  assertEq(indexFromOffset(pad, pad, cell, 10), 0, '首行交叉点命中')
  assertEq(indexFromOffset(pad + 9 * cell, pad, cell, 10), 9, '末行交叉点命中')
  // 交叉点上方半格内（交叉点下方半格内）仍命中本行（round 语义）
  assertEq(indexFromOffset(pad + 3 * cell + cell * 0.49, pad, cell, 10), 3, '交叉点下方 0.49 格仍命中本行')
  assertEq(indexFromOffset(pad + 3 * cell - cell * 0.49, pad, cell, 10), 3, '交叉点上方 0.49 格仍命中本行')
  // 越过半格才到相邻行
  assertEq(indexFromOffset(pad + 3 * cell + cell * 0.51, pad, cell, 10), 4, '越过半格命中下一行')
  assertEq(indexFromOffset(pad + 3 * cell - cell * 0.51, pad, cell, 10), 2, '越过半格命中上一行')
  // 棋盘外：距首行交叉点超过半格（进入上边距深处）不命中
  assertEq(indexFromOffset(pad - cell * 0.51, pad, cell, 10), null, '首行上方超半格不命中')
  assertEq(indexFromOffset(pad + 9 * cell + cell * 0.9, pad, cell, 10), null, '超出末行半格外不命中')
  assertEq(indexFromOffset(-5, pad, cell, 10), null, '负坐标不命中')
  // 防御：cell<=0 不抛异常
  assertEq(indexFromOffset(10, pad, 0, 10), null, 'cell=0 安全返回 null')
}

// ============================================================
// Suite 25: 送将三态分类 classifyMove + 钉死判定 isPinned
// 背景：引擎已过滤送将，但玩家不知道为什么不能动；
// 视图层用 classifyMove 区分「合法/送将拦截/非法」给出提示。
// ============================================================
console.log('\n=== Suite 25: 送将三态分类与钉死 ===')
{
  // 场景 A：红马被黑车完全钉死（马挡在车与帅之间，任何移动都暴露红帅）
  const a = emptyBoard()
  place(a, 9, 4, 'king', 'red')
  place(a, 0, 3, 'king', 'black')
  place(a, 0, 4, 'rook', 'black')
  place(a, 5, 4, 'horse', 'red')
  assertFalse(isInCheck(a, 'red'), '钉死场景：红方当前未被将（马挡住车线）')
  assertEq(classifyMove(a, { row: 5, col: 4 }, { row: 3, col: 3 }), 'exposes-general', '钉死马跳 (3,3) 被送将拦截')
  assertEq(classifyMove(a, { row: 5, col: 4 }, { row: 7, col: 5 }), 'exposes-general', '钉死马跳 (7,5) 被送将拦截')
  assertFalse(isLegalMove(a, { row: 5, col: 4 }, { row: 3, col: 3 }), '钉死马走法确为非法（与引擎过滤一致）')
  assertTrue(isPinned(a, { row: 5, col: 4 }), '马被完全钉死（伪走法全部送将）')

  // 场景 B：被将军时垫将合法 / 避将合法 / 帅走进攻击线被拦
  const b = emptyBoard()
  place(b, 9, 4, 'king', 'red')
  place(b, 0, 2, 'king', 'black') // 避开 col=3，防红帅避将至 (9,3) 时误触飞将
  place(b, 5, 4, 'rook', 'black')
  place(b, 6, 0, 'rook', 'red')
  assertEq(getGameStatus(b, 'red'), 'check', '垫将场景：红方正被黑车将军')
  assertEq(classifyMove(b, { row: 6, col: 0 }, { row: 6, col: 4 }), 'legal', '垫将：红车平到帅前挡车线合法')
  assertEq(classifyMove(b, { row: 9, col: 4 }, { row: 9, col: 3 }), 'legal', '避将：红帅平移离开车线合法')
  assertEq(classifyMove(b, { row: 9, col: 4 }, { row: 8, col: 4 }), 'exposes-general', '帅走进黑车攻击线被送将拦截')

  // 场景 C：illegal 分类（非该棋子走法 / 起点无子 / 原地不动）
  assertEq(classifyMove(a, { row: 5, col: 4 }, { row: 5, col: 5 }), 'illegal', '马走直线不符合走子规则')
  assertEq(classifyMove(a, { row: 4, col: 4 }, { row: 5, col: 4 }), 'illegal', '起点无子非法')
  assertEq(classifyMove(a, { row: 5, col: 4 }, { row: 5, col: 4 }), 'illegal', '原地不动非法')

  // 场景 D：正常局面下棋子未被钉死
  assertFalse(isPinned(initialBoard(), { row: 9, col: 1 }), '开局红马未被钉死')
  assertFalse(isPinned(a, { row: 4, col: 4 }), '空位 isPinned 返回 false')
}

// ============================================================
// Suite 26: 视角翻转映射 flipIndex（联机黑方己方在下）
// 背景：渲染层与命中层共用同一映射，保证翻转后点哪打哪；
// 引擎层 board 数组坐标不变。
// ============================================================
console.log('\n=== Suite 26: 视角翻转映射 ===')
{
  // 行翻转（ROWS=10）：红方底行 ↔ 屏幕顶行
  assertEq(flipIndex(0, ROWS), 9, '行 0 翻转到 9')
  assertEq(flipIndex(9, ROWS), 0, '行 9 翻转到 0')
  assertEq(flipIndex(3, ROWS), 6, '行 3 翻转到 6')
  // 列翻转（COLS=9，奇数）：中轴列不变
  assertEq(flipIndex(0, COLS), 8, '列 0 翻转到 8')
  assertEq(flipIndex(4, COLS), 4, '中轴列 4 翻转后不变')
  // 自反性：渲染层与命中层互为逆映射
  for (let i = 0; i < ROWS; i++) {
    assertEq(flipIndex(flipIndex(i, ROWS), ROWS), i, '行 ' + i + ' 双重翻转还原')
  }
  for (let i = 0; i < COLS; i++) {
    assertEq(flipIndex(flipIndex(i, COLS), COLS), i, '列 ' + i + ' 双重翻转还原')
  }
  // 翻转后仍落在合法范围内
  for (let i = 0; i < ROWS; i++) {
    const f = flipIndex(i, ROWS)
    assertTrue(f >= 0 && f < ROWS, '行翻转结果在合法范围内')
  }
}


// ============================================================
// Suite 27: toNotation (7 pieces + capture + red/black views)
// ============================================================
console.log('\n=== Suite 27: toNotation ===')
{
  function notate(board, fr, fc, tr, tc, type, side) {
    place(board, fr, fc, type, side)
    const move = { from: { row: fr, col: fc }, to: { row: tr, col: tc } }
    return toNotation(move, board)
  }

  const b = emptyBoard()

  // --- Red view (redCol = 9 - col, col=8 -> 1, col=0 -> 9) ---
  assertEq(notate(b, 7, 1, 7, 4, 'cannon', 'red'), '炮八平五', 'red cannon lateral (col=1->4, red view 8->5)')
  assertEq(notate(b, 9, 1, 7, 2, 'horse', 'red'), '馬八進七', 'red horse jump (col=1->2, red view 8->7)')
  assertEq(notate(b, 9, 0, 0, 0, 'rook', 'red'), '車九進九', 'red rook forward (col=0 view 9, forward 9)')
  assertEq(notate(b, 9, 4, 8, 4, 'king', 'red'), '帥五進一', 'red king forward 1')
  assertEq(notate(b, 6, 0, 5, 0, 'pawn', 'red'), '兵九進一', 'red pawn forward 1 (col=0 view 9)')
  assertEq(notate(b, 9, 3, 8, 4, 'advisor', 'red'), '仕六進五', 'red advisor diagonal (col=3->4, view 6->5)')
  assertEq(notate(b, 9, 2, 7, 4, 'elephant', 'red'), '相七進五', 'red elephant diagonal (col=2->4, view 7->5)')

  // --- Black view (blackCol = col + 1, col=0 -> 1, col=8 -> 9) ---
  assertEq(notate(b, 2, 1, 2, 4, 'cannon', 'black'), '炮二平五', 'black cannon lateral (col=1->4, black view 2->5)')
  assertEq(notate(b, 0, 7, 2, 5, 'horse', 'black'), '馬八進六', 'black horse jump (col=7->5, view 8->7)')
  assertEq(notate(b, 0, 8, 9, 8, 'rook', 'black'), '車九進九', 'black rook forward (col=8 view 9, forward 9)')
  assertEq(notate(b, 0, 4, 1, 4, 'king', 'black'), '將五進一', 'black king forward 1')
  assertEq(notate(b, 3, 0, 4, 0, 'pawn', 'black'), '卒一進一', 'black pawn forward 1 (col=0 view 1)')
  assertEq(notate(b, 0, 3, 1, 4, 'advisor', 'black'), '士四進五', 'black advisor diagonal (col=3->4, view 4->5)')
  assertEq(notate(b, 0, 2, 2, 4, 'elephant', 'black'), '象三進五', 'black elephant diagonal (col=2->4, view 3->5)')

  // --- Captures ---
  const cap = emptyBoard()
  place(cap, 0, 4, 'king', 'black')
  place(cap, 9, 4, 'king', 'red')
  place(cap, 5, 4, 'rook', 'red')
  place(cap, 2, 4, 'horse', 'black')
  const capMove = { from: { row: 5, col: 4 }, to: { row: 2, col: 4 }, captured: cap[2][4] }
  assertEq(toNotation(capMove, cap), '車五進三', 'red rook captures black horse (forward 3)')

  const capBoard2 = emptyBoard()
  place(capBoard2, 0, 4, 'king', 'black')
  place(capBoard2, 9, 4, 'king', 'red')
  place(capBoard2, 2, 4, 'horse', 'black')
  place(capBoard2, 5, 4, 'rook', 'red')
  const capMove2 = { from: { row: 2, col: 4 }, to: { row: 5, col: 4 }, captured: capBoard2[5][4] }
  assertEq(toNotation(capMove2, capBoard2), '馬五進五', 'black horse captures red rook (follows dest col)')

  // --- Retreat (backward) ---
  const bk = emptyBoard()
  assertEq(notate(bk, 5, 8, 6, 8, 'rook', 'red'), '車一退一', 'red rook backward 1 (col=8 view 1)')
  // --- Additional: black retreat ---
  const bk2 = emptyBoard()
  assertEq(notate(bk2, 4, 2, 2, 1, 'horse', 'black'), '馬三退二', 'black horse retreat (col=2->1, black view 3->2)')
  // --- Additional: pawn horizontal (after crossing river) ---
  const bk3 = emptyBoard()
  assertEq(notate(bk3, 4, 0, 4, 1, 'pawn', 'red'), '兵九平八', 'red pawn horizontal (col=0->1, view 9->8)')
  // --- Additional: elephant retreat ---
  const bk4 = emptyBoard()
  assertEq(notate(bk4, 2, 4, 0, 2, 'elephant', 'black'), '象五退三', 'black elephant retreat (col=4->2, view 5->3)')
}

// ============================================================
// Suite 28: 重复局面判定（长将/长捉/双方长打）
// ============================================================
console.log('\n=== Suite 28: 重复局面判定 ===')
{
  // 构造棋盘：给定棋子列表 [row, col, type, side]
  function boardOf(pieces) {
    const b = emptyBoard()
    for (const [row, col, type, side] of pieces) b[row][col] = { type, side }
    return b
  }
  function mv(fr, fc, tr, tc) { return { from: { row: fr, col: fc }, to: { row: tr, col: tc } } }
  // 将 4 步循环重复 3 次得到 12 个半步；positions[k] = 走完 k 步后的局面
  function repeat(cycle, times) {
    const out = []
    for (let i = 0; i < times; i++) out.push(...cycle)
    return out
  }
  function positionsOf(boards, cycleLen, times) {
    // boards 为一个周期的 cycleLen 个局面（P0..P{cycleLen-1}），positions 长度 = cycleLen*times + 1
    const out = []
    for (let i = 0; i <= cycleLen * times; i++) out.push(boards[i % cycleLen])
    return out
  }

  const RKing = [9, 3, 'king', 'red']

  // --- 28.1 单方长将 → 红方判负 ---
  {
    const P0 = boardOf([RKing, [1, 4, 'king', 'black'], [0, 0, 'rook', 'red']])
    const P1 = boardOf([RKing, [1, 4, 'king', 'black'], [1, 0, 'rook', 'red']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [1, 0, 'rook', 'red']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 0, 'rook', 'red']])
    const cycle = [mv(0, 0, 1, 0), mv(1, 4, 0, 4), mv(1, 0, 0, 0), mv(0, 4, 1, 4)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '长将：有判定结果')
    assertEq(v && v.type, 'violation', '长将：type=violation')
    assertEq(v && v.side, 'red', '长将：违规方为红')
    assertEq(v && v.reason, 'perpetual_check', '长将：reason=perpetual_check')
  }

  // --- 28.2 单方长捉（车追马）→ 红方判负 ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [4, 0, 'rook', 'red'], [6, 5, 'horse', 'black']])
    const P1 = boardOf([RKing, [0, 4, 'king', 'black'], [6, 0, 'rook', 'red'], [6, 5, 'horse', 'black']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [6, 0, 'rook', 'red'], [4, 6, 'horse', 'black']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [4, 0, 'rook', 'red'], [4, 6, 'horse', 'black']])
    const cycle = [mv(4, 0, 6, 0), mv(6, 5, 4, 6), mv(6, 0, 4, 0), mv(4, 6, 6, 5)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '长捉：有判定结果')
    assertEq(v && v.type, 'violation', '长捉：type=violation')
    assertEq(v && v.side, 'red', '长捉：违规方为红')
    assertEq(v && v.reason, 'perpetual_chase', '长捉：reason=perpetual_chase')
  }

  // --- 28.3 双方长将 → 判和（mutual_attack） ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 0, 'rook', 'red'], [9, 8, 'rook', 'black']])
    const P1 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 1, 'rook', 'red'], [9, 8, 'rook', 'black']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 1, 'rook', 'red'], [9, 7, 'rook', 'black']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 0, 'rook', 'red'], [9, 7, 'rook', 'black']])
    const cycle = [mv(0, 0, 0, 1), mv(9, 8, 9, 7), mv(0, 1, 0, 0), mv(9, 7, 9, 8)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '双方长将：有判定结果')
    assertEq(v && v.type, 'mutual_draw', '双方长将：type=mutual_draw')
    assertEq(v && v.reason, 'mutual_attack', '双方长将：reason=mutual_attack')
  }

  // --- 28.4 长将优先：红长将 vs 黑长捉 → 长将方（红）判负 ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 0, 'rook', 'red'], [5, 0, 'rook', 'black']])
    const P1 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 1, 'rook', 'red'], [5, 0, 'rook', 'black']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 1, 'rook', 'red'], [5, 1, 'rook', 'black']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [0, 0, 'rook', 'red'], [5, 1, 'rook', 'black']])
    const cycle = [mv(0, 0, 0, 1), mv(5, 0, 5, 1), mv(0, 1, 0, 0), mv(5, 1, 5, 0)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '长将优先：有判定结果')
    assertEq(v && v.type, 'violation', '长将优先：type=violation')
    assertEq(v && v.side, 'red', '长将优先：长将方（红）判负')
    assertEq(v && v.reason, 'perpetual_check', '长将优先：reason=perpetual_check')
  }

  // --- 28.5 双方均闲的重复循环 → 判和（mutual_idle） ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 0, 'rook', 'red'], [6, 8, 'rook', 'black']])
    const P1 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 1, 'rook', 'red'], [6, 8, 'rook', 'black']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 1, 'rook', 'red'], [6, 7, 'rook', 'black']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 0, 'rook', 'red'], [6, 7, 'rook', 'black']])
    const cycle = [mv(5, 0, 5, 1), mv(6, 8, 6, 7), mv(5, 1, 5, 0), mv(6, 7, 6, 8)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '双方闲循环：有判定结果')
    assertEq(v && v.type, 'mutual_draw', '双方闲循环：type=mutual_draw')
    assertEq(v && v.reason, 'mutual_idle', '双方闲循环：reason=mutual_idle')
  }

  // --- 28.6 局面重复但两周期着法不同 → 不判 ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 0, 'rook', 'red']])
    const P1a = boardOf([RKing, [0, 4, 'king', 'black'], [5, 1, 'rook', 'red']])
    const P2a = boardOf([RKing, [0, 3, 'king', 'black'], [5, 1, 'rook', 'red']])
    const P3a = boardOf([RKing, [0, 3, 'king', 'black'], [5, 0, 'rook', 'red']])
    const P1b = boardOf([RKing, [0, 4, 'king', 'black'], [5, 2, 'rook', 'red']])
    const P2b = boardOf([RKing, [0, 3, 'king', 'black'], [5, 2, 'rook', 'red']])
    const P3b = boardOf([RKing, [0, 3, 'king', 'black'], [5, 0, 'rook', 'red']])
    const moves = [
      mv(5, 0, 5, 1), mv(0, 4, 0, 3), mv(5, 1, 5, 0), mv(0, 3, 0, 4),
      mv(5, 0, 5, 2), mv(0, 4, 0, 3), mv(5, 2, 5, 0), mv(0, 3, 0, 4)
    ]
    const positions = [P0, P1a, P2a, P3a, P0, P1b, P2b, P3b, P0]
    const v = checkRepetitionViolation(moves, positions)
    assertEq(v, null, '着法不同的重复：不判')
  }

  // --- 28.7 半步数不足 8 → 不判 ---
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [5, 0, 'rook', 'red']])
    const v = checkRepetitionViolation(
      [mv(5, 0, 5, 1), mv(0, 4, 0, 3), mv(5, 1, 5, 0), mv(0, 3, 0, 4)],
      [P0, P0, P0, P0, P0]
    )
    assertEq(v, null, '半步不足：不判')
  }

  // --- 28.8 一将一捉（混合长打）→ perpetual_attack ---
  // 红马 (4,4)→(2,5) 将军；黑马 (5,3)→(6,5) 闲；红马 (2,5)→(4,4) 后能踩 (6,5) → 捉；黑马 (6,5)→(5,3) 闲返回
  {
    const P0 = boardOf([RKing, [0, 4, 'king', 'black'], [4, 4, 'horse', 'red'], [5, 3, 'horse', 'black']])
    const P1 = boardOf([RKing, [0, 4, 'king', 'black'], [2, 5, 'horse', 'red'], [5, 3, 'horse', 'black']])
    const P2 = boardOf([RKing, [0, 4, 'king', 'black'], [2, 5, 'horse', 'red'], [6, 5, 'horse', 'black']])
    const P3 = boardOf([RKing, [0, 4, 'king', 'black'], [4, 4, 'horse', 'red'], [6, 5, 'horse', 'black']])
    const cycle = [mv(4, 4, 2, 5), mv(5, 3, 6, 5), mv(2, 5, 4, 4), mv(6, 5, 5, 3)]
    const moves = repeat(cycle, 3)
    const positions = positionsOf([P0, P1, P2, P3], 4, 3)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '一将一捉：有判定结果')
    assertEq(v && v.type, 'violation', '一将一捉：type=violation')
    assertEq(v && v.side, 'red', '一将一捉：违规方为红')
    assertEq(v && v.reason, 'perpetual_attack', '一将一捉：reason=perpetual_attack')
  }
}

// ============================================================
// Suite 29: AI 战术（静态搜索 / 迭代加深）
// ============================================================
console.log('\n=== Suite 29: AI 战术 ===')
{
  const { findBestMove } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  function boardOf(pieces) {
    const b = emptyBoard()
    for (const [row, col, type, side] of pieces) b[row][col] = { type, side }
    return b
  }

  // --- 29.1 白吃悬子：无保护的黑马应被红车吃掉 ---
  {
    const b = boardOf([
      [0, 4, 'king', 'black'], [9, 3, 'king', 'red'],
      [5, 0, 'rook', 'red'], [3, 0, 'horse', 'black']
    ])
    const m = findBestMove(b, 'red', 2)
    assertTrue(m !== null, '悬子：AI 有应着')
    assertTrue(m && m.to.row === 3 && m.to.col === 0, '悬子：车吃无保护马',
      m ? 'got ' + m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // --- 29.2 避开陷阱：黑马有车保护，红车不得贪吃（静态搜索消除水平线效应） ---
  {
    const b = boardOf([
      [0, 4, 'king', 'black'], [9, 3, 'king', 'red'],
      [5, 0, 'rook', 'red'], [3, 0, 'horse', 'black'], [0, 0, 'rook', 'black']
    ])
    const m = findBestMove(b, 'red', 2)
    assertTrue(m !== null, '陷阱：AI 有应着')
    assertFalse(m && m.from.row === 5 && m.from.col === 0 && m.to.row === 3 && m.to.col === 0,
      '陷阱：不贪吃有保护的马（车换马亏子）')
  }

  // --- 29.3 一步取胜：AI 应找到将死/困毙着法 ---
  {
    const b = boardOf([
      [0, 4, 'king', 'black'], [9, 3, 'king', 'red'],
      [1, 8, 'rook', 'red'], [5, 0, 'rook', 'red']
    ])
    const m = findBestMove(b, 'red', 2)
    assertTrue(m !== null, '一步杀：AI 有应着')
    const after = applyMove(b, m)
    const st = getGameStatus(after, 'black')
    assertTrue(st === 'checkmate' || st === 'stalemate', '一步杀：走后黑方立败',
      'status=' + st + ' move=' + (m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null'))
    // 黑方已无子可走，findBestMove 应返回 null
    assertEq(findBestMove(after, 'black', 2), null, '一步杀：终局局面 AI 返回 null')
  }

  // --- 29.4 开局纪律：深度 2 不得贪炮打马（回归测试：旧版因水平线效应必走此着） ---
  {
    const b = initialBoard()
    const m = findBestMove(b, 'red', 2)
    assertTrue(m !== null, '开局：AI 有应着')
    const isGreedyCannon = m && m.from.row === 7 &&
      ((m.from.col === 1 && m.to.row === 0 && m.to.col === 1) ||
       (m.from.col === 7 && m.to.row === 0 && m.to.col === 7))
    assertFalse(isGreedyCannon, '开局：不贪炮打马（炮换马亏子）',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // --- 29.5 合法性：AI 返回的着法必须合法 ---
  {
    const b = initialBoard()
    const m = findBestMove(b, 'red', 3)
    assertTrue(m !== null, '合法性：AI 有应着')
    assertTrue(m && isLegalMove(b, m.from, m.to), '合法性：开局深度3着法合法',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // --- 29.6 长将规避：AI 不选择走进重复循环的长将着法（搜索内重复局面强负分） ---
  {
    // 黑将 (1,4) 九宫邻格全被封死仅剩 (0,4) 往返：红车 (0,0)->(1,0) 将军 → 黑将只能 (0,4)
    // → 红车 (1,0)->(0,0) 将军 → 黑将只能 (1,4) = 回到初始局面（红方长将按重复规则判负）。
    // 红方存在吃炮净赚着法，循环线被重复惩罚后不应被选中。
    const b = boardOf([
      [9, 3, 'king', 'red'], [0, 0, 'rook', 'red'],
      [1, 4, 'king', 'black'], [0, 3, 'cannon', 'black'], [0, 5, 'cannon', 'black'],
      [2, 4, 'pawn', 'black'], [1, 3, 'pawn', 'black'], [1, 5, 'pawn', 'black']
    ])
    const m = findBestMove(b, 'red', 4)
    assertTrue(m !== null, '长将规避：AI 有应着')
    assertFalse(m && m.from.row === 0 && m.from.col === 0 && m.to.row === 1 && m.to.col === 0,
      '长将规避：不走进长将循环（(0,0)->(1,0)）',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }
}

// ============================================================
// Suite 30: isInCheckLight 与 rules.isInCheck 语义等价（轻量直扫 vs 全盘伪走法生成）
// ============================================================
console.log('\n=== Suite 30: isInCheckLight 语义等价 ===')
{
  const { isInCheckLight } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  const positions = []
  positions.push({ name: '初始局面', b: initialBoard() })
  // 飞将：将帅同列无阻隔
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    positions.push({ name: '飞将局面', b })
  }
  // 黑车直线将军红帅
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    place(b, 3, 4, 'rook', 'black')
    positions.push({ name: '黑车直将红帅', b })
  }
  // 黑马将红帅（蹩腿位空）
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    place(b, 7, 5, 'horse', 'black')
    positions.push({ name: '黑马将红帅', b })
  }
  // 黑炮隔子将红帅（红兵作炮架）
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    place(b, 2, 4, 'cannon', 'black')
    place(b, 5, 4, 'pawn', 'red')
    positions.push({ name: '黑炮隔子将红帅', b })
  }
  // 黑卒过河斜攻红帅
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    place(b, 8, 3, 'pawn', 'black')
    positions.push({ name: '黑卒斜攻红帅', b })
  }
  // 29.6 长将局面（黑将九宫被封）
  {
    const b = emptyBoard()
    place(b, 9, 3, 'king', 'red')
    place(b, 0, 0, 'rook', 'red')
    place(b, 1, 4, 'king', 'black')
    place(b, 0, 3, 'cannon', 'black')
    place(b, 0, 5, 'cannon', 'black')
    place(b, 2, 4, 'pawn', 'black')
    place(b, 1, 3, 'pawn', 'black')
    place(b, 1, 5, 'pawn', 'black')
    positions.push({ name: '长将局面（29.6）', b })
  }
  for (const { name, b } of positions) {
    assertEq(isInCheckLight(b, 'red'), isInCheck(b, 'red'), name + '：红方被将判定一致')
    assertEq(isInCheckLight(b, 'black'), isInCheck(b, 'black'), name + '：黑方被将判定一致')
  }
}

// ============================================================
// Suite 31: nextKey 增量 Zobrist 与 boardKey 全量一致
// ============================================================
console.log('\n=== Suite 31: nextKey 增量 Zobrist 一致性 ===')
{
  const { boardKey, nextKey } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  // 开局着法序列逐步断言（移子 + 换手）
  const seq = [
    { name: '红炮二平五', from: { row: 7, col: 1 }, to: { row: 7, col: 4 } },
    { name: '黑炮二平五', from: { row: 2, col: 1 }, to: { row: 2, col: 4 } },
    { name: '红马二进三', from: { row: 9, col: 1 }, to: { row: 7, col: 2 } },
    { name: '黑马二进三', from: { row: 0, col: 1 }, to: { row: 2, col: 2 } },
    { name: '红车一平二', from: { row: 9, col: 0 }, to: { row: 9, col: 1 } }
  ]
  let cur = initialBoard()
  let side = 'red'
  let key = boardKey(cur, side)
  assert(key === boardKey(cur, side), '序列起点：rootKey 与全量一致')
  for (const s of seq) {
    const move = { from: s.from, to: s.to }
    key = nextKey(key, cur, move, side)
    cur = applyMove(cur, move)
    side = side === 'red' ? 'black' : 'red'
    assert(key === boardKey(cur, side), s.name + '：增量 key 与全量一致')
  }
  // 吃子场景（victim XOR）
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red')
    place(b, 0, 4, 'king', 'black')
    place(b, 5, 0, 'rook', 'red')
    place(b, 3, 0, 'horse', 'black')
    const move = { from: { row: 5, col: 0 }, to: { row: 3, col: 0 } }
    const next = nextKey(boardKey(b, 'red'), b, move, 'red')
    assert(next === boardKey(applyMove(b, move), 'black'), '吃子：增量 key 与全量一致')
  }
}

// ============================================================
// Suite 32: 深搜索稳定性 / ply 越界防御
// ============================================================
console.log('\n=== Suite 32: 深搜索稳定性 ===')
{
  const { findBestMove } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  // 互将残局：红车将军黑将，黑车可吃子解将并反将红将——搜索反复进出静态搜索吃子链。
  // 回归点：quiescence 被将时深度不受 qdepth 限制，极端互将长链可使 ply 超过
  // MAX_PLY（40），killerMoves 定长数组越界 → moveOrderScore 访问 killers[0] 崩溃
  // （浏览器困难模式实测捕获，栈：moveOrderScore → orderMoves → quiescence ×30+）。
  const b = boardOf([
    [9, 4, 'king', 'red'], [1, 4, 'rook', 'red'],
    [0, 4, 'king', 'black'], [2, 4, 'rook', 'black']
  ])
  const m = findBestMove(b, 'red', 8)
  assertTrue(m !== null, '深搜索：互将残局 d8 有应着')
  assertTrue(m && isLegalMove(b, m.from, m.to), '深搜索：互将残局 d8 着法合法',
    m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  const m2 = findBestMove(b, 'red', 8, 1800)
  assertTrue(m2 !== null, '深搜索：互将残局 d8+1800ms 有应着')
  assertTrue(m2 && isLegalMove(b, m2.from, m2.to), '深搜索：互将残局 d8+1800ms 着法合法',
    m2 ? m2.from.row + ',' + m2.from.col + '->' + m2.to.row + ',' + m2.to.col : 'null')
  // 困难模式真实配置（开局局面，1.8s 时限）
  const m3 = findBestMove(initialBoard(), 'red', 8, 1800)
  assertTrue(m3 !== null, '深搜索：开局 d8+1800ms 有应着')
  assertTrue(m3 && isLegalMove(initialBoard(), m3.from, m3.to), '深搜索：开局 d8+1800ms 着法合法',
    m3 ? m3.from.row + ',' + m3.from.col + '->' + m3.to.row + ',' + m3.to.col : 'null')
}

// ============================================================
// Suite 33: 对局历史长将规避（AI 不走进第 3 次重复判负）
// ============================================================
console.log('\n=== Suite 33: 对局历史长将规避 ===')
{
  const { findBestMove, boardKey } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  // 封将路局面：红兵 (0,1) 挡在车前阻断吃子线（车无净赚吃子着法）、黑炮 (0,3)(0,5) 封
  // 黑将避将横路（车 (1,0) 将 (1,4) 时唯一应着 (0,4)）、红帅 (9,3) 移出 col4 避免飞将。
  // 长将线（车 (0,0)->(1,0) 往返）无子可吃、黑被迫往返，评估为当前局面最优 → 不传历史
  // 时 AI 复现长将；传历史后根着法撞第 3 次重复被强负分拦截 → AI 改走其他合法着法。
  const base = [
    [9, 3, 'king', 'red'], [0, 1, 'pawn', 'red'],
    [0, 3, 'cannon', 'black'], [0, 5, 'cannon', 'black']
  ]
  const mk = (rookR, rookC, kingR, kingC) => {
    const p = emptyBoard()
    for (const [r, c, t, s] of base) place(p, r, c, t, s)
    place(p, rookR, rookC, 'rook', 'red')
    place(p, kingR, kingC, 'king', 'black')
    return p
  }
  // 手工构造对局历史：车将 → 将避 → 车回将 → 将回 × 2（8 个半步）
  // A（车 (1,0)，将 (1,4)）在 p1、p5 出现 2 次 → 根着法车 (0,0)->(1,0) 到达 A 为第 3 次
  const hist = [
    mk(0, 0, 1, 4), // p0
    mk(1, 0, 1, 4), // p1 = A（车将）
    mk(1, 0, 0, 4), // p2（将避）
    mk(0, 0, 0, 4), // p3（车回将）
    mk(0, 0, 1, 4), // p4 = 同当前
    mk(1, 0, 1, 4), // p5 = A
    mk(1, 0, 0, 4), // p6
    mk(0, 0, 0, 4), // p7
    mk(0, 0, 1, 4)  // p8 = 当前局面（红轮到走）
  ]
  const cur = hist[8]
  // 历史 key = positions[0..7]（最近 8 个半步局面，行棋方 k 偶红先，与视图 recentHistoryKeys 一致）
  const historyKeys = hist.slice(0, 8).map((p, i) => boardKey(p, i % 2 === 0 ? 'red' : 'black'))
  const isChase = (m) =>
    m !== null && m.from.row === 0 && m.from.col === 0 && m.to.row === 1 && m.to.col === 0
  // 不传历史：搜索内循环回到 rootKey 仅 repeats=1 不拦截（第 3 次出现在 8 步视距外）→ 长将线评估最高
  const mPlain = findBestMove(cur, 'red', 4)
  assertTrue(isChase(mPlain), '历史盲区：不传历史时 AI 选长将着法（复现连将判负）',
    mPlain ? mPlain.from.row + ',' + mPlain.from.col + '->' + mPlain.to.row + ',' + mPlain.to.col : 'null')
  // 传历史：根着法到达 A（历史第 3 次出现）→ 搜索第一步即强负分 → 不选长将
  const mSafe = findBestMove(cur, 'red', 4, undefined, historyKeys)
  assertTrue(mSafe !== null, '历史感知：有应着')
  assertFalse(isChase(mSafe), '历史感知：不选长将着法（规避第 3 次重复判负）',
    mSafe ? mSafe.from.row + ',' + mSafe.from.col + '->' + mSafe.to.row + ',' + mSafe.to.col : 'null')
  assertTrue(mSafe && isLegalMove(cur, mSafe.from, mSafe.to), '历史感知：着法合法',
    mSafe ? mSafe.from.row + ',' + mSafe.from.col + '->' + mSafe.to.row + ',' + mSafe.to.col : 'null')
}

// ============================================================
// Suite 34: 取消搜索语义（cancelSearch 不破坏后续搜索）
// ============================================================
console.log('\n=== Suite 34: 取消搜索语义 ===')
{
  const { findBestMove, cancelSearch } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  const b = initialBoard()
  // 断言 1：cancel 后正常搜索（标志在入口重置，无残留污染）
  cancelSearch()
  const m1 = findBestMove(b, 'red', 2)
  assertTrue(m1 !== null && isLegalMove(b, m1.from, m1.to), '取消后搜索正常返回合法着法（入口重置标志）',
    m1 ? m1.from.row + ',' + m1.from.col + '->' + m1.to.row + ',' + m1.to.col : 'null')
  // 断言 2：重复 cancel 幂等不抛
  cancelSearch()
  cancelSearch()
  assertTrue(true, '重复 cancelSearch 幂等不抛')
  // 断言 3：连续多次搜索（含 cancel 间隙）结果稳定
  const m2 = findBestMove(b, 'red', 2)
  cancelSearch()
  const m3 = findBestMove(b, 'red', 2)
  assertTrue(m3 !== null && isLegalMove(b, m3.from, m3.to), 'cancel 间隙后再次搜索正常',
    m3 ? m3.from.row + ',' + m3.from.col + '->' + m3.to.row + ',' + m3.to.col : 'null')
  assertEq(JSON.stringify(m2), JSON.stringify(m3), '无取消残留：同局面同深度结果一致')
}

// ============================================================
// Suite 35: 开局库（主变查表，命中直出）
// ============================================================
console.log('\n=== Suite 35: 开局库 ===')
{
  const { lookupOpening } = require(path.join(__dirname, '.tmp-xiangqi', 'openings'))
  const mk = (r1, c1, r2, c2) => ({ from: { row: r1, col: c1 }, to: { row: r2, col: c2 } })
  // 断言 1：初始局面命中且合法（红方有库着法）
  const o1 = lookupOpening(initialBoard(), 'red')
  assertTrue(o1 !== null && isLegalMove(initialBoard(), o1.from, o1.to), '初始局面命中开局库且着法合法',
    o1 ? o1.from.row + ',' + o1.from.col + '->' + o1.to.row + ',' + o1.to.col : 'null')
  // 断言 2：红方库着法后黑方有应着（随机变着同样覆盖黑方）
  const b1 = applyMove(initialBoard(), o1)
  const o2 = lookupOpening(b1, 'black')
  assertTrue(o2 !== null && isLegalMove(b1, o2.from, o2.to), '黑方应着命中且合法',
    o2 ? o2.from.row + ',' + o2.from.col + '->' + o2.to.row + ',' + o2.to.col : 'null')
  // 断言 3：沿中炮直车对屏风马主变逐步走，每步查表均命中且合法
  // （谱：炮二平五 马8进7 马二进三 车9平8 车一平二 马2进3）
  const line = [mk(7, 7, 7, 4), mk(0, 7, 2, 6), mk(9, 7, 7, 6), mk(0, 8, 0, 7), mk(9, 8, 9, 7), mk(0, 1, 2, 2)]
  let b3 = initialBoard()
  let side3 = 'red'
  for (let i = 0; i < line.length; i++) {
    const m = lookupOpening(b3, side3)
    assertTrue(m !== null && isLegalMove(b3, m.from, m.to), '主变第 ' + (i + 1) + ' 步命中且合法',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
    b3 = applyMove(b3, line[i])
    side3 = side3 === 'red' ? 'black' : 'red'
  }
  // 断言 4：走完主变后乱走一步（红车九平八），黑方查表返回 null（超出库覆盖）
  b3 = applyMove(b3, mk(9, 0, 9, 1))
  assertTrue(lookupOpening(b3, 'black') === null, '主变外乱走一步后查表返回 null')
  // 断言 5：中盘乱走 20 步后查表返回 null
  let b5 = initialBoard()
  let side5 = 'red'
  for (let i = 0; i < 20; i++) {
    const ms = generateMoves(b5, side5)
    if (ms.length === 0) break
    b5 = applyMove(b5, ms[Math.floor(Math.random() * ms.length)])
    side5 = side5 === 'red' ? 'black' : 'red'
  }
  assertTrue(lookupOpening(b5, side5) === null, '中盘乱走 20 步后查表返回 null')
  // 随机性（仅记录不硬断言，避免 flaky）：初始局面查 5 次统计变着数
  const seen = new Set()
  for (let i = 0; i < 5; i++) {
    const m = lookupOpening(initialBoard(), 'red')
    if (m) seen.add(m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col)
  }
  console.log('  INFO: 初始局面 5 次查表变着数 = ' + seen.size)
}

// ============================================================
// Suite 36: 结构评估（车半开放线 + 兵形 + 王翼保护）
// 构造原则：每个断言比较两个「仅目标特征不同」的局面，其余特征与子力抵消；
// 无王局面（断言 2-6）隔离王翼项，断言 7 单独带王验证王翼保护。
// ============================================================
console.log('\n=== Suite 36: 结构评估 ===')
{
  const { evaluateBoard } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  // 断言 1：初始局面红黑对称 eval === 0
  assertEq(evaluateBoard(initialBoard()), 0, '初始局面 eval = 0（红黑对称）')

  // 断言 2：车半开放线——列内无己方兵 +25（红兵(6,0) vs (6,1) 仅移动己方兵，子力/PST 相同）
  {
    const a1 = emptyBoard(); place(a1, 5, 0, 'rook', 'red'); place(a1, 6, 0, 'pawn', 'red'); place(a1, 3, 2, 'pawn', 'black')
    const a2 = emptyBoard(); place(a2, 5, 0, 'rook', 'red'); place(a2, 6, 1, 'pawn', 'red'); place(a2, 3, 2, 'pawn', 'black')
    const diff = evaluateBoard(a2) - evaluateBoard(a1)
    assertTrue(diff >= 25, '车半开放线：列内无己方兵时红车 +25', 'diff=' + diff)
  }

  // 断言 3：全开放线——列内无任何兵再 +15（黑兵(3,8) vs (3,0)：新兵表两列 PST 同为 25 抵消，
  // 且两位置同为孤兵，结构项亦抵消，仅开放线特征不同）
  {
    const c1 = emptyBoard(); place(c1, 5, 0, 'rook', 'red'); place(c1, 3, 8, 'pawn', 'black')
    const c2 = emptyBoard(); place(c2, 5, 0, 'rook', 'red'); place(c2, 3, 0, 'pawn', 'black')
    const diff = evaluateBoard(c1) - evaluateBoard(c2)
    assertTrue(diff >= 15, '车全开放线：列内无任何兵再 +15', 'diff=' + diff)
  }

  // 断言 4：孤兵——左右邻列无己方兵 -12（孤立 vs 连兵对）
  {
    const e1 = emptyBoard(); place(e1, 5, 2, 'pawn', 'red'); place(e1, 1, 8, 'pawn', 'red')
    const e2 = emptyBoard(); place(e2, 5, 2, 'pawn', 'red'); place(e2, 5, 3, 'pawn', 'red')
    const diff = evaluateBoard(e2) - evaluateBoard(e1)
    assertTrue(diff >= 12, '孤兵：孤立兵受 -12 惩罚（连兵对照）', 'diff=' + diff)
  }

  // 断言 5：连兵——邻列行差 <= 1 的兵对 +8/兵（相邻列 (5,5) vs 列距 2 的 (5,6)：
  // 新兵表同列行 PST 相同抵消；不相邻双兵孤立 -24 亦计入，净差仍 ≥ 8 下限）
  {
    const g1 = emptyBoard(); place(g1, 5, 4, 'pawn', 'red'); place(g1, 5, 5, 'pawn', 'red')
    const g2 = emptyBoard(); place(g2, 5, 4, 'pawn', 'red'); place(g2, 5, 6, 'pawn', 'red')
    const diff = evaluateBoard(g1) - evaluateBoard(g2)
    assertTrue(diff >= 8, '连兵：邻列行差 <= 1 得奖励', 'diff=' + diff)
  }

  // 断言 6：叠兵——同列多兵每多余 -8（同列双兵 vs 邻列分兵）
  {
    const f1 = emptyBoard(); place(f1, 5, 4, 'pawn', 'red'); place(f1, 6, 4, 'pawn', 'red')
    const f2 = emptyBoard(); place(f2, 5, 4, 'pawn', 'red'); place(f2, 6, 3, 'pawn', 'red')
    const diff = evaluateBoard(f1) - evaluateBoard(f2)
    assertTrue(diff <= -8, '叠兵：同列双兵受 -8 惩罚', 'diff=' + diff)
  }

  // 断言 7：王翼兵保护——王所在列 +/-1 内每己方兵 +6（兵(6,3) vs (6,6) 仅移出王翼）
  {
    const h1 = emptyBoard(); place(h1, 9, 4, 'king', 'red'); place(h1, 6, 3, 'pawn', 'red')
    const h2 = emptyBoard(); place(h2, 9, 4, 'king', 'red'); place(h2, 6, 6, 'pawn', 'red')
    const diff = evaluateBoard(h1) - evaluateBoard(h2)
    assertTrue(diff >= 6, '王翼兵保护：王翼内己方兵 +6', 'diff=' + diff)
  }

  // 断言 8：红黑镜像局面 eval === 0（含王翼项，验证黑方结构取负后对称）
  {
    const b = emptyBoard()
    place(b, 5, 4, 'rook', 'red'); place(b, 4, 4, 'rook', 'black')
    place(b, 6, 0, 'pawn', 'red'); place(b, 3, 8, 'pawn', 'black')
    place(b, 9, 4, 'king', 'red'); place(b, 0, 4, 'king', 'black')
    assertEq(evaluateBoard(b), 0, '红黑镜像局面 eval = 0')
  }
}


// ============================================================
// Suite 37: 兵（卒）位置价值方向（过河/纵深奖励）
// 回归背景：旧兵表方向写反（在家 row 6 最高分、过河反而贬值、row 7-8 不可达
// 却给最高分），AI 全难度不愿挺兵过河且轻视对方过河兵威胁；因红黑镜像对称
// 反转，Suite 36 的初始 eval=0 / 镜像 eval=0 无法捕获，需方向性断言。
// ============================================================
console.log('\n=== Suite 37: 兵位置价值方向 ===')
{
  const { evaluateBoard } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))

  // 断言 1：红兵过河 (4,4) 比在家 (6,4) 更有价值（黑卒固定在家 (3,4) 作镜像对照）
  {
    const home = emptyBoard()
    place(home, 9, 4, 'king', 'red'); place(home, 0, 4, 'king', 'black')
    place(home, 6, 4, 'pawn', 'red'); place(home, 3, 4, 'pawn', 'black')
    const crossed = emptyBoard()
    place(crossed, 9, 4, 'king', 'red'); place(crossed, 0, 4, 'king', 'black')
    place(crossed, 4, 4, 'pawn', 'red'); place(crossed, 3, 4, 'pawn', 'black')
    assertTrue(evaluateBoard(crossed) > evaluateBoard(home),
      '红兵过河价值 > 在家价值',
      'crossed=' + evaluateBoard(crossed) + ' home=' + evaluateBoard(home))
  }

  // 断言 2：黑卒过河 (5,4) 对红方评估更差于在家 (3,4)（红兵固定在家 (6,4) 对照）
  {
    const home = emptyBoard()
    place(home, 9, 4, 'king', 'red'); place(home, 0, 4, 'king', 'black')
    place(home, 6, 4, 'pawn', 'red'); place(home, 3, 4, 'pawn', 'black')
    const crossed = emptyBoard()
    place(crossed, 9, 4, 'king', 'red'); place(crossed, 0, 4, 'king', 'black')
    place(crossed, 6, 4, 'pawn', 'red'); place(crossed, 5, 4, 'pawn', 'black')
    assertTrue(evaluateBoard(crossed) < evaluateBoard(home),
      '黑卒过河对红方评估更差（威胁更大）',
      'crossed=' + evaluateBoard(crossed) + ' home=' + evaluateBoard(home))
  }

  // 断言 3：纵深递增——红兵 row 2 比 row 4 更有价值
  {
    const r4 = emptyBoard()
    place(r4, 9, 4, 'king', 'red'); place(r4, 0, 4, 'king', 'black')
    place(r4, 4, 4, 'pawn', 'red'); place(r4, 3, 4, 'pawn', 'black')
    const r2 = emptyBoard()
    place(r2, 9, 4, 'king', 'red'); place(r2, 0, 4, 'king', 'black')
    place(r2, 2, 4, 'pawn', 'red'); place(r2, 3, 4, 'pawn', 'black')
    assertTrue(evaluateBoard(r2) > evaluateBoard(r4), '红兵纵深递增：row 2 > row 4',
      'r2=' + evaluateBoard(r2) + ' r4=' + evaluateBoard(r4))
  }

  // 断言 4：新表镜像对称回归——初始局面与红黑镜像兵局面 eval 仍 = 0
  assertEq(evaluateBoard(initialBoard()), 0, '初始局面 eval = 0（新兵表对称性回归）')
  {
    const b = emptyBoard()
    place(b, 9, 4, 'king', 'red'); place(b, 0, 4, 'king', 'black')
    place(b, 4, 4, 'pawn', 'red'); place(b, 5, 4, 'pawn', 'black')
    assertEq(evaluateBoard(b), 0, '红黑镜像兵局面 eval = 0')
  }

  // 断言 5：战术回归——新兵表不翻转 Suite 29.4（开局深度 2 不贪炮打马）
  {
    const { findBestMove } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
    const m = findBestMove(initialBoard(), 'red', 2)
    const isGreedyCannon = m && m.from.row === 7 &&
      ((m.from.col === 1 && m.to.row === 0 && m.to.col === 1) ||
       (m.from.col === 7 && m.to.row === 0 && m.to.col === 7))
    assertFalse(isGreedyCannon, '新兵表回归：开局不贪炮打马',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }
}

// ============================================================
// Suite 38: 提前出手（early exit）——大局已定/着法稳定时提前终止
// 背景：困难中局 8 层在 4s 时限内到不了（实测 5 层 2.5s / 7 层 6.2s / 8 层 8.5s），
// 迭代加深几乎必然耗尽时限；决定性优势（默认 900 分 @4 层）与着法稳定
// （默认连续 3 层 @5 层 + |分|>=150）提前终止改善响应，焦灼局面仍搜满。
// 测试用放宽阈值在第 1 层触发退出，机制断言确定性、无计时断言防 flaky。
// ============================================================
console.log('\n=== Suite 38: 提前出手 ===')
{
  const { findBestMove, resetSearchState } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  const same = (a, b) => !!a && !!b &&
    a.from.row === b.from.row && a.from.col === b.from.col &&
    a.to.row === b.to.row && a.to.col === b.to.col

  // 冻结局面：16 手随机谱（红方行棋），冷态实测 d1 最佳 (9,0)->(9,1) ≠ d3 最佳 (8,1)->(1,1)。
  // 注意：跨调用 TT 复用会让浅层搜索命中先前深搜的 TT 条目而返回不同着法，
  // 因此每个测量前 resetSearchState() 清空搜索状态，保证冷态对冷态、断言确定。
  const FROZEN_SEQ = [[7, 1, 4, 1], [2, 7, 6, 7], [9, 6, 7, 4], [6, 7, 3, 7], [9, 7, 7, 8], [2, 1, 9, 1],
    [6, 4, 5, 4], [3, 7, 6, 7], [4, 1, 3, 1], [3, 2, 4, 2], [9, 8, 8, 8], [3, 4, 4, 4],
    [8, 8, 8, 1], [0, 2, 2, 0], [3, 1, 3, 2], [3, 6, 4, 6]]
  let fb = initialBoard()
  for (const [fr, fc, tr, tc] of FROZEN_SEQ) {
    fb = applyMove(fb, { from: { row: fr, col: fc }, to: { row: tr, col: tc } })
  }
  // 测试内现测冷态 m1/m3（前置条件：二者不同，机制断言才可观察；若属性失效此处响亮失败便于换局面）
  resetSearchState()
  const m1 = findBestMove(fb, 'red', 1)
  resetSearchState()
  const m3 = findBestMove(fb, 'red', 3)
  assertTrue(!!m1 && !!m3 && !same(m1, m3), '前置条件：冻结局面 d1 与 d3 最佳着法不同',
    'm1=' + (m1 ? m1.from.row + ',' + m1.from.col + '->' + m1.to.row + ',' + m1.to.col : 'null') +
    ' m3=' + (m3 ? m3.from.row + ',' + m3.from.col + '->' + m3.to.row + ',' + m3.to.col : 'null'))

  // --- 38.1 决定性门槛机制：极小阈值 + minDepth 1 → 第 1 层即退出 ---
  {
    resetSearchState()
    const r = findBestMove(fb, 'red', 3, undefined, undefined, undefined,
      { decisive: { score: -1000000000, minDepth: 1 } })
    assertTrue(!!r && same(r, m1), '决定性门槛：第 1 层触发退出返回 m1',
      r ? r.from.row + ',' + r.from.col + '->' + r.to.row + ',' + r.to.col : 'null')
    assertTrue(!!r && !same(r, m3), '决定性门槛：未继续加深到 m3')
  }

  // --- 38.2 稳定性门槛机制：runs 1 / minDepth 1 / 无分数护栏 → 第 1 层即退出 ---
  {
    resetSearchState()
    const r = findBestMove(fb, 'red', 3, undefined, undefined, undefined,
      { decisive: null, stable: { runs: 1, minDepth: 1, minAbsScore: null } })
    assertTrue(!!r && same(r, m1), '稳定性门槛：第 1 层触发退出返回 m1',
      r ? r.from.row + ',' + r.from.col + '->' + r.to.row + ',' + r.to.col : 'null')
    assertTrue(!!r && !same(r, m3), '稳定性门槛：未继续加深到 m3')
  }

  // --- 38.3 默认参数回归：默认阈值在 d3 不触发（decisive 需 d>=4、stable 需 d>=5）→ 返回 m3 ---
  {
    resetSearchState()
    const r1 = findBestMove(fb, 'red', 3)
    assertTrue(!!r1 && same(r1, m3), '默认参数：不带 earlyExit 深度 3 返回 m3',
      r1 ? r1.from.row + ',' + r1.from.col + '->' + r1.to.row + ',' + r1.to.col : 'null')
    resetSearchState()
    const r2 = findBestMove(fb, 'red', 3, undefined, undefined, undefined, {})
    assertTrue(!!r2 && same(r2, r1), '默认参数：传空对象与不传结果一致',
      r2 ? r2.from.row + ',' + r2.from.col + '->' + r2.to.row + ',' + r2.to.col : 'null')
  }

  // --- 38.4 真实阈值路径：去掉黑一车（决定性大优），decisive {400, 1} 第 1 层退出 ---
  {
    const db = initialBoard()
    db[0][8] = null // 移除黑方 (0,8) 车：红净多一车
    resetSearchState()
    const dm1 = findBestMove(db, 'red', 1)
    resetSearchState()
    const r = findBestMove(db, 'red', 3, undefined, undefined, undefined,
      { decisive: { score: 400, minDepth: 1 } })
    assertTrue(!!r && isLegalMove(db, r.from, r.to), '决定性局面：返回着法合法',
      r ? r.from.row + ',' + r.from.col + '->' + r.to.row + ',' + r.to.col : 'null')
    assertTrue(!!r && same(r, dm1), '决定性局面：score>=400 第 1 层退出，返回 d1 结果',
      r ? r.from.row + ',' + r.from.col + '->' + r.to.row + ',' + r.to.col : 'null')
  }
}

// ============================================================
// Suite 39: 重复局面罚分强度与归属（AI 不主动走进长将判负）
// 回归背景（用户实测：连将→将不死→触发规则判负）：旧实现有三个叠加缺陷——
// ① 罚分 MATE - ply 随层数衰减，败局中可高于「下一步被将死」的分数；
// ② 一律归责最后走子方：前置局面（应由方走出）先于将军局面到达第 3 次出现时，
//    罚分误归应将方、反而奖励将军方；
// ③ 连将与送杀同分时排序可恰好选中连将走满周期。
// 修复：罚分 2*MATE - ply + 按「当前方是否被将」归属 + 被将局面的第 2 次重复
// 即惩罚将军方（再一轮即触发视图判负，提前阻断）。
// ============================================================
console.log('\n=== Suite 39: 重复局面罚分强度 ===')
{
  const { findBestMove, boardKey } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  function posOf(pieces) {
    const b = emptyBoard()
    for (const [r, c, t, s] of pieces) place(b, r, c, t, s)
    return b
  }

  // 构造（红=AI）：帅(9,3)、仕(8,3)、车(0,0)；黑：将(1,4)、卒(2,4)、车(8,5)+车(5,4)、马(7,1)。
  // 红帅被完全封锁（(9,2) 黑马控、(9,4) 黑车控、(8,3) 己方仕占）→ 仅红车能动；
  // 红车任何非将军着法后黑 R(8,5)->(9,5)# 一步杀；
  // 长将循环（两将军均真实成立）：车(0,0)->(1,0)+ 将(1,4)->(0,4) 车(1,0)->(0,0)+ 将(0,4)->(1,4)。
  const COMMON = [
    [9, 3, 'king', 'red'], [8, 3, 'advisor', 'red'],
    [2, 4, 'pawn', 'black'], [8, 5, 'rook', 'black'], [5, 4, 'rook', 'black'], [7, 1, 'horse', 'black']
  ]
  const P0 = posOf([...COMMON, [0, 0, 'rook', 'red'], [1, 4, 'king', 'black']]) // 红行棋（当前根）
  const P1 = posOf([...COMMON, [1, 0, 'rook', 'red'], [1, 4, 'king', 'black']]) // 黑行棋（被将）
  const P2 = posOf([...COMMON, [1, 0, 'rook', 'red'], [0, 4, 'king', 'black']]) // 红行棋
  const P3 = posOf([...COMMON, [0, 0, 'rook', 'red'], [0, 4, 'king', 'black']]) // 黑行棋（被将）
  const hist = [boardKey(P0, 'red'), boardKey(P1, 'black'), boardKey(P2, 'red'), boardKey(P3, 'black')]
  const isPerpetual = (m) => !!m && m.from.row === 0 && m.from.col === 0 && m.to.row === 1 && m.to.col === 0

  // --- 39.1 败局违规偏好回归：修复前 AI 选长将（前置局面先达第 3 次出现、罚分误归应将方），修复后必须避开 ---
  {
    const m = findBestMove(P0, 'red', 6, undefined, hist)
    assertTrue(m !== null, '败局长将：AI 有应着')
    assertTrue(!!m && isLegalMove(P0, m.from, m.to), '败局长将：着法合法',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
    assertFalse(isPerpetual(m), '败局长将：不选违规长将着法（宁可正常被将死）',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // --- 39.2 forced 边界：唯一合法着法必走（rootMoves.length===1 提前返回，被迫违规时引擎不崩） ---
  {
    const b = posOf([
      [9, 4, 'king', 'red'], [0, 4, 'king', 'black'],
      [5, 4, 'rook', 'black'], [5, 5, 'rook', 'black']
    ])
    // 红帅被 R(5,4) 将军：(9,5) 被 R(5,5) 控、(8,4) 在车线上、仅 (9,3) 唯一合法
    const m = findBestMove(b, 'red', 4)
    assertTrue(!!m && m.from.row === 9 && m.from.col === 4 && m.to.row === 9 && m.to.col === 3,
      '唯一合法着法：被迫必走 (9,4)->(9,3)',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // --- 39.3 全流程模拟：AI 连将 + 人类强制应着，20 手内不触发长将判负（用户实测场景回归） ---
  {
    // 红=AI（findBestMove + 历史 key）；黑=人类脚本（被将走唯一应将，否则尝试 (8,5)->(9,5)+ 杀着）
    let board = P0
    const moves = []
    const positions = [P0]
    let side = 'red'
    let verdict = null
    let gameEnded = false
    for (let ply = 0; ply < 20 && !verdict && !gameEnded; ply++) {
      const len = positions.length
      const histKeys = []
      for (let i = Math.max(0, len - 33); i < len - 1; i++) {
        histKeys.push(boardKey(positions[i], i % 2 === 0 ? 'red' : 'black'))
      }
      let m = null
      if (side === 'red') {
        m = findBestMove(board, 'red', 6, undefined, histKeys)
      } else {
        const ms = generateMoves(board, 'black')
        m = isInCheck(board, 'black')
          ? ms[0] // 本构造中应将唯一合法
          : (ms.find(x => x.from.row === 8 && x.from.col === 5 && x.to.row === 9 && x.to.col === 5) || ms[0])
      }
      if (!m) break // 无子可走（终局）
      board = applyMove(board, m)
      moves.push(m)
      positions.push(board)
      side = side === 'red' ? 'black' : 'red'
      verdict = checkRepetitionViolation(moves, positions)
      if (!verdict) {
        const st = getGameStatus(board, side)
        if (st === 'checkmate' || st === 'stalemate') gameEnded = true
      }
    }
    assertEq(verdict, null, '全流程模拟：AI 连将场景 20 手内不触发长将判负',
      verdict ? JSON.stringify(verdict) : '')
  }
}

// ============================================================
// Suite 40: 用户实测棋谱回归（单车底线往返连将判负场景）
// 背景：用户提供真实对局棋谱（红方视角 40 手）：黑 AI 车在底线往返将军、
// 红帅被迫往返应将，走满周期后黑方 perpetual_check 判负。修复后引擎应在
// 第 19 回合（第 2 次连将前）即避开；本套件冻结该棋谱防止回归。
// ============================================================
console.log('\n=== Suite 40: 用户棋谱回归 ===')
{
  const { findBestMove, boardKey } = require(path.join(__dirname, '.tmp-xiangqi', 'ai'))
  const RECORD = ['炮二平五', '馬二進三', '馬二進三', '炮八平六', '車一平二', '馬八進七',
    '兵七進一', '炮六進一', '兵三進一', '炮二進三', '炮八平六', '炮二平七', '馬八進七', '車一平二',
    '車九進一', '車九平八', '車二進九', '炮七進四', '仕四進五', '馬七退八', '馬七進六', '車二進九',
    '馬六進七', '炮六平三', '相七進九', '炮七退一', '仕五退四', '炮七平二', '兵七進一', '炮三平四',
    '兵七進一', '車二平四', '帥五進一', '車四退一', '帥五退一', '車四進一', '帥五進一', '車四退一',
    '帥五退一', '車四進一']

  // 棋谱解析：toNotation 匹配唯一合法着法（自校验棋谱合法性，解析失败即抛错使测试响亮失败）
  function replay(rec) {
    let b = initialBoard()
    let side = 'red'
    const moves = []
    const positions = [initialBoard()]
    for (const s of rec) {
      const m = generateMoves(b, side).find(x => toNotation(x, b) === s)
      if (!m) throw new Error('棋谱解析失败: ' + s + ' (' + side + ')')
      b = applyMove(b, m)
      moves.push(m)
      positions.push(b)
      side = side === 'red' ? 'black' : 'red'
    }
    return { moves, positions }
  }

  // --- 40.1 数据语义：棋谱续走一轮后触发裁决 = 黑方 perpetual_check（用户描述固化） ---
  {
    const { moves, positions } = replay(RECORD)
    let b = positions[positions.length - 1]
    for (const s of ['帥五進一', '車四退一']) {
      // 续走方固定：红帥五進一 → 黑車四退一（与棋谱红先交替一致）
      const sideNow = moves.length % 2 === 0 ? 'red' : 'black'
      const mm = generateMoves(b, sideNow).find(x => toNotation(x, b) === s)
      assertTrue(!!mm, '棋谱续走：' + s + ' 合法（' + sideNow + '）')
      if (!mm) break
      b = applyMove(b, mm)
      moves.push(mm)
      positions.push(b)
    }
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '棋谱数据：续走一轮触发重复局面裁决')
    assertEq(v && v.type, 'violation', '棋谱数据：裁决类型 violation')
    assertEq(v && v.side, 'black', '棋谱数据：违规方黑（AI）')
    assertEq(v && v.reason, 'perpetual_check', '棋谱数据：长将判负')
  }

  // --- 40.2 引擎规避：第 19 回合（第 2 次连将前）黑 AI 不选 車四退一（修复前红） ---
  {
    const { positions } = replay(RECORD)
    const root = positions[37] // 第 19 回合黑方行棋局面（ply 37 奇数 = 黑）
    const histKeys = []
    const len = positions.length
    for (let i = Math.max(0, len - 33); i < len - 1; i++) {
      histKeys.push(boardKey(positions[i], i % 2 === 0 ? 'red' : 'black'))
    }
    const shuttle = generateMoves(root, 'black').find(x => toNotation(x, root) === '車四退一')
    assertTrue(!!shuttle, '棋谱局面：車四退一 是合法着法（连将场景成立）')
    const m = findBestMove(root, 'black', 8, 4000, histKeys, 4)
    assertTrue(m !== null, '引擎规避：黑 AI 有应着')
    assertTrue(!!m && isLegalMove(root, m.from, m.to), '引擎规避：着法合法',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
    const isShuttle = !!m && !!shuttle && m.from.row === shuttle.from.row && m.from.col === shuttle.from.col &&
      m.to.row === shuttle.to.row && m.to.col === shuttle.to.col
    assertFalse(isShuttle, '引擎规避：第 2 次连将前不选 車四退一（修复前红）',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }

  // ============================================================
  // 第二局用户棋谱（70 手）：黑车在 9 路横线隔两格将军，红帅被迫往返应将，
  // 覆盖与第一局不同的连将几何（车与帅不在相邻格）。
  // ============================================================
  const RECORD2 = ['炮二平五', '炮二平五', '馬二進三', '馬八進九', '炮五進四', '炮五進四', '馬三進五', '車九進一',
    '炮八進二', '炮八進二', '炮五退一', '將五進一', '車一進一', '炮八退二', '車一平四', '將五平四',
    '炮八平五', '士四進五', '馬五進七', '車九平八', '馬七進六', '炮八平四', '車九進一', '車八進三',
    '炮五平四', '車八進二', '車九平八', '車八平七', '車八進七', '將四退一', '炮五平六', '車七平五',
    '仕四進五', '炮四進三', '炮四平二', '車五平三', '馬六進四', '士五進六', '車四進六', '將四平五',
    '帥五平四', '士六進五', '車四進一', '士五進六', '炮二進四', '馬九退八', '車四退一', '炮四退五',
    '車四平二', '馬八進九', '車二平四', '車三進三', '馬八進九', '車三退四', '兵九進一', '車三平七',
    '相三進一', '車七進二', '馬九進八', '車七平九', '馬八進六', '車九進二', '帥四進一', '車九退一',
    '帥四退一', '車九進一', '帥四進一', '車九退一', '帥四退一', '車九進一']

  // --- 40.3 数据语义：第二局棋谱本身是长将判负场景 ---
  {
    const { moves, positions } = replay(RECORD2)
    const v = checkRepetitionViolation(moves, positions)
    assertTrue(v !== null, '棋谱2数据：末手触发重复局面裁决')
    assertEq(v && v.type, 'violation', '棋谱2数据：裁决类型 violation')
    assertEq(v && v.side, 'black', '棋谱2数据：违规方黑（AI）')
    assertEq(v && v.reason, 'perpetual_check', '棋谱2数据：长将判负')
  }

  // --- 40.4 引擎规避：第 33 回合（第 2 次连将前）黑 AI 不选 車九進一（修复前红） ---
  {
    const { positions } = replay(RECORD2)
    const root = positions[65] // 第 33 回合黑方行棋局面（ply 65 奇数 = 黑）
    const histKeys = []
    const len = positions.length
    for (let i = Math.max(0, len - 33); i < len - 1; i++) {
      histKeys.push(boardKey(positions[i], i % 2 === 0 ? 'red' : 'black'))
    }
    const shuttle = generateMoves(root, 'black').find(x => toNotation(x, root) === '車九進一')
    assertTrue(!!shuttle, '棋谱2局面：車九進一 是合法着法（连将场景成立）')
    const m = findBestMove(root, 'black', 8, 4000, histKeys, 4)
    assertTrue(m !== null, '引擎规避2：黑 AI 有应着')
    assertTrue(!!m && isLegalMove(root, m.from, m.to), '引擎规避2：着法合法',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
    const isShuttle = !!m && !!shuttle && m.from.row === shuttle.from.row && m.from.col === shuttle.from.col &&
      m.to.row === shuttle.to.row && m.to.col === shuttle.to.col
    assertFalse(isShuttle, '引擎规避2：第 2 次连将前不选 車九進一（修复前红）',
      m ? m.from.row + ',' + m.from.col + '->' + m.to.row + ',' + m.to.col : 'null')
  }
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50))
console.log('XIANGQI: ' + passed + '/' + total + ' passed, ' + failed + ' failed')
if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log('  - ' + f)) }
console.log('='.repeat(50))

module.exports = { total, passed, failed, failures }
