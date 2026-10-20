# AGENTS.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

详见 [README.md](./README.md)（游戏列表、启动命令、目录结构）。

## 游戏开发约定

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" gradientEnd="#XXX" entrance="xxx" mood="green"
              :hints="[...]" :infoItems="[{ label: '分数', value: score }]"
              :confirmRestart="score > 0" tutorial="一句话玩法"
              @back="router.push('/')" @restart="startGame">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <GameDialog v-model:visible="gameOver" :new-record="newRecord" :achievement-hint="achievementHint" :stats="stats" ... />
    <LeaderboardStrip :game="'xxx'" />
    <!-- 遮罩类组件放在 GameLayout 内部（与 SnakeView 一致） -->
    <LeaderboardOverlay :visible="showLeaderboard" game="xxx" gameName="..." :score="lastScore" @replay="startGame" />
    <PauseOverlay :visible="paused" @resume="toggle" />
    <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
  </GameLayout>
</template>

<script setup lang="ts">
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useGamePause } from '@/composables/useGamePause'
import { useGameSave } from '@/composables/useGameSave'
import { useAutoSave } from '@/composables/useAutoSave'
import { useSound } from '@/composables/useSound'
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import { useGameOver } from '@/composables/useGameOver'
import { useGameStore } from '@/stores/game'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'

