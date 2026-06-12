/**
 * P0 Bug Fix Regression Tests - Sokoban (推箱子)
 * Tests extracted from SokobanView.vue core logic
 */

// Encoding: 0=empty, 1=player, 2=box, 3=target, 4=box-done, 5=wall
const levels = [
  [
    [5,5,5,5,5,5],
    [5,0,0,0,0,5],
    [5,0,0,2,0,5],
    [5,0,1,0,0,5],
    [5,0,0,3,0,5],
    [5,5,5,5,5,5]
  ],
  [
    [5,5,5,5,5,5,5],
    [5,0,0,0,0,0,5],
    [5,0,2,0,1,0,5],
    [5,0,0,0,0,0,5],
    [5,0,0,2,0,0,5],
    [5,0,0,3,3,0,5],
    [5,5,5,5,5,5,5]
  ],
  [
    [5,5,5,5,5,5,5],
    [5,0,1,0,0,0,5],
    [5,0,2,0,2,0,5],
    [5,0,0,0,0,0,5],
    [5,0,2,0,0,0,5],
    [5,3,3,3,0,0,5],
    [5,5,5,5,5,5,5]
  ]
]

function getCellClass(cell) {
  const classes = { 0: 'empty', 1: 'player', 2: 'box', 3: 'target', 4: 'box-done', 5: 'wall' }
  return classes[cell] || 'empty'
}

function findPlayer(board) {
  for (let y = 0; y < board.length; y++)
    for (let x = 0; x < board[y].length; x++)
      if (board[y][x] === 1) return { x, y }
  return null
}

function isValid(board, x, y) {
  return y >= 0 && y < board.length && x >= 0 && x < board[y].length
}

function isTarget(levelData, x, y) {
  return levelData[y]?.[x] === 3
}

function checkWin(board, levelData) {
  for (let y = 0; y < board.length; y++)
    for (let x = 0; x < board[y].length; x++)
      if (levelData[y][x] === 3 && board[y][x] !== 2 && board[y][x] !== 4) return false
  return true
}

function move(board, levelData, dx, dy) {
  const pp = findPlayer(board)
  if (!pp) return false
  const nx = pp.x + dx, ny = pp.y + dy
  if (!isValid(board, nx, ny)) return false
  const target = board[ny][nx]
  if (target === 5) return false
  if (target === 0 || target === 3) {
    board[ny][nx] = 1
    board[pp.y][pp.x] = isTarget(levelData, pp.x, pp.y) ? 3 : 0
    return true
  } else if (target === 2 || target === 4) {
    const nnx = nx + dx, nny = ny + dy
    if (!isValid(board, nnx, nny)) return false
    const behind = board[nny][nnx]
    if (behind === 5 || behind === 2 || behind === 4) return false
    if (behind === 0 || behind === 3) {
      board[nny][nnx] = behind === 3 ? 4 : 2
      board[ny][nx] = 1
      board[pp.y][pp.x] = isTarget(levelData, pp.x, pp.y) ? 3 : 0
      return true
    }
  }
  return false
}

function deepCopy(arr) { return JSON.parse(JSON.stringify(arr)) }

// ---- Test Framework ----
let total = 0, passed = 0, failed = 0
const failures = []

function assert(cond, name, detail) {
  total++
  if (cond) { passed++; console.log(`  PASS: ${name}`) }
  else { failed++; const m = detail ? `${name} — ${detail}` : name; failures.push(m); console.log(`  FAIL: ${m}`) }
}
function assertEq(a, e, n) { assert(a === e, n, `Expected ${JSON.stringify(e)}, Got ${JSON.stringify(a)}`) }

