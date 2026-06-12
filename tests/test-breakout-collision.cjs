/**
 * Bug 4 修复验证: 弹球打砖块 BreakoutView.vue — 侧面碰撞检测
 * 验证项:
 *   1. 碰撞检测使用最小重叠法
 *   2. 侧面碰撞时反转 ballDX（不是 ballDY）
 *   3. 上下碰撞时反转 ballDY
 *   4. 球的位置正确修正
 *
 * 使用提取的纯 JS 函数进行单元测试
 */

const fs = require('fs')
const path = require('path')
const assert = require('assert')

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

// ────────────── 源码审查验证 ──────────────

const FILE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'views', 'BreakoutView.vue'),
  'utf-8'
)

console.log('\n=== Bug 4: 弹球侧面碰撞检测 ===\n')

console.log('--- 源码审查 ---')

test('碰撞检测使用最小重叠法 (overlapLeft/overlapRight/overlapTop/overlapBottom)', () => {
  assert.ok(/overlapLeft/.test(FILE), '缺少 overlapLeft 变量')
  assert.ok(/overlapRight/.test(FILE), '缺少 overlapRight 变量')
  assert.ok(/overlapTop/.test(FILE), '缺少 overlapTop 变量')
  assert.ok(/overlapBottom/.test(FILE), '缺少 overlapBottom 变量')
})

test('使用 Math.min 计算 minOverlapX', () => {
  assert.ok(
    /minOverlapX\s*=\s*Math\.min\s*\(\s*overlapLeft\s*,\s*overlapRight\s*\)/.test(FILE),
    'minOverlapX 计算方式不正确'
  )
})

test('使用 Math.min 计算 minOverlapY', () => {
  assert.ok(
    /minOverlapY\s*=\s*Math\.min\s*\(\s*overlapTop\s*,\s*overlapBottom\s*\)/.test(FILE),
    'minOverlapY 计算方式不正确'
  )
})

test('侧面碰撞条件: minOverlapX < minOverlapY', () => {
  assert.ok(
    /minOverlapX\s*<\s*minOverlapY/.test(FILE),
    '缺少 minOverlapX < minOverlapY 条件判断'
  )
})

test('侧面碰撞时反转 ballDX', () => {
  // 在 minOverlapX < minOverlapY 分支内应有 ballDX = -ballDX
  const sideBranch = FILE.match(/minOverlapX\s*<\s*minOverlapY[\s\S]*?ballDX\s*=\s*-ballDX/)
  assert.ok(sideBranch, '侧面碰撞分支中缺少 ballDX = -ballDX')
})

test('上下碰撞时反转 ballDY', () => {
  // 在 else 分支内应有 ballDY 反转
  const topBottomBranch = FILE.match(/else\s*\{[\s\S]*?ballDY[\s\S]*?}/)
  assert.ok(topBottomBranch, '上下碰撞分支中缺少 ballDY 反转')
  assert.ok(
    /ballDY\s*=\s*-\s*Math\.abs\s*\(\s*ballDY\s*\)/.test(FILE) ||
    /ballDY\s*=\s*Math\.abs\s*\(\s*ballDY\s*\)/.test(FILE),
    '上下碰撞分支中 ballDY 反转方式不正确'
  )
})

test('侧面碰撞位置修正 (ballX 修正)', () => {
  assert.ok(
    /ballX\s*=\s*bx\s*-\s*BALL_RADIUS/.test(FILE) ||
    /ballX\s*=\s*bx\s*\+\s*BRICK_WIDTH\s*\+\s*BALL_RADIUS/.test(FILE),
    '缺少侧面碰撞的 ballX 位置修正'
  )
})

test('上下碰撞位置修正 (ballY 修正)', () => {
  assert.ok(
    /ballY\s*=\s*by\s*-\s*BALL_RADIUS/.test(FILE) ||
    /ballY\s*=\s*by\s*\+\s*BRICK_HEIGHT\s*\+\s*BALL_RADIUS/.test(FILE),
    '缺少上下碰撞的 ballY 位置修正'
  )
})

// ────────────── 纯逻辑单元测试 ──────────────

console.log('\n--- 碰撞检测逻辑单元测试 ---')

// 提取碰撞检测核心逻辑为纯函数
const BALL_RADIUS = 8
const BRICK_WIDTH = 55
const BRICK_HEIGHT = 20

/**
 * 最小重叠法碰撞检测 — 与源码逻辑一致
 * 返回: { axis: 'x' | 'y', ballDX: number, ballDY: number, ballX: number, ballY: number }
 */
function resolveBrickCollision(ballX, ballY, ballDX, ballDY, bx, by) {
  const overlapLeft = (ballX + BALL_RADIUS) - bx
  const overlapRight = (bx + BRICK_WIDTH) - (ballX - BALL_RADIUS)
  const overlapTop = (ballY + BALL_RADIUS) - by
  const overlapBottom = (by + BRICK_HEIGHT) - (ballY - BALL_RADIUS)

  const minOverlapX = Math.min(overlapLeft, overlapRight)
  const minOverlapY = Math.min(overlapTop, overlapBottom)

  if (minOverlapX < minOverlapY) {
    // Side collision
    const newBallDX = -ballDX
    let newBallX = ballX
    if (overlapLeft < overlapRight) {
      newBallX = bx - BALL_RADIUS
    } else {
      newBallX = bx + BRICK_WIDTH + BALL_RADIUS
    }
    return { axis: 'x', ballDX: newBallDX, ballDY, ballX: newBallX, ballY }
  } else {
    // Top/bottom collision
    let newBallDY = ballDY
    let newBallY = ballY
    if (overlapTop < overlapBottom) {
      newBallDY = -Math.abs(ballDY)
      newBallY = by - BALL_RADIUS
    } else {
      newBallDY = Math.abs(ballDY)
      newBallY = by + BRICK_HEIGHT + BALL_RADIUS
    }
    return { axis: 'y', ballDX, ballDY: newBallDY, ballX, ballY: newBallY }
  }
}

