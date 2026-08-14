# 小游戏合集 — 架构说明

## 技术栈

Vue 3 + TypeScript + Vite + Pinia + Vue Router，原生 CSS（CSS 变量驱动主题），无第三方 UI 库。

## 组件树

```
App.vue（全局样式 + scanlines 特效）
└── <router-view>
    ├── HomeView          — 首页游戏选择（11 张卡片）
    ├── AchievementsView  — 成就展示
    ├── SokobanView       — 推箱子（v-for 网格）
    ├── LinkGameView      — 连连看（v-for 网格 + 键盘光标）
    ├── CatchFruitView    — 接水果（v-for 移动元素）
    ├── SnakeView         — 贪吃蛇（v-for 网格）
    ├── TetrisView        — 俄罗斯方块（v-for 网格 + 右侧面板）
    ├── BreakoutView      — 弹球打砖块（Canvas 2D）
    ├── Game2048View      — 2048（v-for 网格 + 撤销历史）
    ├── WhackAMoleView    — 打地鼠（setInterval/Timeout 点触）
    ├── WhackAMoleRaceView — 打地鼠·竞速（在线实时对战）
    ├── SimonView         — 西蒙记忆灯（看灯序复述）
    ├── TicTacToeView     — 井字棋（单人 AI）
    ├── TicTacToeOnlineView — 井字棋·双人（在线实时对战）
    ├── XiangqiView       — 中国象棋（人机/本地双人，Web Worker 搜索）
    └── XiangqiOnlineView — 中国象棋·联机（在线实时对战）
```

## 共享组件

| 组件 | 职责 |
|------|------|
| `GameLayout` | 游戏外层框架：标题栏（含静音/重启按钮）、键盘提示、游戏主区域、控制区插槽。通过 `accentColor` prop 注入 CSS 变量 `--game-accent` |
| `GameDialog` | 弹窗（成功/失败/信息），`v-model:visible` 控制显隐，`@action` 处理按钮点击，自带淡入动画 + safe-area；`newRecord` prop 显示金色新记录徽章（badge-pop 弹跳动画），`achievementHint` prop 显示成就接近提示 |
| `DirectionPad` | 触屏方向键，`cross` / `horizontal` 两种布局，`repeat` 长按连发 |
| `PauseOverlay` | 暂停遮罩，`@resume` 触发继续，自带淡入动画 + safe-area |
| `ResumePrompt` | 继续上局 / 重新开始 选择弹窗，失焦/按 P 暂停时弹出，自带淡入动画 + safe-area |
| `ScoreFloat` | 浮动分数动画（`+10 / +20` 等），0.8s 上浮消失 |
| `LeaderboardOverlay` | 提交分数 → 排行榜（Top N + 邻位排名）→ 再来一局，5s 超时 + 重试按钮 + 友好中文错误 + safe-area；提交后展示玩家前后各 range 名的邻位排名 + 推荐未玩过的游戏 |
| `LeaderboardStrip` | 嵌入各游戏底部和首页卡片，自动监听 `leaderboardVersion` 刷新 |
| `GameToast` | 顶部成就解锁 Toast，2s 自动消失 + 淡入动画 + safe-area |
| `XiangqiBoard` | 象棋棋盘 Canvas 渲染 + 点击选子/落子交互 | `flipped` prop 支持黑方视角翻转（联机） |
| `WhackAMoleBoard` | 打地鼠 3×3 洞位棋盘 | 坐标回调驱动 WhackAMoleView / Race 两视图 |

## 共享逻辑

| Composable | 职责 |
|------------|------|
| `useGameLoop` | 游戏循环：`interval` / `raf` 两种模式；暂停时 rAF 链自动停止；dt clamp(100ms) 防止 tab 切回瞬移 |
| `useGameKeyboard` | 键盘绑定，`repeat` 支持长按连发，`isDown()` 查询当前按键状态，blur 时自动清"粘键" |
| `useAutoPause` | 监听 `visibilitychange`，页面切到后台自动触发暂停回调 |
| `useGamePause` | 统一暂停/恢复骨架：封装 P/Esc + 失焦 + PauseOverlay/ResumePrompt 联动 |
| `useSound` | Web Audio API 合成音效（tone/sweep），23+ 预设，全局 `muted` ref + localStorage 持久化，mute 切换给确认 click |
| `useHaptics` | 移动端震动反馈（`light / tap / select / pulse / success / error / win`），无振动环境静默 |
| `useScoreFloats` | 浮动分数堆叠管理，`pop(text, x, y)` 触发新浮动 */
| `useGameSave` | 存档/读档/继续游戏（localStorage），每 300ms 节流自动保存 |
| `useAutoSave` | 自动保存（300ms 节流写 localStorage） |
| `useLeaderboard` | 排行榜 CRUD：`submit()` 含 5s 超时 + 错误友好化映射；全局 `leaderboardVersion` 广播刷新信号；`fetchNearby(score, nickname, range)` 用 COUNT 定全局排名 + range 拉邻位窗口 |
| `useGameOver` | 游戏结束统一处理：检测新记录 + 写入分数 + 播放音效 + 成就接近提示（分数达 75% 阈值时提示"还差 N 分"，达成时自动解锁成就） |
| `useToast` | 顶部 Toast 通知（成就解锁用） |
| `useSwipe` | 移动端滑动手势（2048/贪吃蛇等用） |
| `useRealtimeRoom` | 联机房间基础：Supabase Realtime 频道 + 房主/客人角色（井字棋/象棋双人复用） |
| `useRaceRoom` | 打地鼠竞速房间：倒计时同步 + 进度广播 + 结算 |
| `useXiangqiAI` | 象棋 AI 调度器：Web Worker 搜索（`requestSearch` / `cancel` / `dispose`），自动取消旧搜索、消息 FIFO、postMessage 前 `toPlainBoard` 深拷贝 |