// ============================================================
// Suite 1: getCellClass
// ============================================================
console.log('\n=== Suite 1: getCellClass mapping ===')
assertEq(getCellClass(0), 'empty', '0→empty')
assertEq(getCellClass(1), 'player', '1→player')
assertEq(getCellClass(2), 'box', '2→box')
assertEq(getCellClass(3), 'target', '3→target')
assertEq(getCellClass(4), 'box-done', '4→box-done')
assertEq(getCellClass(5), 'wall', '5→wall')
assertEq(getCellClass(99), 'empty', 'unknown→empty')

// ============================================================
// Suite 2: Level structure
// ============================================================
console.log('\n=== Suite 2: Level data structure ===')
levels.forEach((lv, i) => {
  assert(lv.flat().includes(1), `L${i+1} has player(1)`)
  assert(lv.flat().includes(2), `L${i+1} has box(2)`)
  assert(lv.flat().includes(3), `L${i+1} has target(3)`)
  assert(lv.flat().includes(5), `L${i+1} has wall(5)`)
  assert(lv[0].every(c => c === 5), `L${i+1} top wall`)
  assert(lv[lv.length-1].every(c => c === 5), `L${i+1} bottom wall`)
  assert(lv.every(r => r[0] === 5), `L${i+1} left wall`)
  assert(lv.every(r => r[r.length-1] === 5), `L${i+1} right wall`)
  const bc = lv.flat().filter(c => c === 2).length
  const tc = lv.flat().filter(c => c === 3).length
  assertEq(bc, tc, `L${i+1} box count === target count`)
})

// ============================================================
// Suite 3: Wall collision
// ============================================================
console.log('\n=== Suite 3: move() wall collision ===')
{
  const b = deepCopy(levels[0])
  assert(move(b, levels[0], -1, 0) === true, 'Move left to empty OK')
  assert(move(b, levels[0], -1, 0) === false, 'Move left into wall blocked')
}
{
  const b = [
    [5,5,5,5,5],
    [5,0,2,5,5],
    [5,0,1,0,5],
    [5,0,0,0,5],
    [5,5,5,5,5]
  ]
  const ld = deepCopy(b)
  const r = move(b, ld, 0, -1) // push box(2,1) up → wall(2,0)
  assert(r === false, 'Push box into wall blocked')
  assertEq(b[1][2], 2, 'Box stays')
  assertEq(b[2][2], 1, 'Player stays')
}
{
  const b = [
    [5,5,5,5,5],
    [5,0,0,0,5],
    [5,1,2,2,5],
    [5,0,0,0,5],
    [5,5,5,5,5]
  ]
  const ld = deepCopy(b)
  assert(move(b, ld, 1, 0) === false, 'Push box into another box blocked')
}
{
  const b = [
    [5,5,5,5,5],
    [5,0,4,5,5],
    [5,0,1,0,5],
    [5,0,3,0,5],
    [5,5,5,5,5]
  ]
  const ld = [
    [5,5,5,5,5],
    [5,0,3,5,5],
    [5,0,1,0,5],
    [5,0,3,0,5],
    [5,5,5,5,5]
  ]
  assert(move(b, ld, 0, -1) === false, 'Push box-done(4) into wall blocked')
}

