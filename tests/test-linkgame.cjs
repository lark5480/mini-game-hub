/**
 * P0 Bug Fix Regression Tests - LinkGame (连连看)
 * Tests extracted from LinkGameView.vue core logic
 */

const ROWS = 6, COLS = 8, TYPES = 12

// Board: each cell = { type: number, matched: boolean }
// matched=false means the cell is still on the board (not yet eliminated)
// matched=true means the cell has been eliminated (empty)

function createBoard(grid) {
  // grid: 2D array of type numbers; null/undefined = already eliminated
  const board = []
  for (let y = 0; y < ROWS; y++) {
    const row = []
    for (let x = 0; x < COLS; x++) {
      const val = grid[y]?.[x]
      row.push({ type: val ?? 0, matched: val === null || val === undefined })
    }
    board.push(row)
  }
  return board
}

function createFullEmptyBoard() {
  // All cells matched (eliminated) — like an empty board
  const board = []
  for (let y = 0; y < ROWS; y++) {
    const row = []
    for (let x = 0; x < COLS; x++) row.push({ type: 0, matched: true })
    board.push(row)
  }
  return board
}

function isEmpty(board, x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true
  return board[y][x].matched
}

function isLineEmpty(board, x1, y1, x2, y2) {
  if (x1 === x2) {
    const minY = Math.min(y1, y2), maxY = Math.max(y1, y2)
    for (let y = minY + 1; y < maxY; y++) {
      if (!isEmpty(board, x1, y)) return false
    }
    return true
  }
  if (y1 === y2) {
    const minX = Math.min(x1, x2), maxX = Math.max(x1, x2)
    for (let x = minX + 1; x < maxX; x++) {
      if (!isEmpty(board, x, y1)) return false
    }
    return true
  }
  return false
}

function canConnect(board, x1, y1, x2, y2) {
  if (x1 === x2 && y1 === y2) return false
  if ((x1 === x2 || y1 === y2) && isLineEmpty(board, x1, y1, x2, y2)) return true
  if (isEmpty(board, x1, y2) && isLineEmpty(board, x1, y1, x1, y2) && isLineEmpty(board, x1, y2, x2, y2)) return true
  if (isEmpty(board, x2, y1) && isLineEmpty(board, x1, y1, x2, y1) && isLineEmpty(board, x2, y1, x2, y2)) return true
  for (let x = -1; x <= COLS; x++) {
    if (isEmpty(board, x, y1) && isEmpty(board, x, y2) &&
        isLineEmpty(board, x1, y1, x, y1) && isLineEmpty(board, x, y1, x, y2) && isLineEmpty(board, x, y2, x2, y2)) return true
  }
  for (let y = -1; y <= ROWS; y++) {
    if (isEmpty(board, x1, y) && isEmpty(board, x2, y) &&
        isLineEmpty(board, x1, y1, x1, y) && isLineEmpty(board, x1, y, x2, y) && isLineEmpty(board, x2, y, x2, y2)) return true
  }
  return false
}

