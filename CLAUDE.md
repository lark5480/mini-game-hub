# CLAUDE.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

> 游戏开发约定（完整模板 + 关键约束）见 [AGENTS.md](./AGENTS.md)。Supabase SQL / 环境变量 / 核心文件 / 部署指南见 [docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」。

## 硬规则（Claude Code 改任何代码都须遵守）

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" :hints="[...]" :infoItems="[...]" @back="router.push('/')">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <GameDialog v-model:visible="gameOver" ... />
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
- **新增游戏只需改 `src/lib/games.ts` + 在 router 的 `GAME_COMPONENTS` 加一行映射**

## 注意事项

- Canvas 游戏 `onUnmounted` 中清理 requestAnimationFrame
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- 测试在 `tests/` 下，`node test-xxx.cjs` 直接跑，无测试框架依赖
- 关卡类游戏（推箱子）：每关必须保证箱子数 = 目标数
- 所有动画 keyframes 统一放 `src/styles/animations.css`，不要各组件重复定义
- overlay 类组件 padding 用 `max(24px, env(safe-area-inset-*) + 16px)` 适配 iPhone 刘海

## 外指链（架构 / 部署 / 注册表）

- **游戏开发约定完整版（注册表 + Supabase + 注意事项）**：[AGENTS.md](./AGENTS.md)
- **Supabase SQL / 环境变量 / 核心文件 / 昵称去重 / 部署步骤 / 成就架构**：[docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」
- **项目门面（游戏列表 / 快速开始 / 目录树）**：[README.md](./README.md)

## 成就系统（新增成就操作）

- 元数据 / 已解锁集合 / 自动 perfectionist 元成就 / 架构事实见 [docs/system_design.md](./docs/system_design.md) 的 Store 段
- **新增成就**：在 `src/stores/achievements.ts` 的 `ACHIEVEMENTS` 数组加条目 → 在对应游戏触发点调用 `achievements.unlock('id')` + `toast.show(...)` → `/achievements` 自动显示
- `unlock()` **内部自动触发 `sound.unlock()` + `haptics.success()`**，调用方只需再加 `toast.show(...)`
