# 任务模式：粗（macro）

选择依据：新游戏引擎、多文件（types.ts / rules.ts / ai.ts + 测试文件 ≥50 用例），Codex 自主实现细节，Claude 只验收结果。

## 任务目标

实现中国象棋规则引擎（纯函数、零 Vue/DOM 依赖）+ ≥50 单元测试，覆盖七种棋子走法、全局约束、将死/困毙判定，每条红线规则（蹩马腿/塞象眼/无炮架/飞将/送将）≥2 个专项反例。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/types.ts` | 核心类型：Side / PieceType / Piece / Board / Position / Move / GameStatus / GameRecord | ✅ |
| `src/engine/xiangqi/rules.ts` | 规则引擎纯函数：initialBoard / generateMoves / isLegalMove / applyMove / isInCheck / getGameStatus | ✅ |
| `src/engine/xiangqi/ai.ts` | Minimax + α-β（深度 2-3，子力价值表 + 位置加成）；若实现困难可推迟，不阻塞本任务验收 | ✅ |
| `tests/test-xiangqi.cjs` | 引擎单元测试 ≥50 用例（node 直跑） | ✅ |
| `tests/.tmp-xiangqi/` | tsc 编译产物目录（加入 .gitignore） | ✅ |
| `.gitignore` | 追加 `tests/.tmp-xiangqi/` | ✅ |

## 验收标准

- [x] `node tests/test-xiangqi.cjs` 全部用例通过（114 条，≥50 ✓）
- [x] 七种棋子走法全覆盖：将/帅九宫一步直行；士/仕九宫斜一步；象/相田字+不过河+塞象眼；马日字+蹩马腿；车直线任意格；炮直线移动+隔一子吃子；兵/卒过河前只进+过河后可左右
- [x] 全局约束：不送将（走完后己方将不被攻击）、飞将（将帅不同列无阻隔对面）、将军检测、将死判定、困毙判和
- [x] 红线专项反例（每条 ≥2 个）：蹩腿跳马 6 反例、塞眼飞象 2 反例、无炮架隔空吃子 3 反例、飞将 3 反例、送将 2 反例
- [x] 将死/困毙专项覆盖（各 2 个用例）
- [x] 引擎零 Vue/DOM 依赖（纯 TS，可独立编译到 CommonJS）
- [x] `npm run build` 零错误（含 noUnusedLocals）
- [x] `.tmp-xiangqi/` 已加入 .gitignore

## Review Checklist

- [x] 架构合规：引擎分层（types/rules/ai 分离）、零 Vue 依赖
- [x] 纯函数：applyMove 返回新棋盘不改原对象；generateMoves/isLegalMove 无副作用
- [x] 命名：snake_case 与项目一致；类型命名清晰（Side/PieceType/Board 等）
- [x] 测试组织：按棋子类型分组（Suite 1-19），红线反例独立用例
- [x] 编译链路：`npx tsc -p tsconfig.xiangqi.json` 编译到 `tests/.tmp-xiangqi/`，测试文件顶部自动编译
- [x] 无死代码：ai.ts 已实现（findBestMove / isGameOver），T4 接入视图

## Review 结论（2026-08-06）

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 | 0 | — |
| 🟡 P1 | 0 | — |
| 🔵 P2 | 1→0 | Suite 11 重复用例已合并（115→114） |
| ⚪ P3 | 1 | ai.ts 已实现但未接入视图，T4 立项时验证 |

**P0+P1 清零，P2 已修，P3 留 T4。T1 可提交。**

## 关键参考

- `docs/superpowers/specs/2026-08-06-xiangqi-game-prd.md` — §3.2 核心类型基线、§3.3 引擎 API、§4 规则清单 + 红线
- `AGENTS.md` — 测试约定（`node test-xxx.cjs` 直跑，无框架）
- `src/views/TicTacToeView.vue` — minimax/alpha-beta 实现先例（可参考结构，但象棋更复杂）
- `tests/` 目录下现有测试文件（如有）— 命名与结构风格

## 实现约束（Codex 必须遵守）

1. **引擎 API 严格按 PRD §3.3**：`initialBoard(): Board` / `generateMoves(board, side): Move[]` / `isLegalMove(board, from, to): boolean` / `applyMove(board, move): Board` / `isInCheck(board, side): boolean` / `getGameStatus(board, sideToMove): GameStatus`
2. **Board 坐标**：10 行 × 9 列，`board[row][col]`；红方在下（row 7-9），黑方在上（row 0-2）
3. **generateMoves 必须过滤送将**：走完后己方将/帅不得被攻击
4. **applyMove 纯函数**：返回新棋盘，不改原对象（`board.map(row => row.slice())` 深拷贝）
5. **测试编译**：`npx tsc` 把 `src/engine/xiangqi/*.ts` 编译到 `tests/.tmp-xiangqi/`（CommonJS），cjs require 编译产物
6. **测试文件命名**：`tests/test-xiangqi.cjs`，用 `node` 直跑
7. **禁止**：引擎内 import 任何 Vue / composable / store；测试文件不引入测试框架

## 修复方案（review 阶段追加）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| 1 | Codex | ✅ 引擎+测试+AI 全部完成，115 用例通过，build 零错误 | Claude review 合并 1 条重复测试（115→114） |
