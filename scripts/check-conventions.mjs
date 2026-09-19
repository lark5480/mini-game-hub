#!/usr/bin/env node
/**
 * check-conventions.mjs — 项目约定静态检查（PITFALLS 根因固化）
 *
 * 把历史上靠记忆文档约束、易被 Agent 反复违反的 P0/P1 根因，固化为可执行检查。
 * 由原 docs/ai-workflow/PITFALLS.md 的可机械化条目迁移而来：
 *   - P-002 局部 @keyframes 未进共享 animations.css
 *   - P-007 tsc 编译产物（.js）混入 src 目录被 Vite 优先解析
 *
 * 运行：node scripts/check-conventions.mjs（或 npm run lint:conventions）
 * 退出码非 0 表示存在违规，供 CI / pre-commit / review 拦截。
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

function walk(dir, filterFn, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, filterFn, acc)
    else if (filterFn(full)) acc.push(full)
  }
  return acc
}

const rel = (p) => relative(ROOT, p).replace(/\\/g, '/')
const errors = []

// —— P-002：@keyframes 只能定义在 src/styles/animations.css ——
const ANIMATIONS_CSS = join(SRC, 'styles', 'animations.css')
const styleFiles = walk(SRC, (f) => ['.vue', '.css'].includes(extname(f)))
for (const f of styleFiles) {
  if (f === ANIMATIONS_CSS) continue
  const lines = readFileSync(f, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/@keyframes\s+[\w-]+/.test(line)) {
      errors.push(`P-002 @keyframes 应统一放 src/styles/animations.css：${rel(f)}:${i + 1}`)
    }
  })
}

// —— P-007：src 下不得存在 .js 编译产物（应全为 .ts/.vue），否则 Vite 优先解析导致导出缺失 ——
const strayJs = walk(SRC, (f) => extname(f) === '.js')
for (const f of strayJs) {
  errors.push(`P-007 src 下存在编译产物 .js（应清理并让 tsc 输出到 gitignored 目录）：${rel(f)}`)
}

if (errors.length) {
  console.error('✗ 约定检查未通过：\n' + errors.map((e) => '  - ' + e).join('\n'))
  process.exit(1)
}
console.log('✓ 约定检查通过（animations.css 集中管理 + src 无编译产物污染）')