const gameLoop = useGameLoop({ mode: 'interval', intervalMs: 150, onUpdate: () => step() })
const { paused, toggle } = useGamePause({
  canPause: () => isPlaying.value && !gameOver.value && !showResume.value,
  onPause: gameLoop.pause,
  onResume: gameLoop.resume
})
</script>
```

**关键约束：**
- 游戏框架统一用 `GameLayout` + `GameDialog` + `DirectionPad`，不要各写一套
- 暂停/恢复**只接 `useGamePause`**：它内部已封装失焦暂停（`useAutoPause`）、P/Esc 键、`sound.pause()/resume()`、恢复倒计时取消；视图侧只需 `canPause` 守卫 + `onPause/onResume` 接 `gameLoop`，再把 `paused` 绑 `PauseOverlay`、`showResume` 绑 `ResumePrompt`。**不要在视图里直接调 `useAutoPause` 或自己绑 P/Esc**
- 动画循环用 `useGameLoop({ onUpdate, mode, fixedStep? })`，组件卸载自动清理；暂停时自动停 rAF
- 键盘用 `useGameKeyboard({ bindings, active })`，`active=false` 自动忽略输入；连发需加 `{ repeat: { intervalMs: 120 } }`（可带 `initialDelay`），同时按键可直接 `isDown(key)` 查询；keyup/keydown 分离加 `{ onKeyUp: true }`；**绑定里引用了 ref/状态变化时必须 `refresh(newBindings)` 重传数组**，否则用的是旧闭包
- 分数用 `useGameStore().addScore(gameName, score)`
- 音效用 `useSound()`；`sound.pause()` / `sound.resume()` 由 `useGamePause` 自动调用，视图不要再手写；mute 切换用 `sound.toggleMute()`（自动持久化 + 给确认 click）
- 战斗反馈用 `useHaptics()`：命中 `pulse()`、连击 `success()`、失误 `light()`、胜利 `win()`
- 浮动分数用 `useScoreFloats().pop('+10', x, y)`，组件侧 `<ScoreFloat :popups="popups" />`
- 续局存档用 `useGameSave(gameName)`（`saveGame/loadGame/clearGame/hasGameSave`，格式带 `SAVE_VERSION`，版本不符静默清档）+ `useAutoSave(gameName, getData)`（300ms 防抖写盘，卸载自动清 timer）
- 内嵌排行榜条：`<LeaderboardStrip :game="'xxx'" />` 放在默认 slot 底部
- **新增游戏先改 `src/lib/games.ts`**（游戏元信息单一数据源，首页卡片列表自动派生）；其余步骤（router 映射、写视图、首页图标、可选成就）见 [docs/system_design.md](./docs/system_design.md) 的「新增游戏 checklist」
- 参考 `SnakeView.vue`（最完整的实现模板）

## 共享组件注册表

### UI 组件
| 组件 | 职责 | 要点 |
|------|------|------|
| `GameLayout` | 游戏外层框架 | props：`title`/`accentColor`（注入 `--game-accent`）/`gradientEnd`/`mood`（氛围底色）/`hints`/`infoItems`/`tutorial`（首次进入弹引导气泡，`localStorage` 记已读）/`entrance`（进场动画类型）/`confirmRestart`。标题栏静音与重启按钮均 44px 触摸区；**重启按钮只有绑了 `@restart` 才渲染**，`confirmRestart=true` 时先弹二次确认；"最佳"分数按 `route.path` 自动取 |
| `GameDialog` | 弹窗 | `v-model:visible`，`actionText` 按钮触发 `@action`，自动淡入动画；`newRecord` prop 显示金色新记录徽章（badge-pop 弹跳），`achievementHint` prop 显示成就接近提示，`stats`（`{label,value}[]`）列本局亮点 |
| `DirectionPad` | 触屏方向键 | `cross` / `horizontal` 两种布局，`repeat` 控制是否长按连发，`showUp/showDown` 裁键，`#extra` 插槽放额外按钮；四向事件带 `isRepeat` 参数 |
| `PauseOverlay` | 暂停遮罩 | `v-if` 控制，自带 safe-area 内边距 + 淡入动画；点"继续"走 3-2-1 恢复倒计时（`usePauseCountdown` 注册取消，P/Esc 可中断） |
| `ResumePrompt` | 继续/重开选择 | 失焦点回前台 / 按 P 暂停时弹出；"继续上局"（带同款倒计时）或 "重新开始" |
| `ScoreFloat` | 浮动分数动画 | 只收 `popups` prop（数据来自 `useScoreFloats`），0.8s 上浮消失 |
| `LeaderboardOverlay` | 提交分数→排行榜（Top N + 邻位排名）→再来一局 | props `visible/game/gameName/score`，`@replay`；5s 超时 + 友好中文错误 + 重试按钮 + safe-area；提交后展示玩家前后各 range 名邻位排名 |
| `LeaderboardStrip` | 嵌入排行榜条 Top 5 | props `game` + `limit`（默认 5） |
| `GameToast` | 顶部成就解锁通知 | 无 props，读 `useToast` 的全局 `state`；2s 自动消失 + 淡入动画 + safe-area 偏移 |
| `XiangqiBoard` | 象棋棋盘（Canvas 2D） | 点击选子/落子，`tap` 事件回传坐标；`flipped` 支持黑方视角（联机） |
| `WhackAMoleBoard` | 打地鼠 3×3 洞位棋盘 | props `difficulty`，emits `start` / `score` / `gameover`；内部自带音效/震动/浮动分数，被单人与竞速两视图复用 |