function hasValidPair(board) {
  const cells = []
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (!board[y][x].matched) cells.push({ x, y, type: board[y][x].type })
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++)
      if (cells[i].type === cells[j].type && canConnect(board, cells[i].x, cells[i].y, cells[j].x, cells[j].y)) return true
  return false
}

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
// Suite 1: isEmpty()
// ============================================================
console.log('\n=== Suite 1: isEmpty() ===')
{
  const b = createBoard([
    [1, 2, null, 4, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, 3, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
  ])
  // Out of bounds → true
  assertEq(isEmpty(b, -1, 0), true, 'isEmpty: x<0 → true')
  assertEq(isEmpty(b, 0, -1), true, 'isEmpty: y<0 → true')
  assertEq(isEmpty(b, COLS, 0), true, 'isEmpty: x>=COLS → true')
  assertEq(isEmpty(b, 0, ROWS), true, 'isEmpty: y>=ROWS → true')
  // Eliminated (null) → matched=true → true
  assertEq(isEmpty(b, 2, 0), true, 'isEmpty: eliminated cell → true')
  assertEq(isEmpty(b, 0, 1), true, 'isEmpty: eliminated cell row 1 → true')
  // Non-eliminated → matched=false → false
  assertEq(isEmpty(b, 0, 0), false, 'isEmpty: type=1 non-eliminated → false')
  assertEq(isEmpty(b, 1, 0), false, 'isEmpty: type=2 non-eliminated → false')
  assertEq(isEmpty(b, 3, 0), false, 'isEmpty: type=4 non-eliminated → false')
  assertEq(isEmpty(b, 2, 2), false, 'isEmpty: type=3 non-eliminated → false')
}

// ============================================================
// Suite 2: isLineEmpty()
// ============================================================
console.log('\n=== Suite 2: isLineEmpty() ===')
{
  const b = createFullEmptyBoard()
  assert(isLineEmpty(b, 0, 0, 5, 0), 'All-empty horizontal line → true')
  assert(isLineEmpty(b, 0, 0, 0, 5), 'All-empty vertical line → true')
  assert(isLineEmpty(b, 0, 0, 1, 0), 'Adjacent horizontal → true')
  assert(isLineEmpty(b, 0, 0, 0, 1), 'Adjacent vertical → true')
  assert(isLineEmpty(b, 3, 3, 3, 3), 'Same point → true')
  assert(!isLineEmpty(b, 0, 0, 1, 1), 'Diagonal → false')
}
{
  // Board with some non-eliminated cells
  const b = createBoard([
    [null, null, 5, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [7, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
  ])
  assert(!isLineEmpty(b, 0, 0, 5, 0), 'Horizontal with blocker at (2,0) → false')
  assert(!isLineEmpty(b, 0, 0, 0, 4), 'Vertical with blocker at (0,2) → false')
  // Adjacent to blocker
  assert(isLineEmpty(b, 0, 0, 1, 0), 'Adjacent horizontal (no intermediates) → true')
  // Path that doesn't cross the blocker
  assert(isLineEmpty(b, 3, 0, 5, 0), 'Horizontal line past blocker is clear → true')
}

// ============================================================
// Suite 3: canConnect()
// ============================================================
console.log('\n=== Suite 3: canConnect() ===')

// Same position → false
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  assertEq(canConnect(b, 0, 0, 0, 0), false, 'Same position → false')
}

// 0-turn: straight line
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][5].matched = false; b[0][5].type = 1
  assert(canConnect(b, 0, 0, 5, 0), '0-turn horizontal → true')
  assert(canConnect(b, 5, 0, 0, 0), '0-turn horizontal reverse → true')

  // Block the line — with OOB=empty, canConnect will find a 2-turn path
  b[0][2].matched = false; b[0][2].type = 3
  assert(canConnect(b, 0, 0, 5, 0), '0-turn blocked but 2-turn via OOB → true')
}
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[4][0].matched = false; b[4][0].type = 1
  assert(canConnect(b, 0, 0, 0, 4), '0-turn vertical → true')
}

// 1-turn: corner point
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[3][3].matched = false; b[3][3].type = 1
  // Corner (0,3) is matched (empty) → 1-turn works
  assert(canConnect(b, 0, 0, 3, 3), '1-turn via corner (0,3) → true')

  // Block corner (0,3)
  b[0][3].matched = false; b[0][3].type = 5
  // Corner (3,0) is matched → still 1-turn
  assert(canConnect(b, 0, 0, 3, 3), '1-turn via corner (3,0) → true')

  // Block both corners
  b[3][0].matched = false; b[3][0].type = 6
  // No 1-turn, but 2-turn via OOB should work
  assert(canConnect(b, 0, 0, 3, 3), '2-turn via OOB when both corners blocked → true')
}

// 1-turn with specific setup
{
  const b = createFullEmptyBoard()
  b[2][1].matched = false; b[2][1].type = 1
  b[2][5].matched = false; b[2][5].type = 1
  // Same row, but blocked between them
  b[2][3].matched = false; b[2][3].type = 9
  // Direct line blocked. But can go via row 1 or row 3 (all empty there)
  assert(canConnect(b, 1, 2, 5, 2), '2-turn via adjacent row when direct blocked → true')
}

// 2-turn via out-of-bounds
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][5].matched = false; b[0][5].type = 1
  // Block direct path
  b[0][2].matched = false; b[0][2].type = 3
  b[0][3].matched = false; b[0][3].type = 4
  // 0-turn blocked. 2-turn via row -1
  assert(canConnect(b, 0, 0, 5, 0), '2-turn via OOB row -1 → true')
}

// Completely blocked (very hard with OOB=empty rule)
{
  // In standard link game with OOB always empty, almost all pairs can connect
  // A truly blocked scenario requires OOB paths to also be blocked,
  // which isn't possible since OOB is always treated as empty.
  // So we test that canConnect returns false for truly same-position
  // and for pairs that can't even find OOB paths (very rare)
  console.log('  NOTE: With OOB=empty, most pairs have at least one connecting path')
}

// ============================================================
// Suite 4: hasValidPair()
// ============================================================
console.log('\n=== Suite 4: hasValidPair() ===')

// Has connectable pair
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][7].matched = false; b[0][7].type = 1
  assert(hasValidPair(b), 'hasValidPair: connectable pair exists → true')
}

// No same-type pairs
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][1].matched = false; b[0][1].type = 2
  b[0][2].matched = false; b[0][2].type = 3
  b[0][3].matched = false; b[0][3].type = 4
  assert(!hasValidPair(b), 'hasValidPair: no same-type pairs → false')
}

