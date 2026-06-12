/**
 * Bug 3 修复验证: 所有 6 个游戏 — preventDefault
 * 重构后键盘事件统一由 useGameKeyboard composable 管理
 * 验证：
 *   1. 每个游戏视图导入了 useGameKeyboard
 *   2. useGameKeyboard.ts 中的 handleKeydown 对指定按键调用 e.preventDefault()
 *   3. 每个游戏绑定了对应按键
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

let totalPassed = 0
let totalFailed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  PASS: ${name}`)
    totalPassed++
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e.message}`)
    totalFailed++
  }
}

function readFile(dir, name) {
  return fs.readFileSync(path.join(__dirname, '..', 'src', dir, name), 'utf-8')
}

// 读取 composable 源码验证 preventDefault 逻辑
const composableSource = readFile('composables', 'useGameKeyboard.ts')

console.log('\n=== Bug 3: preventDefault 验证（重构后 useGameKeyboard） ===\n')

// ────────────── 1. 验证 composable 中有 preventDefault ──────────────

test('useGameKeyboard composable 中有 handleKeydown 函数', () => {
  assert.ok(
    /function\s+handleKeydown/.test(composableSource),
    'useGameKeyboard.ts 中没有 handleKeydown 函数'
  )
})

test('handleKeydown 中调用 e.preventDefault()', () => {
  assert.ok(
    /e\.preventDefault\(\)/.test(composableSource),
    'handleKeydown 中没有 e.preventDefault() 调用'
  )
})

test('preventKeys 包含方向键和空格', () => {
  assert.ok(
    /ArrowUp/.test(composableSource) &&
    /ArrowDown/.test(composableSource) &&
    /ArrowLeft/.test(composableSource) &&
    /ArrowRight/.test(composableSource),
    'preventKeys 缺少方向键'
  )
  assert.ok(
    /' '/.test(composableSource),
    'preventKeys 缺少空格键'
  )
})

// ────────────── 2. 验证每个游戏视图使用 useGameKeyboard ──────────────

const games = [
  { file: 'SokobanView.vue', name: '推箱子 Sokoban', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '] },
  { file: 'LinkGameView.vue', name: '连连看 LinkGame', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '] },
  { file: 'SnakeView.vue', name: '贪吃蛇 Snake', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '] },
  { file: 'CatchFruitView.vue', name: '接水果 CatchFruit', keys: ['ArrowLeft', 'ArrowRight', 'Enter', ' '] },
  { file: 'TetrisView.vue', name: '俄罗斯方块 Tetris', keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '] },
  { file: 'BreakoutView.vue', name: '弹球打砖块 Breakout', keys: ['ArrowLeft', 'ArrowRight', 'Enter', 'p', 'P'] }
]

games.forEach(game => {
  console.log(`\n--- ${game.name} ---`)
  const source = readFile('views', game.file)

  test(`${game.name}: 导入 useGameKeyboard`, () => {
    assert.ok(
      /useGameKeyboard/.test(source),
      '未导入 useGameKeyboard'
    )
  })

  test(`${game.name}: 调用 useGameKeyboard 并传入 bindings`, () => {
    assert.ok(
      /useGameKeyboard\s*\(/.test(source) && /bindings\s*:/.test(source),
      '未正确调用 useGameKeyboard'
    )
  })

  // 验证每个按键在 bindings 中被注册
  game.keys.forEach(key => {
    const keyPattern = key === ' ' ? /' '/ : new RegExp(`'${key}'`)
    test(`${game.name}: 绑定按键 '${key === ' ' ? 'Space' : key}'`, () => {
      assert.ok(
        keyPattern.test(source),
        `按键 '${key}' 未在 bindings 中注册`
      )
    })
  })
})

// ────────────── 汇总 ──────────────

console.log(`\n=== 汇总: ${totalPassed} passed, ${totalFailed} failed ===\n`)
process.exit(totalFailed > 0 ? 1 : 0)