### 共享 composable
| Composable | 职责 | 关键 API |
|------------|------|----------|
| `useGameLoop` | 游戏循环 | `pause()` / `resume()` / `start()` / `stop()`；options `mode`/`intervalMs`/`fixedStep` |
| `useGameKeyboard` | 键盘输入 | `bindings`、`repeat` 连发、`isDown()` 查询、`refresh(newBindings)` 重传绑定 |
| `useGamePause` | **暂停/恢复唯一入口** | `useGamePause({ onPause, onResume, canPause?, autoPause? })` → `{ paused, pause, resume, toggle, countingDown }`；内含失焦暂停（调 `useAutoPause`）、P/Esc、音效暂停恢复、倒计时取消 |
| `usePauseCountdown` | PauseOverlay/ResumePrompt 与 `useGamePause` 之间的倒计时通道 | `usePauseCountdown(cancel)` → `{ setCounting }`（`useGamePause.ts` 导出，仅供这两个组件用） |
| `useAutoPause` | 失焦自动暂停（底层件） | `useAutoPause(() => { ... })`；**视图不直接用，由 `useGamePause` 调用** |
| `useSound` | 音效系统 | `muted`/`readonly`，`toggleMute()`，预设列表见 `class-diagram.mermaid` |
| `useHaptics` | 触觉反馈 | `light/tap/select/pulse/success/error/win` |
| `useScoreFloats` | 浮动分数 | `pop(text, x, y)` → `popups` ref |
| `useGameSave` | 存档/读档 | `saveGame(data)` / `loadGame()` / `clearGame()` / `hasGameSave()`；key `game-save-<name>`，带 `SAVE_VERSION` |
| `useAutoSave` | 防抖存盘三件套 | `useAutoSave(gameName, getData, { delay = 300, beforeSave? })` → `{ scheduleSave, clearSave }`，卸载清 timer |
| `useLeaderboard` | 排行榜 CRUD | `submit(nickname, score)` / `fetch()` / `fetchNearby(score, nickname, range)` 邻位排名 |
| `useGameOver` | 游戏结束统一处理 | `checkGameOver(gameName, score, stats?)` → `{ isNewRecord, achievementHint, stats }`；新记录检测 + 分数写入 + 音效 + 成就接近提示/解锁 |
| `useLeaderboardAutoRefresh` | 监听版本号自动刷新（从 `useLeaderboard.ts` 导出） | `useLeaderboardAutoRefresh(fetch)` |
| `useToast` | Toast 通知 | `toast.show(message, icon, duration = 2000)` |
| `useSwipe` | 移动端滑动手势 | `useSwipe({ el, active, onSwipe, threshold?, lockDirection?, lockDuration? })` |
| `useRealtimeRoom` | 联机房间底座（井字棋/象棋双人复用） | `useRealtimeRoom(roomCode, meta)` → `{ status, peerCount, send, on, onPresenceSync, track, leave }` |
| `useRaceRoom` | 竞速房间（打地鼠竞速） | 倒计时同步 + 进度广播 + 结算；`game` 标签入参化 |
| `useXiangqiAI` | 象棋 AI 调度 | `requestSearch` / `cancel` / `dispose`；见「中国象棋引擎」段 |

## 中国象棋引擎（特殊游戏约定）

- 引擎在 `src/engine/xiangqi/`（纯 TS 零依赖：`types/rules/ai/openings/notation`），**新增引擎能力先改这里 + 在 `tests/test-xiangqi.cjs` 补断言**（`node tests/test-xiangqi.cjs` 直接跑，自动 tsc 编译；测试构造局面必须棋规合法——走子不送将）
- 搜索必须走 `useXiangqiAI`（Web Worker，主线程不阻塞）；**postMessage 前棋盘必须 `toPlainBoard` 深拷贝**（Vue 响应式 Proxy 无法结构化克隆，历史 P0）；禁止在主线程同步搜索
- AI 走子/提示统一先查 `lookupOpening`（开局库命中零延迟）→ 未命中才进 Worker 搜索
- 重复局面裁决 `checkRepetitionViolation`（长将/长捉/长杀/长打）是胜负判定一环；周期扫描范围与视图 AI 历史窗口一致性约束见 `rules.ts` 的 `MAX_PERIOD` 注释与 `XiangqiView.vue` 的 `recentHistoryKeys` 注释（改窗口须两处同步，否则 AI 长打规避失效）
- 评估热路径纪律：`evaluateBoard` 每叶子调用，禁止走法生成/二次全盘扫描；结构评估项必须在单遍扫描内顺带收集（参考 R2 性能教训）
- 棋盘渲染用 `XiangqiBoard`（Canvas 2D），联机黑方视角用 `flipped` prop
- 引擎接口变更（`rules.ts` / `ai.ts` 导出）需同步测试回归；完整架构事实见 [system_design.md](./docs/system_design.md) 的「中国象棋引擎」段

