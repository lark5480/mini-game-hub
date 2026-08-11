# 任务模式：粗（macro）

## 任务目标
中国象棋 AI 开局库：手工 UCCI 主变棋谱生成局面哈希表，AI 走子与提示在开局阶段查表直出（随机变着），未命中才进 Worker 搜索；引擎零改动、接口向后兼容，测试全回归。

## 背景与决策
- 用户确认 Worker 化（BACKLOG #13 已完成）后选择开局库方向（BACKLOG #14 部分内容）。
- 收益：开局阶段 AI 走标准套路（此前困难模式开局盲搜 4s，观感差且开局棋力弱）；开局几步零搜索延迟；easy 模式开局棋力直接提升。
- 关键决策：
  - 查表放主线程（视图层直接调 `lookupOpening`），命中无需 Worker；纯函数毫秒级。引擎 `findBestMove` 零改动。
  - 棋谱用 UCCI 坐标文本（红方视角：行 0=红底线，列 a=红最右），构建期用 `generateMoves` 自检每个着法合法，笔误立即抛错暴露（实施中实际抓到 1 处笔误：h7c7 应为 h7g7，黑炮2平3 目标写错导致后续马位被占）。
  - 表结构 `Map<bigint, Move[]>`（boardKey 含行棋方视角），同局面多着法随机选一。
  - 所有难度 + 提示按钮统一启用。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/openings.ts` | **新增**。UCCI 解析（ucciToMove）+ 8 条主变（中炮对屏风马直车/进七兵、顺炮、列炮、单提马、反宫马、仙人指路对卒底炮、飞相局）+ 构建期自检（generateMoves）+ `lookupOpening(board, side)` 随机变着查表 | ✅ |
| `src/views/XiangqiView.vue` | `scheduleAIMove` 回调与 `showHint` 各插入开局库查表分支（命中直出，保留 seq 过期校验与 aiThinking/hintThinking 重置） | ✅ |
| `tests/test-xiangqi.cjs` | **Suite 35 新增**（10 断言）：初始命中、黑方应着、主变 6 步逐步命中、主变外 null、中盘 20 步 null、随机变着 INFO | ✅ |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全通过（395 + Suite 35 新增 = **405/405**）
- [x] `npm run build`（vue-tsc + vite）零错误
- [x] 浏览器实测（Browser agent）：AI 先手四局首步均标准套路且 <500ms 零延迟（炮二平五/兵三进一/相三进五）；开局提示 0-28ms 命中（黑炮2平5/卒7进1）；离开开局库后 AI 4.7s/提示 2.1s 恢复正常 Worker 搜索；重开三局首步各不相同（随机变着）；控制台零报错
- [x] 引擎公共接口不变（`findBestMove` 签名零改动），仅新增 `openings.ts`
- [x] 文档：本任务文件；state.json 指向本任务 round 1；BACKLOG #14 更新

## Review Checklist
- [x] 架构合规：开局库独立模块（openings.ts），引擎零改动；查表在视图层（与 Worker 搜索互补，命中零延迟）
- [x] 棋谱正确性：构建期 generateMoves 自检 + Suite 35 主变逐步全链走通（双保险）；实施中自检实际拦截 1 处笔误
- [x] 竞态安全：开局库分支保留 aiSeq/hintSeq 过期校验与状态重置（与 Worker 分支一致）
- [x] 随机性：同局面多着法随机选一（实测初始局面 3 种开局），避免每局雷同
- [x] 边界：主变外局面返回 null 恢复正常搜索；开局阶段无长将/长捉场景，与 R4 历史感知无冲突

## 关键参考
- `src/engine/xiangqi/openings.ts`：UCCI 转换、LINES 主变、buildOpeningTable 自检、lookupOpening
- `src/views/XiangqiView.vue`：`scheduleAIMove`（L514-525 附近）、`showHint`（L430-441 附近）
- `tests/test-xiangqi.cjs`：Suite 35（Summary 前）

## 交接记录
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| R1 | Claude（用户批准计划后实现） | 实现完成：openings.ts（8 条主变 + 自检）+ 视图两处查表 + Suite 35；构建期自检拦截并修正 1 处棋谱笔误（h7c7→h7g7）；测试 **405/405** 通过、build 零错误；浏览器实测通过（A 零延迟落子 / B 提示零延迟命中 / C 中盘恢复正常搜索 / D 变着随机，控制台零报错） | 无 |

<!-- Review 结果写法（四级分级）：
  🔴 P0 正确性（阻塞，必须修）
  🟡 P1 规范（阻塞，必须修）
  🔵 P2 打磨（顺手修，不进 backlog）
  ⚪ P3 可选（进 backlog）
-->