// ============================================================
// Suite 4: Valid movements
// ============================================================
console.log('\n=== Suite 4: move() valid movements ===')
{
  const b = deepCopy(levels[0])
  assert(move(b, levels[0], -1, 0), 'Walk to empty(0)')
  assertEq(b[3][2], 0, 'Leaves empty behind')
  assertEq(b[3][1], 1, 'Appears at new pos')
}
{
  const b = [[5,5,5,5,5],[5,1,3,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = [[5,5,5,5,5],[5,1,3,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  assert(move(b, ld, 1, 0), 'Walk to target(3)')
  assertEq(b[1][1], 0, 'Leaves empty behind (not on target)')
  assertEq(b[1][2], 1, 'Appears on target')
}
{
  const b = [[5,5,5,5,5],[5,1,2,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = deepCopy(b)
  assert(move(b, ld, 1, 0), 'Push box to empty')
  assertEq(b[1][3], 2, 'Box at new pos')
  assertEq(b[1][2], 1, 'Player takes box pos')
  assertEq(b[1][1], 0, 'Empty behind player')
}
{
  const b = [[5,5,5,5,5],[5,1,2,3,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = deepCopy(b)
  assert(move(b, ld, 1, 0), 'Push box onto target')
  assertEq(b[1][3], 4, 'Box on target → box-done(4)')
  assertEq(b[1][2], 1, 'Player at box pos')
}
{
  const b = [[5,5,3,5,5],[5,0,1,0,5],[5,0,3,0,5],[5,5,5,5,5]]
  const ld = [[5,5,3,5,5],[5,0,3,0,5],[5,0,3,0,5],[5,5,5,5,5]]
  // Player at (2,1) standing on original target → move down
  assert(move(b, ld, 0, 1), 'Step off target onto target')
  assertEq(b[1][2], 3, 'Previous pos restored to target(3)')
  assertEq(b[2][2], 1, 'Player at new target')
}

// ============================================================
// Suite 5: checkWin
// ============================================================
console.log('\n=== Suite 5: checkWin() ===')
{
  const b = deepCopy(levels[0])
  assert(!checkWin(b, levels[0]), 'Not winning: target has no box')
}
{
  const b = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,1,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,3,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  assert(!checkWin(b, ld), 'Not winning: target has player(1)')
}
{
  const b = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,4,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,3,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  assert(checkWin(b, ld), 'Winning: all targets have box-done(4)')
}
{
  const b = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,2,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  const ld = [[5,5,5,5,5],[5,0,0,0,5],[5,0,0,0,5],[5,0,3,0,5],[5,0,0,0,5],[5,5,5,5,5]]
  assert(checkWin(b, ld), 'Winning: target has box(2) (cell===2 accepted)')
}
{
  const b = [[5,5,5,5,5,5],[5,0,0,0,0,5],[5,0,4,0,0,5],[5,0,3,0,0,5],[5,0,0,0,0,5],[5,5,5,5,5,5]]
  const ld = [[5,5,5,5,5,5],[5,0,0,0,0,5],[5,0,3,0,0,5],[5,0,3,0,0,5],[5,0,0,0,0,5],[5,5,5,5,5,5]]
  assert(!checkWin(b, ld), 'Not winning: partial completion (1 of 2 targets)')
}
{
  const b = [[5,5,5,5,5,5],[5,0,0,0,0,5],[5,0,4,0,0,5],[5,0,4,0,0,5],[5,0,0,0,0,5],[5,5,5,5,5,5]]
  const ld = [[5,5,5,5,5,5],[5,0,0,0,0,5],[5,0,3,0,0,5],[5,0,3,0,0,5],[5,0,0,0,0,5],[5,5,5,5,5,5]]
  assert(checkWin(b, ld), 'Winning: both targets have box-done(4)')
}

// ============================================================
// Suite 6: Template variable fix verification
// ============================================================
console.log('\n=== Suite 6: Template variable {{ levelIndex + 1 }} ===')
const fs = require('fs')
const source = fs.readFileSync(__dirname + '/../src/views/SokobanView.vue', 'utf-8')
// 重构后 levelIndex + 1 可能出现在 {{ }} 插值或 :value="levelIndex + 1" 绑定中
const hasLevelIndexPlus1 = source.includes('{{ levelIndex + 1 }}') || /levelIndex\s*\+\s*1/.test(source)
assert(hasLevelIndexPlus1, 'Template uses levelIndex + 1 (not level)')
assert(!/\{\{\s*level\s*\+\s*1\s*\}\}/.test(source), 'Template does NOT use wrong variable "level"')

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50))
console.log(`SOKOBAN: ${passed}/${total} passed, ${failed} failed`)
if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log(`  - ${f}`)) }
console.log('='.repeat(50))

module.exports = { total, passed, failed, failures }
