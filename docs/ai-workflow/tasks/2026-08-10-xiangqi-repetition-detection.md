# 任务：中国象棋重复局面判定（长将/长捉/长打/双方闲循环）

> 模式：**粗（macro）** —— 引擎层新增 + 视图层集成 + 测试覆盖。
> 日期：2026-08-10
> 关联分析：源自 ux-enhancements 任务执行时扩展实现，现为正式化立项。
> 约定：任务文件创建即登记，state.json 的 `current_task` 指向本文件 `<date>-<slug>`（去 `.md`）。

---

## 任务目标

给中国象棋**单机版（本地双人 + 人机）**添加重复局面棋例判定，防止无限循环对局：
- 同一局面第 3 次出现且构成严格周期 4 循环时触发裁决
- 单方长打（长将/长捉/长打）→ 该方判负
- 双方长打 → 不变作和
- 长将优先：一方长将另一方非长将 → 长将方负
- 双方均闲的循环 → 不变作和

---

## 约束（明确不改什么）

- **纯函数核心**：`checkRepetitionViolation(moves, positions)` 必须是纯函数，输入走法序列 + 局面序列，输出裁决结果或 null，零 Vue/DOM 依赖
- **不动既有规则正确性**：`generateMoves / applyMove / isInCheck / getGameStatus / classifyMove / isPinned / toNotation` 一律不改
- **不动联机版** `XiangqiOnlineView.vue`
- **不动** `src/lib/games.ts`（注册）、`router`、`stores`、`achievements`
- **不引入新依赖**，不新增测试框架（沿用 `tests/*.cjs` 手写 node 脚本）
- 局面历史（`positions`）在视图层用 ref 管理，引擎层不持有状态

---

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/rules.ts` | 新增 `checkRepetitionViolation(moves, positions)` 纯函数 + 辅助函数（`boardsEqual` / `isLineClear` / `countBetween` / `canCaptureAt`） | [x] |
| `src/views/XiangqiView.vue` | 视图层集成：`positions` / `playedMoves` ref 追踪，`checkGameState` 调用判定，`undoMove` / `resetGame` 同步清理，`resultMessage` 显示裁决结果 | [x] |
| `tests/test-xiangqi.cjs` | Suite 28：覆盖长将、长捉、双方长将、长将优先、双方闲循环、非严格重复不判、步不足不判 | [x] |

---

## 验收标准

- [x] **R-1** 单方长将循环（车反复将军对方应将）→ 判 `violation`，长将方负
- [x] **R-2** 单方长捉循环（车追马）→ 判 `violation`，长捉方负
- [x] **R-3** 双方长将循环 → 判 `mutual_draw`，`reason = mutual_attack`
- [x] **R-4** 长将优先：红长将 + 黑长捉 → 长将方（红）判负
- [x] **R-5** 双方均闲的重复循环 → 判 `mutual_draw`，`reason = mutual_idle`
- [x] **R-6** 局面重复但两周期着法不同 → 不判（返回 null）
- [x] **R-7** 半步数不足 8 → 不判（返回 null）
- [x] **R-8** 悔棋时 `positions` / `playedMoves` 同步 pop，不出现索引错位
- [x] **R-9** 重置时 `positions` 恢复为 `[initialBoard()]`，`playedMoves` 清空
- [x] **Z** `npm run build` 通过，无 TS `noUnusedLocals` / 类型报错；`npm test` 全绿（含 Suite 28）

---

## Review Checklist（架构合规）

- [x] `checkRepetitionViolation` 为纯函数：输入 `Move[]` + `Board[]`，输出 `RepetitionVerdict | null`，零 Vue/DOM 依赖
- [x] 引擎层不持有局面历史状态——`positions` / `playedMoves` 仅在视图层用 ref 管理
- [x] `canCaptureAt` 仅做纯几何吃子判定（不考虑送将），符合"捉"的判定需求
- [x] 裁决结果通过 `resultMessage` 计算属性展示，不新增全局状态
- [x] 不影响既有将死/困毙判定逻辑（重复判定在 `checkGameState` 中优先检查，但仅在 8 步后触发）
- [x] 测试覆盖全部 5 种子类型（violation × 3 种 reason + mutual_draw × 2 种 reason）

---

## 关键参考（执行者必读，含行号）

- `src/engine/xiangqi/rules.ts:395` —— `checkRepetitionViolation` 入口及完整实现
- `src/engine/xiangqi/rules.ts:395-430` —— 辅助函数（`boardsEqual` / `isLineClear` / `countBetween` / `canCaptureAt`）
- `src/engine/xiangqi/types.ts:14` —— `Board` 类型定义（局面比较的基础）
- `src/views/XiangqiView.vue:297-302` —— `positions` / `playedMoves` ref 定义
- `src/views/XiangqiView.vue:541-543` —— `executeMove` 中推送局面历史
- `src/views/XiangqiView.vue:580-584` —— `undoMove` 中同步 pop
- `src/views/XiangqiView.vue:645-666` —— `checkGameState` 中调用重复判定
- `tests/test-xiangqi.cjs:863` —— Suite 28 完整测试

---

## 算法说明（简化版中国棋规）

**触发条件**：当前局面第 3 次出现，且最近两个周期 4 循环（各 4 个半步）着法完全相同。周期 4 是最小可能的重复周期（周期 2 在交替走子下几何上不可能）。

**每步分类**：
- **将**：走后对方被将军（`isInCheck`）
- **捉**：走动子能吃到对方下一步逃走的非将非兵棋子（纯几何判定）
- **闲**：既非将也非捉

**判罚规则**：
| 红方 | 黑方 | 裁决 |
|------|------|------|
| 长打 | 长打 | 双方不变作和 |
| 长将 | 非长将 | 长将方负 |
| 长打 | 闲 | 长打方负 |
| 闲 | 闲 | 双方不变作和 |

**未覆盖**：杀（叫杀/长杀）检测、一将一杀等含杀的混合长打暂按闲处理。

---

## 修复方案（review 阶段追加）

### Review 结果（2026-08-10）

| 级别 | 发现 | 状态 |
|------|------|------|
| 🟡 P2 | Suite 28 未覆盖 `perpetual_attack`（一将一捉的混合长打）场景 | ✅ 已补 28.8 |
| ⚪ P3 | `positions` ref 每步存一个完整棋盘克隆，长对局（100+ 步）会累积内存；可接受，后续可优化为只存 Zobrist 哈希 | 不进 backlog |

---

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Codex | 实现 + 测试完成，build/test 全绿 | 作为 ux-enhancements 扩展实现，本任务正式化 |
| 2 | Claude | Review 通过架构合规，P2：缺 perpetual_attack 测试 | 待补测试 |
| 3 | Claude | 补 Suite 28.8（一将一捉），347/347 全绿 | 无 |
