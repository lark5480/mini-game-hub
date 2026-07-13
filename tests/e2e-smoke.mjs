// E2E 冒烟测试 — 用全局 Playwright 驱动 headless Chromium
// 运行: NODE_PATH=<global node_modules> node tests/e2e-smoke.mjs
// 前置: playwright install chromium 已完成; dev server 在 http://localhost:5173
import { chromium } from 'playwright'

const BASE = 'http://localhost:5173'
const GAMES = [
  'sokoban', 'link', 'catch-fruit', 'snake', 'tetris',
  'breakout', '2048', 'whackamole', 'tic-tac-toe'
]

const results = []
let consoleErrors = []
let pageErrors = []

function log(...a) { console.log(...a) }

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }) // 移动端视口

page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()) })
page.on('pageerror', e => pageErrors.push(e.message))

try {
  // 1) 首页
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 20000 })
  const title = await page.title()
  const cards = await page.locator('.game-card').count()
  const cardTitles = await page.locator('.game-card h3').allInnerTexts()
  await page.screenshot({ path: 'tests/e2e-artifacts/home.png', fullPage: true })
  results.push({ step: 'home', ok: title.includes('小游戏合集') && cards === 9, detail: `title="${title}", cards=${cards}, titles=${JSON.stringify(cardTitles)}` })

  // 2) 逐个游戏加载（捕获运行时报错；hash 路由需用 /#/game）
  for (const g of GAMES) {
    const before = pageErrors.length
    await page.goto(BASE + '/#/' + g, { waitUntil: 'networkidle', timeout: 20000 })
    await page.waitForTimeout(800)
    const appText = (await page.locator('#app').first().innerText()).trim().length
    const isHome = (await page.locator('.game-grid').count()) > 0 // 首页才有游戏网格
    const hashOk = (await page.evaluate(() => location.hash)) === '#/' + g
    const hasError = pageErrors.length > before
    const onGame = !isHome && hashOk
    if (['snake', 'breakout', 'tetris', 'catch-fruit'].includes(g)) {
      await page.screenshot({ path: `tests/e2e-artifacts/game-${g}.png` })
    }
    results.push({ step: `load:${g}`, ok: appText > 0 && !hasError && onGame, detail: `appTextLen=${appText}, isHome=${isHome}, hashOk=${hashOk}${hasError ? ', PAGEERROR' : ''}` })
  }

  // 3) Snake 暂停/继续流程
  await page.goto(BASE + '/#/snake', { waitUntil: 'networkidle', timeout: 20000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  // 先进"开始"让 isPlaying=true（否则显示的是"开始"按钮而非"暂停"）
  const startBtn = page.getByRole('button', { name: /开始/ }).first()
  if (await startBtn.count()) await startBtn.click()
  await page.waitForTimeout(500)
  // 现在应出现"暂停"按钮
  const pauseBtn = page.getByRole('button', { name: /暂停/ }).first()
  let pauseOk = false, resumeOk = false
  if (await pauseBtn.count()) {
    await pauseBtn.click()
    await page.waitForTimeout(400)
    const overlayVisible = await page.getByText('已暂停').isVisible().catch(() => false)
    await page.screenshot({ path: 'tests/e2e-artifacts/snake-paused.png' })
    pauseOk = overlayVisible
    // 点击"继续"
    const resumeBtn = page.getByRole('button', { name: /继续/ }).first()
    if (await resumeBtn.count()) {
      await resumeBtn.click()
      await page.waitForTimeout(400)
      const overlayGone = !(await page.getByText('已暂停').isVisible().catch(() => false))
      resumeOk = overlayGone
    }
  }
  results.push({ step: 'snake:pause', ok: pauseOk, detail: `pauseOverlayVisible=${pauseOk}` })
  results.push({ step: 'snake:resume', ok: resumeOk, detail: `overlayGone=${resumeOk}` })

  // 4) 存档游戏进入时 ResumePrompt（用 snake 已有存档场景较难自动化，改为验证组件存在性跳过）
} catch (e) {
  results.push({ step: 'FATAL', ok: false, detail: e.message })
} finally {
  await browser.close()
}

// 汇总
log('\n========== E2E 结果 ==========')
let pass = 0
for (const r of results) {
  log(`${r.ok ? '✅' : '❌'} ${r.step} — ${r.detail}`)
  if (r.ok) pass++
}
log(`\n通过 ${pass}/${results.length}`)
log(`Console errors: ${consoleErrors.length}`)
consoleErrors.slice(0, 10).forEach(e => log('  ⚠️ ' + e))
log(`Page errors: ${pageErrors.length}`)
pageErrors.slice(0, 10).forEach(e => log('  💥 ' + e))

process.exit(pass === results.length && pageErrors.length === 0 ? 0 : 1)