## 全局积分排行榜（Supabase）

架构：前端（Supabase JS SDK）→ Supabase PostgreSQL → RLS 安全策略。SQL 建表语句、环境变量、核心文件列表、昵称去重逻辑、部署步骤见 [docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」。

> 2048 和连连看支持中途提交分数。

## 变更纪律（工具无关）

> 适用于任何 agent 组合——单 agent 从头做到尾、或“规划者↔执行者”跨工具接力（任一方可是 Claude / Qoder / CodeBuddy / 人）均可。不绑定特定工具或角色名。

- **大改前先写意图**：改哪些文件、验收标准，写在一处即可（PR 描述 / commit message / 一个临时清单），做完对照勾销。不为流程专门建文档。
- **审查按严重度排序**：🔴 正确性/数据错误 → 🟡 违反本规范 → 🔵 风格打磨 → ⚪ 可选优化。**前两级未清零不提交**（commit = 验收合格，不是“我写完了”）；提交后发现 🔴/🟡 用 `git revert`，不另走修复循环。
- **产出归位**：⚪ 可选优化落 [docs/notes/BACKLOG.md](./docs/notes/BACKLOG.md)；踩过的 🔴/🟡 根因能固化成测试断言 / `npm run lint:conventions` 检查就优先固化，其余记 [docs/notes/knowledge.md](./docs/notes/knowledge.md)。

## 成就系统（新增成就操作）

- 元数据 / 已解锁集合 / 自动 perfectionist 元成就 / 架构事实见 [docs/system_design.md](./docs/system_design.md) 的 Store 段
- **新增成就**：在 `src/stores/achievements.ts` 的 `ACHIEVEMENTS` 数组加条目 → 在对应游戏触发点调用 `achievements.unlock('id')` + `toast.show(...)` → `/achievements` 自动显示
- `unlock()` **内部自动触发 `sound.unlock()` + `haptics.success()`**，调用方只需再加 `toast.show(...)`；返回 `boolean`（已解锁则 false），调用方按 `if (unlock(...))` 决定是否弹 toast
- 排行榜类成就（首次提交 / 全游戏提交）例外：触发点在 `useLeaderboard.submit()` 内，不在游戏视图


## 注意事项
- **游戏结束流程**：统一走 `useGameOver().checkGameOver(gameName, score, stats?)` → 返回 `{ isNewRecord, achievementHint, stats }` → 传给 `GameDialog`（新记录检测 + 分数写入 + 音效 + 成就接近提示自动完成）
- **动画风格**：所有弹窗/路由/Toast 的动画 keyframes 统一放 `src/styles/animations.css`，不要在各组件里重复定义 `@keyframes`
- **移动端适配**：overlay 类组件 `padding-top` 用 `max(24px, env(safe-area-inset-top) + 16px)` 避免 iPhone 刘海遮挡
- **关卡设计**：推箱子每关必须保证箱子数 = 目标数，否则无法通关
- Canvas 游戏不要自己起 `requestAnimationFrame`：统一走 `useGameLoop({ mode: 'raf' })`，它在 `onUnmounted` 自动取消动画帧与定时器（全项目仅此处持有 rAF）
- 测试：单测在 `tests/test-xxx.cjs`，`node tests/test-xxx.cjs` 直接跑（零测试框架依赖）；`npm test` 串跑全部单测，`npm run lint:conventions` 跑静态约定检查。E2E 例外——`tests/e2e-smoke.mjs` 用 Playwright（devDependency），`npm run test:e2e` 需先起 dev server

> PWA、全局错误兜底架构事实见 [system_design.md](./docs/system_design.md)；TS `noUnusedLocals` 约束见 [CLAUDE.md](./CLAUDE.md) 红线；可访问性（`:focus-visible` 聚焦环、`aria-hidden`、`prefers-reduced-motion`）已全局处理，无需额外操作。