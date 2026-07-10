/**
 * Sokoban level validation — checks every level has box count === target count
 * Reads src/views/SokobanView.vue and parses the levels array.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'src', 'views', 'SokobanView.vue')
const source = fs.readFileSync(filePath, 'utf-8')

// Extract the levels array: from `const levels = [` to the matching `]`
const start = source.indexOf('const levels = [')
if (start === -1) {
  console.error('ERROR: could not find "const levels = [" in source')
  process.exit(1)
}
const bracketStart = source.indexOf('[', start + 'const levels'.length)
let depth = 0
let endIdx = -1
for (let i = bracketStart; i < source.length; i++) {
  const c = source[i]
  if (c === '[') depth++
  else if (c === ']') { depth--; if (depth === 0) { endIdx = i; break } }
}
if (endIdx === -1) {
  console.error('ERROR: could not find end of levels array')
  process.exit(1)
}
const levelsText = source.slice(bracketStart, endIdx + 1)

// Re-create the array via Function (safe here — trusted file content)
const evalLevels = new Function(`return ${levelsText}`)
let levels
try {
  levels = evalLevels()
} catch (e) {
  console.error('ERROR: failed to eval levels array:', e.message)
  process.exit(1)
}

// Validation: count 2 (box) and 3 (target) in data rows
let totalPassed = true
const failures = []

for (let li = 0; li < levels.length; li++) {
  const level = levels[li]
  if (!Array.isArray(level)) continue

  let boxCount = 0
  let targetCount = 0

  for (let rowIndex = 0; rowIndex < level.length; rowIndex++) {
    const row = level[rowIndex]
    if (!Array.isArray(row)) continue
    for (const cell of row) {
      if (cell === 2) boxCount++
      else if (cell === 3) targetCount++
    }
  }

  if (boxCount !== targetCount) {
    totalPassed = false
    failures.push(`关卡 ${li + 1}: 箱子数=${boxCount}, 目标数=${targetCount}`)
  }
}

if (totalPassed) {
  console.log(`PASS: 所有 ${levels.length} 个关卡箱子数 = 目标数`)
  process.exit(0)
} else {
  console.error('FAIL: 以下关卡箱子数与目标数不平衡:')
  failures.forEach(f => console.error(`  - ${f}`))
  process.exit(1)
}