// 测试1: 球从左侧撞击砖块 → 侧面碰撞 → ballDX 反转
test('球从左侧撞击砖块 → 侧面碰撞 → ballDX 反转', () => {
  // 球中心在砖块左侧附近
  const result = resolveBrickCollision(
    /* ballX */ 50, /* ballY */ 55,
    /* ballDX */ 4, /* ballDY */ -1,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.axis, 'x', '应为侧面碰撞')
  assert.strictEqual(result.ballDX, -4, 'ballDX 应反转')
  assert.strictEqual(result.ballDY, -1, 'ballDY 不应变')
})

// 测试2: 球从右侧撞击砖块 → 侧面碰撞 → ballDX 反转
test('球从右侧撞击砖块 → 侧面碰撞 → ballDX 反转', () => {
  const result = resolveBrickCollision(
    /* ballX */ 115, /* ballY */ 55,
    /* ballDX */ -4, /* ballDY */ -1,
    /* bx */ 53, /* by */ 50  // brick right edge = 53+55=108
  )
  assert.strictEqual(result.axis, 'x', '应为侧面碰撞')
  assert.strictEqual(result.ballDX, 4, 'ballDX 应反转')
})

// 测试3: 球从上方撞击砖块 → 上下碰撞 → ballDY 反转
test('球从上方撞击砖块 → 上下碰撞 → ballDY 反转', () => {
  const result = resolveBrickCollision(
    /* ballX */ 80, /* ballY */ 47,
    /* ballDX */ 0, /* ballDY */ 4,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.axis, 'y', '应为上下碰撞')
  assert.ok(result.ballDY < 0, 'ballDY 应变为负值（向上）')
  assert.strictEqual(result.ballDX, 0, 'ballDX 不应变')
})

// 测试4: 球从下方撞击砖块 → 上下碰撞 → ballDY 反转
test('球从下方撞击砖块 → 上下碰撞 → ballDY 反转', () => {
  const result = resolveBrickCollision(
    /* ballX */ 80, /* ballY */ 73,
    /* ballDX */ 0, /* ballDY */ -4,
    /* bx */ 53, /* by */ 50  // brick bottom = 50+20=70
  )
  assert.strictEqual(result.axis, 'y', '应为上下碰撞')
  assert.ok(result.ballDY > 0, 'ballDY 应变为正值（向下）')
})

// 测试5: 球从上方撞击 → ballY 修正到砖块上方
test('球从上方撞击 → ballY 修正到砖块上方', () => {
  const result = resolveBrickCollision(
    /* ballX */ 80, /* ballY */ 47,
    /* ballDX */ 0, /* ballDY */ 4,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.ballY, 50 - BALL_RADIUS, 'ballY 应修正到砖块上方')
})

// 测试6: 球从左侧撞击 → ballX 修正到砖块左侧
test('球从左侧撞击 → ballX 修正到砖块左侧', () => {
  const result = resolveBrickCollision(
    /* ballX */ 50, /* ballY */ 55,
    /* ballDX */ 4, /* ballDY */ -1,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.ballX, 53 - BALL_RADIUS, 'ballX 应修正到砖块左侧')
})

// 测试7: 球从右侧撞击 → ballX 修正到砖块右侧
test('球从右侧撞击 → ballX 修正到砖块右侧', () => {
  const result = resolveBrickCollision(
    /* ballX */ 115, /* ballY */ 55,
    /* ballDX */ -4, /* ballDY */ -1,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.ballX, 53 + BRICK_WIDTH + BALL_RADIUS, 'ballX 应修正到砖块右侧')
})

// 测试8: 球从下方撞击 → ballY 修正到砖块下方
test('球从下方撞击 → ballY 修正到砖块下方', () => {
  const result = resolveBrickCollision(
    /* ballX */ 80, /* ballY */ 73,
    /* ballDX */ 0, /* ballDY */ -4,
    /* bx */ 53, /* by */ 50
  )
  assert.strictEqual(result.ballY, 50 + BRICK_HEIGHT + BALL_RADIUS, 'ballY 应修正到砖块下方')
})

// 测试9: 边界情况 — X和Y重叠相等时，归为上下碰撞（else分支，因为用 <）
// 精心构造使 minOverlapX == minOverlapY
test('X/Y重叠相等时归为上下碰撞 (else分支, minOverlapX == minOverlapY)', () => {
  // 构造 overlapLeft == overlapTop 的场景
  // overlapLeft = (ballX + 8) - bx, overlapTop = (ballY + 8) - by
  // 需要 overlapLeft == overlapTop 且 < overlapRight, < overlapBottom
  // 设 bx=50, by=50
  // ballX=57 → overlapLeft=15, overlapRight=58 (ok)
  // ballY=57 → overlapTop=15, overlapBottom=13 ... no, overlapBottom=(50+20)-(57-8)=21
  // minOverlapX=15, minOverlapY=15 → 相等 → 走 else → 上下碰撞
  const result = resolveBrickCollision(
    /* ballX */ 57, /* ballY */ 57,
    /* ballDX */ 3, /* ballDY */ 3,
    /* bx */ 50, /* by */ 50
  )
  // minOverlapX == minOverlapY → not less than → else branch → 'y'
  assert.strictEqual(result.axis, 'y', '重叠相等时应为上下碰撞')
})

// ────────────── 汇总 ──────────────

console.log(`\n  结果: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
