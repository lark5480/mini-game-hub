/**
 * P0 Bug Fix Regression Tests - Tetris (俄罗斯方块)
 * Verifies: stepCount removed, no forced game over, spawnPiece collision is sole end condition
 */

const fs = require('fs')
const path = require('path')

// ---- Test Framework ----
let total = 0, passed = 0, failed = 0
const failures = []

function assert(cond, name, detail) {
  total++
  if (cond) { passed++; console.log(`  PASS: ${name}`) }
  else { failed++; const m = detail ? `${name} — ${detail}` : name; failures.push(m); console.log(`  FAIL: ${m}`) }
}
function assertEq(a, e, n) { assert(a === e, n, `Expected ${JSON.stringify(e)}, Got ${JSON.stringify(a)}`) }

function extractFunction(source, funcName) {
  const idx = source.indexOf(`function ${funcName}`)
  if (idx === -1) return null
  let braceCount = 0, started = false, end = idx
  for (let i = idx; i < source.length; i++) {
    if (source[i] === '{') { braceCount++; started = true }
    if (source[i] === '}') { braceCount-- }
    if (started && braceCount === 0) { end = i + 1; break }
  }
  return source.substring(idx, end)
}

// Read source
const sourcePath = path.join(__dirname, '..', 'src', 'views', 'TetrisView.vue')
const source = fs.readFileSync(sourcePath, 'utf-8')

// ============================================================
// Suite 1: stepCount variable removed
// ============================================================
console.log('\n=== Suite 1: stepCount variable removed ===')
assert(!/\bstepCount\b/.test(source), 'No stepCount variable in entire file')
assert(!/stepCount\s*=/.test(source), 'No stepCount assignment')
assert(!/let\s+stepCount/.test(source), 'No let stepCount')
assert(!/const\s+stepCount/.test(source), 'No const stepCount')
assert(!/var\s+stepCount/.test(source), 'No var stepCount')

// ============================================================
// Suite 2: No forced game over in step()
// ============================================================
console.log('\n=== Suite 2: No forced game over in step() ===')
{
  const stepBody = extractFunction(source, 'step')
  assert(stepBody !== null, 'step() function found')
  if (stepBody) {
    assert(!/stepCount/.test(stepBody), 'step() does not reference stepCount')
    assert(!/>\s*500/.test(stepBody), 'step() does not contain > 500 threshold')
    assert(!/>\s*\d{2,}/.test(stepBody), 'step() does not contain large number thresholds')
    assert(!/endGame/.test(stepBody), 'step() does NOT directly call endGame')
    assert(/collides/.test(stepBody), 'step() contains collides check')
    assert(/placePiece|clearLines|spawnPiece/.test(stepBody), 'step() has standard game flow')
  }
}

// ============================================================
// Suite 3: spawnPiece() is the sole game-over trigger
// ============================================================
console.log('\n=== Suite 3: spawnPiece() is sole game-over trigger ===')
{
  // Find all endGame() calls (not the function definition itself)
  const endGamePattern = /endGame\(\)/g
  let match
  const callers = []
  while ((match = endGamePattern.exec(source)) !== null) {
    const pos = match.index
    // Find which function this is in
    const beforeFunc = source.lastIndexOf('function ', pos)
    const funcMatch = source.substring(beforeFunc, beforeFunc + 80).match(/function\s+(\w+)/)
    const funcName = funcMatch ? funcMatch[1] : 'unknown'
    // Check if this IS the function definition line
    const lineStart = source.lastIndexOf('\n', pos) + 1
    const lineEnd = source.indexOf('\n', pos)
    const line = source.substring(lineStart, lineEnd !== -1 ? lineEnd : source.length).trim()
    if (!line.startsWith('function endGame')) {
      callers.push(funcName)
    }
  }

  console.log(`  endGame() callers: [${callers.join(', ')}]`)
  const onlySpawnPiece = callers.length === 1 && callers[0] === 'spawnPiece'
  assert(onlySpawnPiece, 'Only spawnPiece() calls endGame()', `Found callers: [${callers.join(', ')}]`)
}

