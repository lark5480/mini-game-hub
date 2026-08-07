# 任务模式：粗（macro）

选择依据：新游戏视图、多文件（XiangqiBoard.vue + XiangqiView.vue + XiangqiOnlineView.vue + games.ts + router），Codex 自主实现细节，Claude 只验收结果。

## 任务目标

实现中国象棋棋盘渲染（Canvas）+ 本地双人模式 + 模式选择屏 + games.ts 注册 + 路由映射，完成可下完的完整本地对局。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/lib/games.ts` | 追加第 11 个游戏 `{ name: 'xiangqi', title: '中国象棋', desc: '本地双人 · 人机 · 联机', color: '#FF4D4D', path: '/xiangqi' }`（提交前与现有 10 款做去撞色核对） | ✅ |
| `src/router/index.ts` | `GAME_COMPONENTS` 追加 `'xiangqi': 'XiangqiView'` | ✅ |
| `src/views/XiangqiView.vue` | 入口：模式选择屏（本地双人 / 联机）+ 本地双人模式完整实现 + 内嵌 XiangqiOnlineView 联机子组件 | ✅ |
| `src/components/XiangqiBoard.vue` | Canvas 棋盘组件（纯展示 + 交互事件，不含规则逻辑）：木纹底色、棋子绘制、选子高亮、合法落点提示 | ✅ |
| `src/views/XiangqiOnlineView.vue` | 联机子组件（被 XiangqiView 内嵌，TTT 先例）：走法同步 + 认输/求和 + 断线恢复 | ✅ |

## 验收标准

- [x] `npm run build` 零错误
- [x] 首页卡片列表自动出现"中国象棋"（games.ts 注册生效）
- [x] 点击卡片进入 `/xiangqi`，显示模式选择屏（本地双人 / 联机 两张卡）
- [x] 选"本地双人"进入对局：Canvas 棋盘正确渲染初始局面（木纹底 #f0d9b5、线 #8b4513、楚河汉界文字）
- [x] 点选己方棋子 → 高亮全部合法落点（调用 `generateMoves`） → 点落点走子
- [x] 再点已选棋子取消选择；再点其他己方棋子切换选择
- [x] 吃子从棋盘移除；走子后轮替
- [x] 将军时 toast/横幅提示「将军！」
- [x] 将死/困毙 → GameDialog 弹出结算（胜负/和棋 + 步数）
- [x] 悔棋按钮：撤销最后一步（本地双人可用）
- [x] 认输按钮：立即结束对局
- [x] 暂停按钮（useGamePause）：本地双人可暂停
- [x] 完整对局可下完（红先黑后，一人一步）
- [x] 移动端：竖屏棋盘占满宽度，触摸点选可用
- [x] 联机模式入口可用（XiangqiOnlineView 内嵌，走法同步已实现）

## Review Checklist

- [x] 架构合规：视图用 GameLayout + GameDialog 框架，不自建外壳
- [x] Canvas 在 onUnmounted 清理（resize 监听）
- [x] 无 @keyframes（无动画需求）
- [x] 复用 useSound / useHaptics / useGamePause / useToast 等现有 composable
- [x] 引擎调用正确：`generateMoves` / `applyMove` / `isInCheck` / `getGameStatus`
- [x] 命名 snake_case 与项目一致（Round 2 修正 `i_am`）
- [x] 无死代码、无未使用变量（npm run build 通过）
- [x] 联机子组件内嵌方式照抄 TicTacToeView 的 `v-else` + `ref` 模式

## Review 结论（2026-08-06，两轮）

| 轮次 | 🔴 P0 | 🟡 P1 | 🔵 P2 | ⚪ P3 |
|------|-------|-------|-------|-------|
| Round 1 | 1 | 0 | 4 | 3 |
| Round 2 | 0 ✅ | 0 | 0 ✅ | +1（checkGame 可读性） |

**P0+P1 清零，P2 已修，P3 进 BACKLOG。T2 可提交。**

## 上线后修复（2026-08-07）

| 日期 | 级别 | 问题 | 修复 |
|------|------|------|------|
| 08-07 | 🔴 P0 | `getPositionFromEvent` 用 `Math.round` 导致点击中心点偏移一格（1.5→2, 7.5→8），选中错误位置 | `src/components/XiangqiBoard.vue:294-295` 改用 `Math.floor` |

## 关键参考

- `src/views/TicTacToeView.vue` — 模式选择屏 / URL ?room= 直达 / 联机子组件内嵌 / 暂停排除联机（**最直接的参照**）
- `src/views/TicTacToeOnlineView.vue` — 联机子组件实现先例
- `src/components/GameLayout.vue` — 框架 props（title / accentColor / hints / infoItems / tutorial）
- `src/lib/games.ts` — 游戏注册表（单一数据源）
- `src/router/index.ts` — 路由自动生成 + GAME_COMPONENTS 映射
- `src/engine/xiangqi/rules.ts` — 引擎 API（T1 已交付）
- `src/styles/animations.css` — 动画 keyframes 统一存放
- `AGENTS.md` — 游戏开发约定 + 共享组件注册表

## 实现约束（Codex 必须遵守）

1. **视图框架**：XiangqiView 必须用 `<GameLayout>` + `<GameDialog>`，不自建外壳
2. **棋盘视觉**：Canvas 内部木纹配色（底 #f0d9b5、线 #8b4513、楚河汉界文字），外层 GameLayout 霓虹暗主题 + accentColor #FF4D4D
3. **XiangqiBoard 组件职责**：纯展示 + 交互事件（点击 → 坐标 → 父组件判断），**不含规则逻辑**；规则全部调用 `src/engine/xiangqi/rules.ts`
4. **模式选择屏**：`mode === null` 显示选择卡；`mode === 'local'` 显示本地对局；`mode === 'online'` 内嵌 `<XiangqiOnlineView>`
5. **URL 直达**：`?room=XXXX` 直接进联机模式（TTT 先例，ROOM_RE = `/^[A-Z0-9]{4}$/`）
6. **悔棋**：仅本地双人模式可用；维护 `history: Board[]` 数组，悔棋 pop 回上一状态
7. **暂停**：`canPause` 排除联机模式（`mode.value !== 'online'`）
8. **重启按钮**：联机模式不绑定（PITFALLS P-004，本地重置不广播）
9. **不进排行榜**：不调 `checkGameOver` / `addScore`（PRD D2）
10. **games.ts 颜色**：`#FF4D4D` 为占位，提交前与现有 10 款做去撞色核对（当前用色：#7CFF3D / #FF006E / #05FFA1 / #B967FF / #2D7DFF / #FF5A36 / #FFD700 / #FF7A3D / #FF4DFF / #00CFFF）
11. **联机子组件**：若 T3 不做完整联机，XiangqiOnlineView 可先只实现降级提示卡（no-supabase）+ 房间号显示，走法同步留 T3

