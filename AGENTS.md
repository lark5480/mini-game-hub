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
- 游戏框架统一用 GameLayout + GameDialog + DirectionPad，不要各写一套
- 动画循环用 `useGameLoop({ onUpdate, mode, fixedStep? })`，组件卸载自动清理
- 键盘用 `useGameKeyboard({ bindings, active })`，`active=false` 时自动忽略输入；同一键需 keyup/keydown 分离时加 `{ onKeyUp: true }`
- 分数用 `useGameStore().addScore(gameName, score)`
- 音效用 `useSound()`，导入后通过 `sound.xxx()` 调用（全局静音由 GameLayout 统一控制，无需各游戏自行处理）
- 内嵌排行榜条：`<LeaderboardStrip :game="'xxx'" />` 放在默认 slot 底部，自动加载 Top 5
- **新增游戏**必须同步：路由（`src/router/index.ts`）→ Store（`src/stores/game.ts` 的 `defaultScores()`）→ 首页卡片（`HomeView.vue`）

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