## PWA（渐进式 Web 应用）

- **插件**：`vite-plugin-pwa`，`registerType: 'autoUpdate'`（自动更新 service worker）
- **注册**：`App.vue` 在 `onMounted` 中动态 `import('virtual:pwa-register')`，仅生产环境注册
- **Manifest**：`vite.config.ts` 中配置名称、图标（192/512 + maskable）、主题色 `#0D0D1A`、standalone 显示
- **离线缓存**：Workbox `globPatterns` 预缓存静态资源；Supabase API 走 `NetworkFirst`（24h 过期、最多 50 条）
- **安全假设**：当前 Supabase 查询均为 anon 公共数据，缓存无跨用户泄露风险；未来引入认证需按用户隔离缓存
- **错误兜底**：`main.ts` 全局 `errorHandler` + `unhandledrejection` 监听，防止 Vue 渲染异常白屏

## 游戏注册表（单源）

`src/lib/games.ts` 导出 `GAMES: GameMeta[]` —— 路由配置、`defaultScoreKeys()`、首页卡片列表全部从它派生。新增游戏流程见文末「新增游戏 checklist」（games.ts 加条目 + router 的 `GAME_COMPONENTS` 加视图映射 + HomeView iconMap 加图标）。

## 中国象棋引擎

`src/engine/xiangqi/` 纯 TS 零依赖，浏览器 / Node 测试 / Worker 三端复用：

| 文件 | 职责 |
|------|------|
| `types.ts` | `Board` / `Piece` / `Move` / `Side` / `GameStatus` 类型 |
| `rules.ts` | 走法生成 `generateMoves`、合法性 `isLegalMove`、送将拦截 `classifyMove`、将死/困毙 `getGameStatus`、重复局面裁决 `checkRepetitionViolation`（长将/长捉/长杀/长打，周期 4..32 半步） |
| `ai.ts` | `findBestMove`：negamax + alpha-beta + 迭代加深 + TT/killer/history + LMR + 空着剪枝 + quiescence（重复拦截 repPath 并入对局历史）；`evaluateBoard` = 子力 + PST + 轻量结构评估（车半/全开放线、连兵/孤兵/叠兵、王翼兵保护，单遍扫描零额外开销） |
| `openings.ts` | 开局库：UCCI 主变查表直出（命中零延迟，未命中回退搜索），构建期 `generateMoves` 自检棋谱，同局面多着法随机选一 |
| `notation.ts` | 中国象棋记谱 `toNotation`（车五进三 等） |

- **搜索线程**：`useXiangqiAI` 封装 Worker（`src/workers/xiangqi-ai.worker.ts`），主线程不阻塞；postMessage 前必须 `toPlainBoard` 深拷贝（Vue 响应式 Proxy 无法结构化克隆），Worker 保留 TT 跨调用
- **重复局面罚分**（negamax 路径检测）：罚分 2×MATE 级（严格劣于任何真实将杀，AI 永不主动违规）；按「当前方是否被将」归属（被将节点罚将军方=最后走子方，未被将节点罚当前方）；被将局面的第 2 次重复即提前惩罚将军方（再一轮即触发视图长将判负）
- **难度参数**（XiangqiView 常量）：简单固定深度 2；中等深度 4 + 限 1.2s + 深度下限 3；困难深度 8 + 限 4s + 深度下限 4（超时回退已完成深度最佳着法；未达下限时延长搜索，硬截止 2×时限，保证慢设备保底强度）；提示限 2s + 深度下限 3
- **提前出手**（`findBestMove` 第 8 参 `earlyExit`，默认开启）：根分 ≥ 900（约净多一车）且完成 ≥ 4 层、或最佳着法连续 3 层不变且完成 ≥ 5 层且 |根分| ≥ 150 → 提前终止（大劣不提前，保留翻盘深搜）；实际只作用于困难/困难提示（简单深度 2、中等深度 4 低于下限），焦灼局面仍搜满时限保强度
- **AI 历史窗口**：`recentHistoryKeys` 最近 32 半步并入搜索 repPath，与重复局面裁决窗口一致
- **复盘演示**：XiangqiView 棋谱面板支持逐手回放/自动播放（三档速度），点击着法把棋盘切到历史局面快照（`positions` 数组，moves[i] ↔ positions[i+1]），回放中禁走子/禁 AI 调度（退出回放恢复）
- **测试**：`tests/test-xiangqi.cjs`（`node tests/test-xiangqi.cjs` 直接跑，自动 tsc 编译到 tests/.tmp-xiangqi）