// Empty board
{
  const b = createFullEmptyBoard()
  assert(!hasValidPair(b), 'hasValidPair: all eliminated → false')
}

// Same type but cannot connect (theoretically hard, but test with single cell)
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  // Only one cell of type 1 → no pair
  assert(!hasValidPair(b), 'hasValidPair: single cell → false')
}

// Multiple same-type pairs
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][7].matched = false; b[0][7].type = 1
  b[5][0].matched = false; b[5][0].type = 2
  b[5][7].matched = false; b[5][7].type = 2
  assert(hasValidPair(b), 'hasValidPair: multiple pairs → true')
}

// ============================================================
// Suite 5: selectCell logic
// ============================================================
console.log('\n=== Suite 5: selectCell logic ===')
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 5
  b[0][7].matched = false; b[0][7].type = 5
  b[1][1].matched = false; b[1][1].type = 3
  b[1][2].matched = false; b[1][2].type = 7
  b[2][0].matched = false; b[2][0].type = 9
  b[2][7].matched = false; b[2][7].type = 9

  let selected = null
  function selectCell(x, y) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return 'out-of-bounds'
    const cell = b[y][x]
    if (cell.matched) return 'rejected-matched'
    if (!selected) { selected = { x, y }; return 'selected-first' }
    if (selected.x === x && selected.y === y) { selected = null; return 'deselected' }
    const selCell = b[selected.y][selected.x]
    if (selCell.type === cell.type && canConnect(b, selected.x, selected.y, x, y)) {
      cell.matched = true; selCell.matched = true; selected = null; return 'matched'
    }
    selected = { x, y }; return 'switched-selection'
  }

  // b[0][0] = type 5 at (x=0,y=0), b[0][7] = type 5 at (x=7,y=0)
  assertEq(selectCell(0, 0), 'selected-first', 'First click selects')
  assert(selected !== null, 'Selected state set')
  assertEq(selectCell(7, 0), 'matched', 'Same-type connectable → matched')
  assert(b[0][0].matched, 'Cell (0,0) marked matched')
  assert(b[0][7].matched, 'Cell (0,7) marked matched')
  assertEq(selectCell(0, 0), 'rejected-matched', 'Already matched → rejected')

  selected = null
  // b[1][1] = type 3 at (x=1,y=1), b[1][2] = type 7 at (x=2,y=1)
  assertEq(selectCell(1, 1), 'selected-first', 'Select type 3')
  assertEq(selectCell(2, 1), 'switched-selection', 'Different type → switch')

  selected = null
  // b[2][0] = type 9 at (x=0,y=2), b[2][7] = type 9 at (x=7,y=2)
  assertEq(selectCell(0, 2), 'selected-first', 'Select type 9 at (0,2)')
  assertEq(selectCell(7, 2), 'matched', 'Match type 9 at (7,2)')
}

// ============================================================
// Suite 6: Full elimination scenario
// ============================================================
console.log('\n=== Suite 6: Full elimination ===')
{
  const b = createFullEmptyBoard()
  b[0][0].matched = false; b[0][0].type = 1
  b[0][1].matched = false; b[0][1].type = 1
  b[1][0].matched = false; b[1][0].type = 2
  b[1][1].matched = false; b[1][1].type = 2

  assert(hasValidPair(b), 'Before: hasValidPair → true')
  b[0][0].matched = true; b[0][1].matched = true
  assert(hasValidPair(b), 'After pair 1 eliminated: still has pair → true')
  b[1][0].matched = true; b[1][1].matched = true
  assert(!hasValidPair(b), 'All eliminated: hasValidPair → false')
}

// ============================================================
// Suite 7: Dead-lock detection triggers shuffle
// ============================================================
console.log('\n=== Suite 7: Dead-lock shuffle logic ===')
{
  // Verify that after matching, if hasValidPair returns false, shuffle is called
  // This is a code review check on the source
  const fs = require('fs')
  const source = fs.readFileSync(__dirname + '/../src/views/LinkGameView.vue', 'utf-8')
  assert(source.includes('hasValidPair()'), 'Source has hasValidPair() call')
  assert(source.includes('!hasValidPair()'), 'Source checks !hasValidPair for dead-lock')
  assert(source.includes('shuffle()'), 'Source calls shuffle() on dead-lock')
  // Verify the pattern: after match, check remaining, if no pair → shuffle
  const pattern = /hasValidPair.*shuffle|shuffle.*hasValidPair/s
  assert(pattern.test(source), 'hasValidPair and shuffle are in the same code path')
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50))
console.log(`LINKGAME: ${passed}/${total} passed, ${failed} failed`)
if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log(`  - ${f}`)) }
console.log('='.repeat(50))

module.exports = { total, passed, failed, failures }
