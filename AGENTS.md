# AGENTS.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

详见 [README.md](./README.md)（游戏列表、启动命令、目录结构）。

## 游戏开发约定

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" :hints="[...]" :infoItems="[...]" @back="router.push('/')">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <GameDialog v-model:visible="gameOver" :new-record="newRecord" :achievement-hint="achievementHint" ... />
    <LeaderboardStrip :game="'xxx'" />
  </GameLayout>
  <PauseOverlay :visible="paused" @resume="togglePause" />
  <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
  <LeaderboardOverlay ... />
</template>

<script setup lang="ts">
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
import { useAutoPause } from '@/composables/useAutoPause'
import { useHaptics } from '@/composables/useHaptics'
import { useScoreFloats } from '@/composables/useScoreFloats'
import { useGameStore } from '@/stores/game'
import LeaderboardStrip from '@/components/LeaderboardStrip.vue'
</script>
```

**关键约束：**
- 游戏框架统一用 `GameLayout` + `GameDialog` + `DirectionPad`，不要各写一套
- 暂停/恢复统一接入：`useAutoPause`（失焦暂停）+ `PauseOverlay`（暂停遮罩）+ `ResumePrompt`（继续/重开选择）+ P/Esc 键绑定
- 动画循环用 `useGameLoop({ onUpdate, mode, fixedStep? })`，组件卸载自动清理；暂停时自动停 rAF
- 键盘用 `useGameKeyboard({ bindings, active })`，`active=false` 自动忽略输入；连发需加 `{ repeat: { intervalMs: 120 } }`，同时按键可直接 `isDown(key)` 查询；keyup/keydown 分离加 `{ onKeyUp: true }`
- 分数用 `useGameStore().addScore(gameName, score)`
- 音效用 `useSound()`；暂停/恢复时调 `sound.pause()` / `sound.resume()`；mute 切换用 `sound.toggleMute()`（自动持久化 + 给确认 click）
- 战斗反馈用 `useHaptics()`：命中 `pulse()`、连击 `success()`、失误 `light()`、胜利 `win()`
- 浮动分数用 `useScoreFloats().pop('+10', x, y)`
- 内嵌排行榜条：`<LeaderboardStrip :game="'xxx'" />` 放在默认 slot 底部
- **新增游戏先改 `src/lib/games.ts`**（游戏元信息单一数据源，首页卡片列表自动派生）；其余步骤（router 映射、写视图、首页图标、可选成就）见 [docs/system_design.md](./docs/system_design.md) 的「新增游戏 checklist」
- 参考 `SnakeView.vue`（最完整的实现模板）

## 共享组件注册表

### UI 组件
| 组件 | 职责 | 要点 |
|------|------|------|
| `GameLayout` | 游戏外层框架 | 标题栏含静音/重启按钮（44px 触摸区）、`accentColor` 注入主题 |
| `GameDialog` | 弹窗 | `v-model:visible`，`actionText` 按钮触发 `@action`，自动淡入动画；`newRecord` prop 显示金色新记录徽章（badge-pop 弹跳），`achievementHint` prop 显示成就接近提示 |
| `DirectionPad` | 触屏方向键 | `cross` / `horizontal` 两种布局，`repeat` 控制是否长按连发 |
| `PauseOverlay` | 暂停遮罩 | `v-if` 控制，自带 safe-area 内边距 + 淡入动画 |
| `ResumePrompt` | 继续/重开选择 | 失焦点回前台 / 按 P 暂停时弹出；"继续上局" 或 "重新开始" |
| `ScoreFloat` | 浮动分数动画 | `pop(text, x, y)` 触发，0.8s 上浮消失 |
| `LeaderboardOverlay` | 提交分数→排行榜（Top N + 邻位排名）→再来一局 | 5s 超时 + 友好中文错误 + 重试按钮 + safe-area；提交后展示玩家前后各 range 名邻位排名 |
| `LeaderboardStrip` | 嵌入排行榜条 Top 5 | —— |
| `GameToast` | 顶部成就解锁通知 | 2s 自动消失 + 淡入动画 + safe-area 偏移 |

### 共享 composable
| Composable | 职责 | 关键 API |
|------------|------|----------|
| `useGameLoop` | 游戏循环 | `pause()` / `resume()` / `start()` / `stop()` |
| `useGameKeyboard` | 键盘输入 | `bindings`、`repeat` 连发、`isDown()` 查询 |
| `useAutoPause` | 失焦自动暂停 | `useAutoPause(() => { ... })` |
| `useSound` | 音效系统 | `muted`/`readonly`，`toggleMute()`，预设列表见 `class-diagram.mermaid` |
| `useHaptics` | 触觉反馈 | `light/tap/select/pulse/success/error/win` |
| `useScoreFloats` | 浮动分数 | `pop(text, x, y)` → `popups` ref |
| `useGameSave` | 存档/读档 | `saveGame(data)` / `loadGame()` / `clearGame()` |
| `usePause` | 统一暂停/恢复（骨架） | P/Esc + 失焦 + ResumePrompt 封装 |
| `useLeaderboard` | 排行榜 CRUD | `submit(nickname, score)` / `fetch()` / `fetchNearby(score, nickname, range)` 邻位排名 |
| `useGameOver` | 游戏结束统一处理 | `checkGameOver(gameName, score)` → `{ isNewRecord, achievementHint }`；新记录检测 + 分数写入 + 音效 + 成就接近提示/解锁 |
| `useLeaderboardAutoRefresh` | 监听版本号自动刷新 | `useLeaderboardAutoRefresh(fetch)` |
| `useToast` | Toast 通知 | `toast.show(message, icon)` |
| `useSwipe` | 移动端滑动手势 | `useSwipe({ el, active, onSwipe })` |

## 全局积分排行榜（Supabase）

架构：前端（Supabase JS SDK）→ Supabase PostgreSQL → RLS 安全策略。SQL 建表语句、环境变量、核心文件列表、昵称去重逻辑、部署步骤见 [docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」。

> 2048 和连连看支持中途提交分数。

## 多 Agent 协作工作流（Claude + Codex）

角色分工：Claude 负责计划与审查，Codex 负责按计划执行。循环流程：Claude 写计划 → Codex 执行 → Claude review → 出修复方案 → Codex 修复 → Claude 再 review → 通过后提交。

### 交接机制（硬规则）

- 交接物是 git diff：Codex 每完成一个任务立即 commit，Claude review 时只看 `git diff`，不全量重读代码
- 严格串行：同一时间只有一个 agent 改动工作区文件，禁止并行改同一文件
- 计划必须"可执行"：写清文件路径、修改点、验收标准、review checklist（模板见 [docs/ai-workflow/PLAN.md](./docs/ai-workflow/PLAN.md)）
- **PLAN.md 使用方式**：路径固定、模板骨架在文件顶部注释里永久保留；每次新任务只覆盖 TASK_BODY 区（不新建 PLAN-xxx.md）；Codex 执行后更新勾选与交接记录；Claude 的 review 结果写入同一文件的交接记录表（不新建 review.md）；任务提交后清空 TASK_BODY 区恢复占位，TEMPLATE 区永远不动
- 每轮交接时，当前 agent 必须更新 PLAN.md 的状态勾选，避免基于过时计划判断
- 审查依据 = 本文件硬规则 + PLAN.md 验收标准，不凭感觉

### 任务模式（粗细双模式）

Claude 创建计划时根据任务规模选择模式，在 PLAN.md 顶部声明：

| 维度 | 细模式（micro） | 粗模式（macro） |
|------|----------------|-----------------|
| 适用场景 | ≤ 50 行改动、bug 修复、单文件修改 | 新游戏、多文件重构、架构级变更 |
| 文件级修改点 | 表格：文件 + 具体改动 + 完成勾选 | 文字描述：改哪些模块、不改哪些 |
| 实现细节 | 精确到行号 + 改前/改后代码片段 | 只给约束（"必须复用 X"、"禁止新建 Y"） |
| Review Checklist 重点 | 正确性：逻辑、空安全、build | 架构合规：分层、复用、命名 |
| Codex 自由度 | 按指令执行，不改逻辑 | 自主决定实现细节，Claude 只验收结果 |

### Review 四级分级标准

Review 结果按严重度分级，Codex 根据级别决定处理方式：

| 级别 | 标识 | 含义 | 处理方式 | 典型示例 |
|------|------|------|---------|---------|
| P0 正确性 | 🔴 | 逻辑/渲染/数据错误 | 阻塞，Codex 必须修 | 飘字坐标偏移、得分计算错误、空指针 |
| P1 规范 | 🟡 | 违反 AGENTS.md 硬规则 | 阻塞，Codex 必须修 | 新建了本应复用的 composable、未用 GameLayout |
| P2 打磨 | 🔵 | 风格/微优化、零风险 | 不进 backlog，Codex 顺手修 | 单双引号、冗余媒体查询、未使用变量 |
| P3 可选 | ⚪ | 后续可做的改进 | 进 backlog | 动画曲线优化、新增触觉反馈 |

### 终止条件

P0 + P1 清零 + P2 已修或明确跳过 + P3 进 backlog → 可提交。最多 2 轮 review；第 3 轮仍存在 P0/P1 → 人工介入。

## 成就系统（新增成就操作）

- 元数据 / 已解锁集合 / 自动 perfectionist 元成就 / 架构事实见 [docs/system_design.md](./docs/system_design.md) 的 Store 段
- **新增成就**：在 `src/stores/achievements.ts` 的 `ACHIEVEMENTS` 数组加条目 → 在对应游戏触发点调用 `achievements.unlock('id')` + `toast.show(...)` → `/achievements` 自动显示
- `unlock()` **内部自动触发 `sound.unlock()` + `haptics.success()`**，调用方只需再加 `toast.show(...)`


## 注意事项
- **游戏结束流程**：统一走 `useGameOver().checkGameOver(gameName, score)` → 返回 `{ isNewRecord, achievementHint }` → 传给 `GameDialog`（新记录检测 + 分数写入 + 音效 + 成就接近提示自动完成）
- **PWA**：`vite-plugin-pwa` autoUpdate；`App.vue` 生产环境注册 SW；静态资源 + Supabase API 离线缓存
- **全局错误兜底**：`main.ts` 设 `app.config.errorHandler` + `unhandledrejection` 监听，防 Vue 渲染白屏
- Canvas 游戏 `onUnmounted` 中清理 requestAnimationFrame
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- 测试在 `tests/` 下，`node test-xxx.cjs` 直接跑，无测试框架依赖
- 关卡类游戏（推箱子）：每关必须保证箱子数 = 目标数，否则无法通关
- **动画风格**：所有弹窗/路由/Toast 的动画 keyframes 统一放 `src/styles/animations.css`，不要在各组件里重复定义 `@keyframes`
- **可访问性**：所有交互按钮已有 `:focus-visible` 聚焦环；CRT scanlines 层加了 `aria-hidden="true"`；全局 `prefers-reduced-motion` 已处理
- **移动端适配**：overlay 类组件 `padding-top` 用 `max(24px, env(safe-area-inset-top) + 16px)` 避免 iPhone 刘海遮挡