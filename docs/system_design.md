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
| `GameLayout` | 游戏外层框架：标题栏（含静音/重启按钮）、键盘提示、游戏主区域、控制区插槽。通过 `accentColor` prop 注入 CSS 变量 `--game-accent` |
| `GameDialog` | 弹窗（成功/失败/信息），`v-model:visible` 控制显隐，`@action` 处理按钮点击，自带淡入动画 + safe-area |
| `DirectionPad` | 触屏方向键，`cross` / `horizontal` 两种布局，`repeat` 长按连发 |
| `PauseOverlay` | 暂停遮罩，`@resume` 触发继续，自带淡入动画 + safe-area |
| `ResumePrompt` | 继续上局 / 重新开始 选择弹窗，失焦/按 P 暂停时弹出，自带淡入动画 + safe-area |
| `ScoreFloat` | 浮动分数动画（`+10 / +20` 等），0.8s 上浮消失 |
| `LeaderboardOverlay` | 提交分数 → 排行榜 → 再来一局，5s 超时 + 重试按钮 + 友好中文错误 + safe-area |
| `LeaderboardStrip` | 嵌入各游戏底部和首页卡片，自动监听 `leaderboardVersion` 刷新 |
| `GameToast` | 顶部成就解锁 Toast，2s 自动消失 + 淡入动画 + safe-area |

## 共享逻辑

| Composable | 职责 |
|------------|------|
| `useGameLoop` | 游戏循环：`interval` / `raf` 两种模式；暂停时 rAF 链自动停止；dt clamp(100ms) 防止 tab 切回瞬移 |
| `useGameKeyboard` | 键盘绑定，`repeat` 支持长按连发，`isDown()` 查询当前按键状态，blur 时自动清"粘键" |
| `useAutoPause` | 监听 `visibilitychange`，页面切到后台自动触发暂停回调 |
| `usePause` | 统一暂停/恢复骨架：封装 P/Esc + 失焦 + PauseOverlay/ResumePrompt 联动 |
| `useSound` | Web Audio API 合成音效（tone/sweep），23+ 预设，全局 `muted` ref + localStorage 持久化，mute 切换给确认 click |
| `useHaptics` | 移动端震动反馈（`light / tap / select / pulse / success / error / win`），无振动环境静默 |
| `useScoreFloats` | 浮动分数堆叠管理，`pop(text, x, y)` 触发新浮动 */
| `useGameSave` | 存档/读档/继续游戏（localStorage），每 300ms 节流自动保存 |
| `useLeaderboard` | 排行榜 CRUD：`submit()` 含 5s 超时 + 错误友好化映射；全局 `leaderboardVersion` 广播刷新信号 |
| `useToast` | 顶部 Toast 通知（成就解锁用） |
| `useSwipe` | 移动端滑动手势（2048/贪吃蛇等用） |

## 游戏注册表（单源）

`src/lib/games.ts` 导出 `GAMES: GameMeta[]` —— 路由配置、`defaultScoreKeys()`、首页卡片列表全部从它派生。新增游戏只需加一条 + 在 router 的 `GAME_COMPONENTS` 加一行映射。

## Store

`useGameStore`（Pinia）：`scores[gameName]` → `GameScore[]`，`addScore()` 自动排序 + 截断 top 10，`watch(deep)` 自动写入 `localStorage`。分数注册表通过 `defaultScoreKeys()` 引用 `GAMES`。

`useAchievements`（Pinia）：10 个成就 + 自动 `perfectionist` 元成就；**`unlock()` 内部自动调用 `sound.unlock()` + `haptics.success()`** 提供感官反馈。

## 数据流

```
用户操作（键盘/触屏/滑动）
  → useGameKeyboard / DirectionPad / useSwipe
  → 游戏视图更新状态
  → useGameLoop 驱动渲染（interval 或 rAF）
  → 游戏事件触发音效（useSound）+ 震动（useHaptics）+ 浮动分数（useScoreFloats）
  → 游戏结束 → useGameStore.addScore() → localStorage 持久化
  → 打开 LeaderboardOverlay → useLeaderboard.submit() → Supabase + 全局广播
  → 成就达成 → achievements.unlock() → sound.unlock() + haptics.success() + toast.show()
```

## 暂停/恢复流

```
按 P / Esc / 切到后台
  → useAutoPause 触发 / useGameKeyboard 捕获 P/Esc
  → gameLoop.pause() + sound.pause()
  → PauseOverlay 弹出（淡入动画）
  → 用户点"继续" / 回前台弹 ResumePrompt
  → gameLoop.resume() + sound.resume() + haptics.pulse()
```

## 新增游戏 checklist

1. `src/lib/games.ts` — GAMES 数组加一条（name/title/desc/color/path）
2. `src/router/index.ts` — GAME_COMPONENTS 加一行映射
3. `src/views/XxxView.vue` — 写游戏逻辑：
   - GameLayout 包裹 + DirectionPad / useGameKeyboard
   - useGameLoop 驱动 + useAutoPause 失焦暂停
   - PauseOverlay + ResumePrompt 继续选择
   - useSound / useHaptics / useScoreFloats 反馈
   - LeaderboardStrip + LeaderboardOverlay 排行榜
   - useGameStore.addScore() 存档
4. `src/views/HomeView.vue` — iconMap 加一个图标（卡片列表自动从 GAMES 派生）