## Store

`useGameStore`（Pinia）：`scores[gameName]` → `GameScore[]`，`addScore()` 自动排序 + 截断 top 10，`watch(deep)` 自动写入 `localStorage`。分数注册表通过 `defaultScoreKeys()` 引用 `GAMES`。

`useAchievements`（Pinia）：元数据 `ACHIEVEMENTS` 数组（13 个）+ `Set<string>` 已解锁 + localStorage 持久化（key: `game-achievements`）；**`unlock()` 内部自动调用 `sound.unlock()` + `haptics.success()`**；其余成就全解锁时自动解锁 `perfectionist` 元成就。

## 数据流

```
用户操作（键盘/触屏/滑动）
  → useGameKeyboard / DirectionPad / useSwipe
  → 游戏视图更新状态
  → useGameLoop 驱动渲染（interval 或 rAF）
  → 游戏事件触发音效（useSound）+ 震动（useHaptics）+ 浮动分数（useScoreFloats）
  → 游戏结束 → useGameOver.checkGameOver()
      → useGameStore.addScore() → localStorage 持久化
      → 新记录徽章 + 胜利音效
      → 成就接近提示 / 自动解锁
  → 打开 LeaderboardOverlay → useLeaderboard.submit() → Supabase + 全局广播
           → fetchNearby() 展示邻位排名
  → 成就达成 → achievements.unlock() → sound.unlock() + haptics.success() + toast.show()
```

## 部署与基础设施

> 本节为 Supabase + 部署的**权威源**。README.md / AGENTS.md / CLAUDE.md 不再重复下述 SQL、环境变量、核心文件列表，改为"详见本节"。

### Supabase 架构

前端（Supabase JS SDK）→ Supabase PostgreSQL → RLS 安全策略。`src/lib/supabase.ts` 在 env 缺失时返回 null，排行榜功能静默降级。

### 核心文件

- `src/lib/supabase.ts` — 客户端单例（`createClient`），env 缺失时返回 null
- `src/composables/useLeaderboard.ts` — `submit(nickname, score)` / `fetch(game, limit)` / `leaderboardVersion` 全局刷新信号；含 5s 超时 + 错误友好化映射
- `src/components/LeaderboardOverlay.vue` — 提交分数 → 显示排行榜 → 再来一局
- `src/components/LeaderboardStrip.vue` — 嵌入各游戏页面底部和首页卡片，自动监听 `leaderboardVersion` 刷新
- `.env.example` — 模板（`VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`）

### 昵称去重逻辑

`submit` 前查 (game, nickname) 已有记录，新分更高则 update，否则跳过。纯应用层，不依赖数据库 unique constraint。

### 环境变量（Netlify + 本地各配一份）

- `VITE_SUPABASE_URL` ← Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY` ← Publishable key（不是 Secret key）

### Supabase SQL（部署前必须执行一次）

在 Supabase Dashboard → SQL Editor 执行：

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

### Netlify 部署

1. Supabase 项目已创建 → SQL 已执行（见上方）→ `.env` 已配（本地用，不提交）
2. 推送代码到 GitHub → Netlify 导入 → **Site settings → Environment variables** 添加上述两个 env
3. Deploy settings：`npm run build` / 发布目录 `dist`
4. 触发部署

### 验证

- 访问部署 URL → 打开任一游戏 → 结束应能提交 → 看到排行榜
- 排行榜条自动显示最新数据

## 文档权威源说明

| 主题 | 权威性 |
|------|--------|
| 游戏开发约定（模板 + 约束）| [AGENTS.md](../AGENTS.md)（CLAUDE.md 保留硬规则副本）|
| Supabase SQL / 环境变量 / 核心文件 / 部署 | **本文档**（本节）|
| 成就系统架构事实 | **本文档**（Store 段）|
| 成就系统新增操作流程 | [CLAUDE.md](../CLAUDE.md)（仅该 8 行）|
| 项目门面（游戏列表 / 快速开始 / 目录树）| [README.md](../README.md) |

如 schema 或部署流程变更，请**只更新本节**，其他文档通过指针引用——勿在其他文档里独立维护副本。

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
5. （可选）在 `src/stores/achievements.ts` 加成就 + 在游戏触发点调用 `achievements.unlock('id')` + `toast.show(...)`

> 参考 `SnakeView.vue`（最完整的实现模板）。