// ============================================================
// Suite 4: spawnPiece() uses collides to detect game over
// ============================================================
console.log('\n=== Suite 4: spawnPiece() collides detection ===')
{
  const spawnBody = extractFunction(source, 'spawnPiece')
  assert(spawnBody !== null, 'spawnPiece() function found')
  if (spawnBody) {
    assert(/collides/.test(spawnBody), 'spawnPiece() contains collides check')
    assert(/endGame/.test(spawnBody), 'spawnPiece() calls endGame when collides')
    assert(!/stepCount/.test(spawnBody), 'spawnPiece() does not reference stepCount')
    assert(!/>\s*500/.test(spawnBody), 'spawnPiece() does not contain step threshold')
    assert(/if\s*\(\s*collides/.test(spawnBody), 'spawnPiece(): if(collides) triggers endGame')
  }
}

// ============================================================
// Suite 5: collides() function logic
// ============================================================
console.log('\n=== Suite 5: collides() function ===')
{
  const collidesBody = extractFunction(source, 'collides')
  assert(collidesBody !== null, 'collides() function found')
  if (collidesBody) {
    assert(/GRID_W/.test(collidesBody), 'collides() checks GRID_W boundary')
    assert(/GRID_H/.test(collidesBody), 'collides() checks GRID_H boundary')
    assert(/\.color/.test(collidesBody), 'collides() checks cell color (occupied)')
    assert(!/stepCount/.test(collidesBody), 'collides() does not reference stepCount')
  }
}

// ============================================================
// Suite 6: No forced-end patterns anywhere
// ============================================================
console.log('\n=== Suite 6: No forced-end patterns ===')
assert(!/stepCount\s*>\s*500/.test(source), 'No stepCount > 500 in file')
assert(!/stepCount\s*>/.test(source), 'No stepCount > any value in file')
assert(!/step\s*[Cc]ount/.test(source), 'No stepCount (case-insensitive) in file')
assert(!/forceEnd|force_end|forcedEnd/.test(source), 'No forceEnd patterns in file')

// ============================================================
// Suite 7: startGame() clean
// ============================================================
console.log('\n=== Suite 7: startGame() clean ===')
{
  const startBody = extractFunction(source, 'startGame')
  assert(startBody !== null, 'startGame() function found')
  if (startBody) {
    assert(!/stepCount/.test(startBody), 'startGame() does not reference stepCount')
    assert(!/>\s*\d{2,}/.test(startBody), 'startGame() no large number thresholds')
    assert(/score\.value\s*=\s*0/.test(startBody), 'startGame() resets score to 0')
    assert(/lines\.value\s*=\s*0/.test(startBody), 'startGame() resets lines to 0')
  }
}

// ============================================================
// Suite 8: Game end logic — only in spawnPiece
// ============================================================
console.log('\n=== Suite 8: Game end logic verification ===')
{
  const endGameFunc = extractFunction(source, 'endGame')
  assert(endGameFunc !== null, 'endGame() function found')
  if (endGameFunc) {
    assert(/isPlaying\.value\s*=\s*false/.test(endGameFunc), 'endGame() sets isPlaying=false')
    assert(/gameOver\.value\s*=\s*true/.test(endGameFunc), 'endGame() sets gameOver=true')
    assert(/gameLoop\.stop\(\)/.test(endGameFunc) || /clearInterval/.test(endGameFunc), 'endGame() stops game loop (gameLoop.stop or clearInterval)')
  }
}

// ============================================================
// Summary
// ============================================================
console.log('\n' + '='.repeat(50))
console.log(`TETRIS: ${passed}/${total} passed, ${failed} failed`)
if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log(`  - ${f}`)) }
console.log('='.repeat(50))

module.exports = { total, passed, failed, failures }
