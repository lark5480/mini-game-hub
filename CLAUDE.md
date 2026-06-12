# CLAUDE.md

小游戏合集 — Vue 3 + TypeScript + Vite + Pinia + Vue Router。原生 CSS（复古霓虹主题），无 UI 库。

详见 [README.md](./README.md)（游戏列表、启动命令、目录结构）。

## 游戏开发约定

所有游戏视图遵循统一模式：

```vue
<template>
  <GameLayout title="..." accentColor="#XXX" :hints="[...]" :infoItems="[...]" @back="router.push('/')">
    <!-- 游戏画面区 -->
    <template #controls><DirectionPad ... /></template>
    <GameDialog v-model:visible="gameOver" ... />
  </GameLayout>
</template>

<script setup lang="ts">
import { useGameKeyboard } from '@/composables/useGameKeyboard'
import { useGameLoop } from '@/composables/useGameLoop'
import { useGameStore } from '@/stores/game'
</script>
```

**关键约束：**
- 游戏框架统一用 GameLayout + GameDialog + DirectionPad，不要各写一套
- 动画循环用 `useGameLoop({ onUpdate, mode, fixedStep? })`，组件卸载自动清理
- 键盘用 `useGameKeyboard({ bindings, active })`，`active=false` 时自动忽略输入；同一键需 keyup/keydown 分离时加 `{ onKeyUp: true }`
- 分数用 `useGameStore().addScore(gameName, score)`
- **新增游戏**必须同步：路由（`src/router/index.ts`）→ Store（`src/stores/game.ts` 的 `defaultScores()`）→ 首页卡片（`HomeView.vue`）

## 注意事项
- Canvas 游戏 `onUnmounted` 中清理 requestAnimationFrame
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- 测试在 `tests/` 下，`node test-xxx.cjs` 直接跑，无测试框架依赖
