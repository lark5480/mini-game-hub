# CLAUDE.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

详见 [README.md](./README.md)（游戏列表、启动命令、目录结构、部署指南）。
详细的组件/注册表/composable 速查见 [AGENTS.md](./AGENTS.md)。

## 游戏开发约定

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" :hints="[...]" :infoItems="[...]" @back="router.push('/')">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <LeaderboardStrip :game="'xxx'" />
  </GameLayout>
  <PauseOverlay :visible="paused" @resume="togglePause" />
  <ResumePrompt :visible="showResume" @continue="continueGame" @new-game="newGame" />
  <GameDialog v-model:visible="gameOver" ... />
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
</script>
```

**关键约束：**
- 框架统一用 `GameLayout` + `GameDialog` + `DirectionPad`，暂停/恢复统一用 `useAutoPause` + `PauseOverlay` + `ResumePrompt` + P/Esc 键
- 动画循环用 `useGameLoop({ onUpdate, mode, fixedStep? })`；暂停时 rAF 链自动停止
- 键盘用 `useGameKeyboard({ bindings, active })`；连发加 `{ repeat: { intervalMs: 120 } }`；加 `{ onKeyUp: true }` 分离 keyup
- 分数用 `useGameStore().addScore(gameName, score)`
- 音效用 `useSound()`；暂停/恢复分别调 `sound.pause()` / `sound.resume()`
- 震动用 `useHaptics()`（pulse / success / light / win）
- 浮动分数用 `useScoreFloats().pop('+10', x, y)`
- **新增游戏只需改 `src/lib/games.ts` + 在 router 的 `GAME_COMPONENTS` 加一行映射**（详见 [AGENTS.md](./AGENTS.md) 的「共享组件注册表」）

## 成就系统

- `src/stores/achievements.ts` — Pinia store，元数据 `ACHIEVEMENTS`（10 个）+ `Set<string>` 已解锁 + localStorage 持久化（key: `game-achievements`）
- `src/composables/useToast.ts` + `src/components/GameToast.vue` — 顶部 Toast 通知（2 秒自动消失 + 淡入动画）
- `src/views/AchievementsView.vue` — `/achievements` 路由
- `unlock()` **内部自动触发 `sound.unlock()` + `haptics.success()`**，调用方只需再加 `toast.show(...)`
- **新增成就**：在 `ACHIEVEMENTS` 数组加条目 → 在对应游戏触发点调用 `achievements.unlock('id')` + `toast.show(...)` → `/achievements` 自动显示
- **自动完美主义**：其余 9 个成就全解锁时自动解锁 `perfectionist`

## 全局积分排行榜（Supabase）

架构：前端（Supabase JS SDK）→ Supabase PostgreSQL → RLS 安全策略

**核心文件：**
- `src/lib/supabase.ts` — 客户端单例（env 缺失时返回 null）
- `src/composables/useLeaderboard.ts` — `submit()` 含 5s 超时 + 错误友好化映射；`fetch()` / `leaderboardVersion` 全局刷新信号
- `src/components/LeaderboardOverlay.vue` — 带重试按钮 + safe-area + 淡入动画
- `src/components/LeaderboardStrip.vue` — 自动监听 `leaderboardVersion` 刷新

**昵称去重逻辑**：submit 前查 (game, nickname) 已有记录，新分更高则 update，否则跳过。纯应用层。

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

## 新增游戏步骤

详见 [AGENTS.md](./AGENTS.md) 的「共享组件注册表」→ "新增游戏 checklist"。核心是在 `src/lib/games.ts` 的 `GAMES` 数组加一条 + `router/index.ts` 的 `GAME_COMPONENTS` 加一行映射，路由/Store/首页自动同步。

## 注意事项
- Canvas 游戏 `onUnmounted` 中清理 requestAnimationFrame
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- 测试在 `tests/` 下，`node test-xxx.cjs` 直接跑，无测试框架依赖
- 关卡类游戏（推箱子）：每关必须保证箱子数 = 目标数
- 所有动画 keyframes 统一放 `src/styles/animations.css`，不要各组件重复定义
- overlay 类组件 padding 用 `max(24px, env(safe-area-inset-*) + 16px)` 适配 iPhone 刘海
