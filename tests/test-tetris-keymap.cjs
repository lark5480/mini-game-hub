/**
 * Bug 1 修复验证: 俄罗斯方块 TetrisView.vue — 键位映射修复
 * 重构后键盘绑定由 useGameKeyboard composable 管理
 * 验证项:
 *   1. softDrop() 函数存在且逻辑正确：下移1格 + 加1分
 *   2. useGameKeyboard bindings 中 ArrowDown/S 绑定 softDrop，Space 绑定 drop
 *   3. ArrowUp/W 绑定 switchShape（旋转），Space 不绑定旋转
 *   4. 键盘提示文本更新
 *   5. DirectionPad 触控：@down 绑 softDrop，硬降按钮存在
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

const FILE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'views', 'TetrisView.vue'),
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

console.log('\n=== Bug 1: 俄罗斯方块键位映射修复 ===\n')

// ────────────── 1. softDrop 函数 ──────────────

test('softDrop() 函数存在', () => {
  assert.ok(/function\s+softDrop\s*\(/.test(FILE), 'softDrop 函数未找到')
})

test('softDrop() 下移1格 (current.value.y++)', () => {
  const softDropMatch = FILE.match(/function\s+softDrop\s*\(\)\s*\{[^}]+\}/s)
  assert.ok(softDropMatch, 'softDrop 函数体未匹配')
  const body = softDropMatch[0]
  assert.ok(/current\.value\.y\+\+/.test(body), 'softDrop 中没有 current.value.y++')
})

test('softDrop() 加1分 (score.value += 1)', () => {
  const softDropMatch = FILE.match(/function\s+softDrop\s*\(\)\s*\{[^}]+\}/s)
  assert.ok(softDropMatch, 'softDrop 函数体未匹配')
  const body = softDropMatch[0]
  assert.ok(/score\.value\s*\+=\s*1/.test(body), 'softDrop 中没有 score.value += 1')
})

test('softDrop() 碰撞检测 (collides check)', () => {
  const softDropMatch = FILE.match(/function\s+softDrop\s*\(\)\s*\{[^}]+\}/s)
  assert.ok(softDropMatch, 'softDrop 函数体未匹配')
  const body = softDropMatch[0]
  assert.ok(/collides/.test(body), 'softDrop 中没有碰撞检测')
  assert.ok(/current\.value\.y\s*\+\s*1/.test(body), 'softDrop 碰撞检测未检查 y+1')
})

// ────────────── 2. useGameKeyboard 键位绑定 ──────────────
// 重构后使用声明式绑定：{ key: [...], handler: ... }

test('ArrowDown 绑定 softDrop', () => {
  // 查找包含 ArrowDown 的 binding，其 handler 中调用 softDrop
  assert.ok(
    /ArrowDown.*softDrop|key:.*ArrowDown[\s\S]*?softDrop/s.test(FILE),
    'ArrowDown 未绑定 softDrop'
  )
})

test('S 键绑定 softDrop', () => {
  // 查找包含 s/S 的 binding 中有 softDrop
  assert.ok(
    /['"]s['"],\s*['"]S['"]/.test(FILE) && /softDrop/.test(FILE),
    'S 键未绑定 softDrop'
  )
})

test('Space 绑定 drop（硬降）', () => {
  // 验证 Space 键和 Enter 在同一 binding 中
  assert.ok(
    /'Enter',\s*' '/.test(FILE) || /' ',\s*'Enter'/.test(FILE),
    'Space 和 Enter 不在同一 binding 中'
  )
  // 验证 drop 函数存在
  assert.ok(/function\s+drop\s*\(/.test(FILE), 'drop 函数不存在')
  // 逐行搜索：找到包含 ' ' 键的 binding 块内是否有 drop() 调用
  const lines = FILE.split('\n')
  let inSpaceBinding = false
  let foundDropInBinding = false
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("' '") && /key/.test(lines[i])) inSpaceBinding = true
    if (inSpaceBinding && /drop\(\)/.test(lines[i])) foundDropInBinding = true
    // 遇到下一个 key: 且不含 ' '，说明已退出当前 binding
    if (inSpaceBinding && /key:/.test(lines[i]) && !lines[i].includes("' '")) inSpaceBinding = false
  }
  assert.ok(foundDropInBinding, 'Space/Enter binding handler 中没有 drop()')
})

test('ArrowUp 绑定 switchShape', () => {
  assert.ok(
    /ArrowUp.*switchShape|key:.*ArrowUp[\s\S]*?switchShape/s.test(FILE),
    'ArrowUp/W 未绑定 switchShape'
  )
})

// ────────────── 3. Space 不绑定 switchShape ──────────────

test('Space 不再绑定 switchShape', () => {
  // 找到包含 Space(即 ' ')的 binding 块
  const bindingBlocks = FILE.match(/key:\s*\[[^\]]*\][\s\S]*?handler[\s\S]*?\}\s*\}/g) || []
  bindingBlocks.forEach(block => {
    if (/' '/.test(block)) {
      assert.ok(!/switchShape/.test(block), 'Space 键不应绑定 switchShape')
    }
  })
})

// ────────────── 4. 键盘提示文本 ──────────────

test('键盘提示包含"软降"', () => {
  assert.ok(/软降/.test(FILE), '键盘提示文本缺少"软降"')
})

test('键盘提示包含"硬降"', () => {
  assert.ok(/硬降/.test(FILE), '键盘提示文本缺少"硬降"')
})

// ────────────── 5. 触控按钮 ──────────────

test('下方向触控绑定 softDrop（DirectionPad @down）', () => {
  // DirectionPad 使用 @down="softDrop"
  assert.ok(
    /@down="softDrop"/.test(FILE),
    'DirectionPad 下方向按钮未绑定 softDown'
  )
})

test('硬降按钮存在 (drop)', () => {
  assert.ok(
    /@click="drop"/.test(FILE),
    '缺少硬降按钮 @click="drop"'
  )
})

test('硬降按钮有 hard-drop-btn 样式', () => {
  assert.ok(
    /hard-drop-btn/.test(FILE),
    '硬降按钮缺少 hard-drop-btn 样式类'
  )
})

// ────────────── 汇总 ──────────────

console.log(`\n  结果: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
