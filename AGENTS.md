# AGENTS.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

详见 [README.md](./README.md)（游戏列表、启动命令、目录结构、部署指南）。

## 游戏开发约定

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" :hints="[...]" :infoItems="[...]" @back="router.push('/')">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <GameDialog v-model:visible="gameOver" ... />
    <LeaderboardStrip :game="'xxx'" />
  </GameLayout>
</template>

<script setup lang="ts">
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useSound } from '@/composables/useSound'
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
- **新增游戏只需改 `src/lib/games.ts`**（路由、Store、首页自动同步），再在 `router/index.ts` 的 `GAME_COMPONENTS` 加一行映射

## 共享组件注册表

### UI 组件
| 组件 | 职责 | 要点 |
|------|------|------|
| `GameLayout` | 游戏外层框架 | 标题栏含静音/重启按钮（44px 触摸区）、`accentColor` 注入主题 |
| `GameDialog` | 弹窗 | `v-model:visible`，`actionText` 按钮触发 `@action`，自动淡入动画 |
| `DirectionPad` | 触屏方向键 | `cross` / `horizontal` 两种布局，`repeat` 控制是否长按连发 |
| `PauseOverlay` | 暂停遮罩 | `v-if` 控制，自带 safe-area 内边距 + 淡入动画 |
| `ResumePrompt` | 继续/重开选择 | 失焦点回前台 / 按 P 暂停时弹出；"继续上局" 或 "重新开始" |
| `ScoreFloat` | 浮动分数动画 | `pop(text, x, y)` 触发，0.8s 上浮消失 |
| `LeaderboardOverlay` | 提交分数→排行榜→再来一局 | 5s 超时 + 友好中文错误 + 重试按钮 + safe-area |
| `LeaderboardStrip` | 嵌入排行榜条 Top 5 | 自动监听全局 `leaderboardVersion` 刷新 |
| `GameToast` | 顶部成就解锁通知 | 2s 自动消失 + 淡入动画 + safe-area 偏移 |

### 共享 composable
| Composable | 职责 | 关键 API |
|------------|------|----------|
| `useGameLoop` | 游戏循环 | `pause()` / `resume()` / `start()` / `stop()` |
| `useGameKeyboard` | 键盘输入 | `bindings`、`repeat` 连发、`isDown()` 查询 |
| `useAutoPause` | 失焦自动暂停 | `useAutoPause(() => { ... })` |
| `useSound` | 音效系统 | 23+ 预设，`muted`/`readonly`，`toggleMute()` |
| `useHaptics` | 触觉反馈 | `light/tap/select/pulse/success/error/win` |
| `useScoreFloats` | 浮动分数 | `pop(text, x, y)` → `popups` ref |
| `useGameSave` | 存档/读档 | `saveGame(data)` / `loadGame()` / `clearGame()` |
| `usePause` | 统一暂停/恢复（骨架） | P/Esc + 失焦 + ResumePrompt 封装 |
| `useLeaderboard` | 排行榜 CRUD | `submit(nickname, score)` / `fetch()` |
| `useLeaderboardAutoRefresh` | 监听版本号自动刷新 | `useLeaderboardAutoRefresh(fetch)` |
| `useToast` | Toast 通知 | `toast.show(message, icon)` |
| `useSwipe` | 移动端滑动手势 | `useSwipe({ el, active, onSwipe })` |

## 全局积分排行榜（Supabase）

架构：前端（Supabase JS SDK）→ Supabase PostgreSQL → RLS 安全策略

**核心文件：**
- `src/lib/supabase.ts` — 客户端单例（`createClient`），env 缺失时返回 null
- `src/composables/useLeaderboard.ts` — `submit(nickname, score)` / `fetch(game, limit)` / `leaderboardVersion` 全局刷新信号
- `src/components/LeaderboardOverlay.vue` — 提交分数 → 显示排行榜 → 再来一局
- `src/components/LeaderboardStrip.vue` — 嵌入各游戏页面底部和首页卡片
- `.env.example` — 模板（`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`）

**昵称去重逻辑**：submit 前查 (game, nickname) 已有记录，新分更高则 update，否则跳过。纯应用层，不依赖数据库 unique constraint。

**Supabase SQL（部署前必须执行一次）：**
```sql
create table leaderboard (
  id bigint generated always as identity primary key,
  game text not null,
  nickname text not null,
  score integer not null,
  created_at timestamptz default now()
);
create index idx_leaderboard_game_score on leaderboard (game, score desc);
alter table leaderboard enable row level security;
create policy "anon select" on leaderboard for select to anon using (true);
create policy "anon insert" on leaderboard for insert to anon with check (true);
create policy "anon update" on leaderboard for update to anon using (true) with check (true);
```

**环境变量**（Netlify + 本地各配一份）：
- `VITE_SUPABASE_URL` ← Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY` ← Publishable key（不是 Secret key）

## 注意事项
- Canvas 游戏 `onUnmounted` 中清理 requestAnimationFrame
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- 测试在 `tests/` 下，`node test-xxx.cjs` 直接跑，无测试框架依赖
- 关卡类游戏（推箱子）：每关必须保证箱子数 = 目标数，否则无法通关
- **动画风格**：所有弹窗/路由/Toast 的动画 keyframes 统一放 `src/styles/animations.css`，不要在各组件里重复定义 `@keyframes`
- **可访问性**：所有交互按钮已有 `:focus-visible` 聚焦环；CRT scanlines 层加了 `aria-hidden="true"`；全局 `prefers-reduced-motion` 已处理
- **移动端适配**：overlay 类组件 `padding-top` 用 `max(24px, env(safe-area-inset-top) + 16px)` 避免 iPhone 刘海遮挡