## 修复方案（review 阶段追加）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|

## 修复方案（review 阶段追加）

### Round 2 修复（2026-08-06，Review 后）

**P0（必须修）：XiangqiOnlineView.vue 联机走子逻辑失效**
- 问题：`handleTap` 中 `m.from === pos && m.to === pos` 永远匹配不到合法走法（from 和 to 不能相同），导致联机模式无法走子
- 修复：参考 XiangqiView.vue 实现两步选择流程
  - 新增 `const selected = ref<Position | null>(null)` 和 `const legalTargets = ref<Position[]>([])`
  - 重写 `handleTap`：第一次点击己方棋子 → 选中；第二次点击合法落点 → 执行走法；点击其他己方棋子 → 切换选择；点击非法位置 → 取消选择
  - 新增 `selectPiece` / `clearSelection` / `executeMove` 三个辅助函数
  - 模板传递 `:selected="selected"` 和 `:legalTargets="legalTargets"`
  - `resetBoard` 开头清除选择状态

**P2（顺手修，4 条）：**
1. `games.ts` 末尾：删除多余空行，文件末尾只保留 1 个换行 ✅
2. `router/index.ts` 末尾：删除第 54 行的多余空行 ✅
3. `XiangqiOnlineView.vue:140`：`const iAm` → `const i_am`（snake_case），下方同步更新 ✅
4. `XiangqiBoard.vue:218`：黑方炮 label `'砲'` (U+7832) → `'炮'` (U+70AE)，与红方统一 ✅

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗问题 |
|------|--------|------|--------|
| 1 | Codex（执行） | build 零错误 + 114/114 测试通过 | 无 |
| 2 | Codex（修复） | P0 两步选择逻辑修复 + 4 条 P2 修复，build 零错误 | 无 |
| 3 | Codex（T3 联机） | 认输/求和/sync-req/state/banners 全部实现，build 零错误 | 无 |
