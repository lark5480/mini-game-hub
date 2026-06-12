/**
 * Bug 2 修复验证: 接水果 CatchFruitView.vue — 游戏结束弹窗
 * 验证项:
 *   1. gameOver ref 存在
 *   2. startGame() 中 gameOver = false
 *   3. endGame() 中 gameOver = true
 *   4. 模板中有 dialog-overlay 弹窗
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

const FILE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'views', 'CatchFruitView.vue'),
  'utf-8'
)

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  PASS: ${name}`)
    passed++
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`)
    failed++
  }
}

console.log('\n=== Bug 2: 接水果游戏结束弹窗 ===\n')

// ────────────── 1. gameOver ref ──────────────

test('gameOver ref 存在', () => {
  assert.ok(
    /gameOver\s*=\s*ref\(/.test(FILE),
    'gameOver ref 未找到'
  )
})

test('gameOver ref 初始值为 false', () => {
  assert.ok(
    /gameOver\s*=\s*ref\(false\)/.test(FILE),
    'gameOver 初始值不为 false'
  )
})

// ────────────── 2. startGame 重置 gameOver ──────────────

test('startGame() 中 gameOver.value = false', () => {
  const startMatch = FILE.match(/function\s+startGame\s*\(\)\s*\{[^}]+\}/s)
  assert.ok(startMatch, 'startGame 函数未找到')
  const body = startMatch[0]
  assert.ok(
    /gameOver\.value\s*=\s*false/.test(body),
    'startGame 中没有 gameOver.value = false'
  )
})

// ────────────── 3. endGame 设置 gameOver ──────────────

test('endGame() 中 gameOver.value = true', () => {
  const endMatch = FILE.match(/function\s+endGame\s*\(\)\s*\{[^}]+\}/s)
  assert.ok(endMatch, 'endGame 函数未找到')
  const body = endMatch[0]
  assert.ok(
    /gameOver\.value\s*=\s*true/.test(body),
    'endGame 中没有 gameOver.value = true'
  )
})

// ────────────── 4. 模板弹窗 ──────────────
// 重构后弹窗由 GameDialog 组件实现

test('模板中有 GameDialog 组件绑定 gameOver', () => {
  assert.ok(
    /GameDialog/.test(FILE) &&
    (/v-model:visible="gameOver"/.test(FILE) || /:visible="gameOver"/.test(FILE)),
    '模板中缺少 GameDialog 绑定 gameOver'
  )
})

test('弹窗中有"游戏结束"文本', () => {
  // GameDialog 使用 title prop
  assert.ok(
    /title="游戏结束"/.test(FILE) || /游戏结束/.test(FILE),
    '弹窗中缺少"游戏结束"文本'
  )
})

test('弹窗中有"再来一局"按钮', () => {
  // GameDialog 使用 actionText prop
  assert.ok(
    /actionText="再来一局"/.test(FILE) || /再来一局/.test(FILE),
    '弹窗中缺少"再来一局"按钮'
  )
})

test('弹窗样式使用 #05FFA1 绿色主题（赛博朋克风格）', () => {
  assert.ok(
    /#05FFA1/.test(FILE),
    '缺少 #05FFA1 绿色主题色'
  )
})

test('弹窗按钮调用 startGame', () => {
  // GameDialog 使用 @action 事件
  assert.ok(
    /@action="startGame"/.test(FILE) || /@click="startGame"/.test(FILE),
    '弹窗"再来一局"按钮未绑定 startGame'
  )
})

// ────────────── 汇总 ──────────────

console.log(`\n  结果: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
