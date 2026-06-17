# 小游戏合集 — 架构说明

## 技术栈

Vue 3 + TypeScript + Vite + Pinia + Vue Router，原生 CSS（CSS 变量驱动主题），无第三方 UI 库。

## 组件树

```
App.vue（全局样式 + scanlines 特效）
└── <router-view>
    ├── HomeView          — 首页游戏选择（8 张卡片）
    ├── SokobanView       — 推箱子（v-for 网格）
    ├── LinkGameView      — 连连看（v-for 网格 + 键盘光标）
    ├── CatchFruitView    — 接水果（v-for 移动元素）
    ├── SnakeView         — 贪吃蛇（v-for 网格）
    ├── TetrisView        — 俄罗斯方块（v-for 网格 + 右侧面板）
    ├── BreakoutView      — 弹球打砖块（Canvas 2D）
    ├── Game2048View      — 2048（v-for 网格 + 撤销历史）
    └── WhackAMoleView    — 打地鼠（setInterval/Timeout 点触）
```

## 共享组件

| 组件 | 职责 |
|------|------|
| `GameLayout` | 游戏外层框架：标题栏、键盘提示、游戏主区域、控制区插槽。通过 `accentColor` prop 注入 CSS 变量 `--game-accent` 驱动全组件颜色 |
| `GameDialog` | 弹窗（成功/失败/信息），`v-model:visible` 控制显隐，`@action` 处理按钮点击 |
| `DirectionPad` | 触屏方向键，`cross`（十字）和 `horizontal`（横排）两种布局 |

## 共享逻辑

| Composable | 职责 |
|------------|------|
| `useGameKeyboard` | 键盘绑定，自动 `addEventListener`/`removeEventListener`（keydown + keyup），`active` 控制是否响应，`onKeyUp` 标记 keyup 绑定 |
| `useGameLoop` | 游戏循环：`interval` 模式（`setInterval`，用于 Snake/Tetris/CatchFruit）或 `raf` 模式（`requestAnimationFrame` + 可选 `fixedStep`，用于 Breakout） |
| `useSound` | 音效系统：Web Audio API 合成音效（tone/sweep），20+ 预设（bounce/eat/merge/clear 等），全局 `muted` ref + `localStorage` 持久化，`readonly` 暴露防止绕过持久化 |

## Store（分数系统）

`useGameStore`（Pinia）：`scores[gameName]` → `GameScore[]`，`addScore()` 自动排序 + 截断 top 10，`watch(deep)` 自动写入 `localStorage`。

## 数据流

```
用户操作（键盘/触屏）
  → useGameKeyboard / DirectionPad
  → 游戏视图更新状态
  → useGameLoop 驱动渲染（interval 或 rAF）
  → 游戏事件触发音效（useSound.tone/sweep）
  → 游戏结束 → useGameStore.addScore() → localStorage 持久化
```

## 新增游戏 checklist

1. `src/views/YourGameView.vue` — 写游戏逻辑，用 GameLayout 包裹
2. `src/router/index.ts` — 添加路由
3. `src/stores/game.ts` — `defaultScores()` 注册游戏键名
4. `src/views/HomeView.vue` — 添加游戏卡片（icon、title、desc、color）
