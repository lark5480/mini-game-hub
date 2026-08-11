# 任务：中国象棋 AI 搜索热路径优化（isInCheck 轻量化 + 增量 Zobrist + 根 PVS）

> 模式：**粗（macro）** —— 引擎热路径性能优化 + 视图难度参数 + 测试覆盖。
> 日期：2026-08-10
> 背景：上轮 AI 强度加强（`12bee83`）后引擎已含 TT(Zobrist)/killer/history/LMR/空着剪枝/将军延伸，但搜索热路径存在三个瓶颈：`negamax`/`quiescence` 每节点 + LMR 每候选着法调用 `rules.isInCheck`（全盘扫描 + 敌方每子生成伪走法，比引擎内已有轻量版 `isSquareAttacked` 慢一个数量级）；`boardKey` 每节点 O(90) 全盘扫描；根节点对每着法全窗口搜索。本次在公共接口不变的前提下消除瓶颈，困难模式同等时限可搜更深；顺带处理 TT 杀棋分 ply 失真、history 分表、TT 删半清理、medium 深度。
> 约定：任务文件创建即登记，state.json 的 `current_task` 指向本文件 `<date>-<slug>`（去 `.md`）。

---

## 任务目标

- **P0** isInCheck 轻量化：`isInCheckLight`（findKing + isSquareAttacked）替换 3 处调用，语义与 `rules.isInCheck` 等价（等价断言兜底）
- **P1** 增量 Zobrist：`nextKey` O(1) 更新，`negamax` 传 key 参数（递归/LMR/空着剪枝/根循环）
- **P1** 根节点 PVS：首着全窗口、其余着法零窗口试探，突破 alpha 才重搜
- **P2** TT 杀棋分 ply 校正（`ttScoreToPly`/`ttScoreFromPly`）+ history 红黑分表
- **P3** medium 深度 4→5（让 1800ms 时限真正生效）+ TT 超阈值删半清理（保新弃旧，避免长对局瞬时抖动）
- 公共接口 `findBestMove` / `isGameOver` 签名不变；`rules.ts` 零改动

## 约束（明确不改什么）

- **不动规则引擎**：`rules.ts` / `types.ts` / `notation.ts` 一律不改（`rules.isInCheck` 保留供规则层使用）
- **公共签名兼容**：`findBestMove(board, side, depth = 3, timeLimitMs?)` 不变
- **纯引擎层**：`ai.ts` 零 Vue/DOM 依赖；不引入新依赖；沿用 `tests/*.cjs` 测试机制
- 视图层仅改 medium 深度参数（两处），不改难度语义与时限

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | 新增 `isInCheckLight`（export 测试用）替换 3 处 `isInCheck`（quiescence 入口 / negamax 入口 / LMR 分支），import 移除 `isInCheck`；`boardKey` export + 新增 `nextKey`（export 测试用），`negamax` 签名追加 `key: bigint`（递归/LMR 用 `nextKey` 增量、空着剪枝棋盘未变传同 key、根循环增量）；`findBestMove` 根循环改 PVS（首着全窗口、其余 `(-alpha-1, -alpha)` 零窗口、`score > alpha` 重搜全窗口）；TT 存取做杀棋分 ply 校正（`|score| >= MATE - MAX_PLY` 边界）；history 红黑分表 `Int32Array(2 * 8100)`（`histIndex` 带 side，attacker.side 可得）；TT 超 500000 删半清理（Map 迭代删偶数位保新弃旧） | [x] |
| `src/views/XiangqiView.vue` | medium 深度 4→5 两处（`scheduleAIMove` 1800ms + `showHint` 1200ms，时限保留，注释同步） | [x] |
| `tests/test-xiangqi.cjs` | 新增 Suite 30：`isInCheckLight` 与 `rules.isInCheck` 语义等价（初始/飞将/车将/马将/炮将/卒将/长将局面，红黑双方各断言，14 条）；Suite 31：`nextKey` 增量与 `boardKey` 全量一致（开局 5 步着法序列 + 吃子场景，7 条） | [x] |

## 验收标准

- [x] `node tests/test-xiangqi.cjs` 全部通过：**381/381**（原 360 + 新增 21）
- [x] `npm run build`（vue-tsc + vite）零错误
- [x] 公共接口签名不变；视图层仅 medium 深度 4→5（两处）
- [x] 浏览器实测困难模式无回归（2026-08-11 用户确认）
- [ ] 提速量化（节点数/耗时对比）：未做独立基准（无旧版对照数据；设计上三处改动均只减节点/开销，不增）

## 明确不做（登记 P3 / BACKLOG）

- Web Worker 化（#13）、开局库/更多评估项（#14）——维持原判
- 叶子机动性采样——本次明确跳过（收益风险不划算，已复用一次生成），登记 BACKLOG #15
- LMR R 调整（`depth-2` 试搜相对正常 `depth-1` 已是标准 R=1 语义）、TT 完整分代清理（删半替代）、`rules.ts` 修改

## 风险与兜底（计划原文，执行结果对照）

- isInCheck 语义等价：士/象攻击范围到不了对方九宫王位、飞将已含于 `isSquareAttacked` 列向扫描 —— **已由 Suite 30 断言兜底**（7 局面 × 2 方全部一致）
- 增量 key 与全量 `boardKey` 一致 —— **已由 Suite 31 断言兜底**（序列 5 步 + 吃子全部一致）
- PVS 零窗口边界：fail-soft 标准 `score > alpha` 重搜；根 beta=+Infinity 无 fail-high —— **29.1-29.6 战术断言全部通过**（一步杀/长将规避/贪吃陷阱无回归）
- TT ply 校正仅在 `|score| >= MATE - MAX_PLY`（999960）转换 —— **一步杀断言通过（29.3）**

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R1 | Claude（用户批准计划后实现） | 实现完成：ai.ts（isInCheckLight / nextKey 增量 / 根 PVS / TT ply 校正 / history 分表 / TT 删半）+ 视图 medium 深度 5（两处）+ Suite 30/31；测试 **381/381** 通过、build 零错误 | 提速量化未做（不阻塞） |

---

## R2 追加：搜索提速（方向 A，用户实测困难不够强后立项）

> 背景：用户实测困难模式不难。诊断：深度 8 仅是迭代加深上限，冷态 d4 就要 5.3s、热态 d6 9.2s、d7 44s——1.8s 时限内困难实际只搜 3-4 层，与中等（d5）几乎无差别。

### R2 文件级修改点（src/engine/xiangqi/ai.ts）

| 修改 | 完成 |
|------|:----:|
| `applyMoveForAI` 行级拷贝：只复制受影响行，其余行共享引用（board 永不 mutate，只读共享安全），省约 80% 数组分配 | [x] |
| `MAX_QUIESCENCE_DEPTH` 12→8（4 整步吃子链，业界常规；长链 stand-pat 兜底） | [x] |
| `tickTimeout` 检查间隔 1024→4096（Date.now() 频率降 4 倍） | [x] |
| **评估简化（计划外追加，实测驱动）**：移除机动性（叶子 2 次全量 generateMoves）与王安全（每评估 2 次 findKing 扫描，与 isInCheckLight 重复计算）——计划内三项实测无效（d4 仍 5.5s），追加此项后才达标；评估回归子力 + PST | [x] |

### R2 验收标准

- [x] `node tests/test-xiangqi.cjs` 381/381 通过（战术断言 29.1-29.6 覆盖行级拷贝与评估简化无回归）
- [x] `npm run build` 零错误
- [x] 性能实测（与诊断基线同局面同方法）：冷态 d4 **2162ms**（基线 5343ms，提速 2.5 倍）；热态 d5 **900ms**（基线 2397ms）；冷态 d8+1800ms 超时 2047ms（实际 ~3.8 层）；实战 TT 热后困难实际深度 ~4 → **~5.5 层**，medium/hard 均受益
- [x] 公共接口 `findBestMove` / `isGameOver` 签名不变；难度参数未动（提速后梯度仍待评估，见遗留）
- [x] 浏览器实测困难模式变强（2026-08-11 用户确认）

### R2 明确不做 / 变更登记

- 机动性降权/采样（原 BACKLOG #15）：机动性评估**整体移除**（非采样），#15 状态更新为已完成并注明恢复需先评估成本
- make/unmake 增量走子（undo/redo 重构）：架构级、正确性风险高，登记 BACKLOG #16
- 只生成吃子走法的 capture generation：需动 rules.ts，违背约束，未做
- 难度梯度重构（medium/hard 实际深度仍接近 5/5.5）：遗留，评估 B（Worker 放宽时限）/C（开局库）方向后决定

### R2 风险与兜底（执行结果对照）

- 行级拷贝：同行走子分支单独处理；381 回归 + Suite 31 增量 key 断言兜底 —— **无回归**
- quiescence 收紧 + 评估简化：战术断言（一步杀/悬子/陷阱/长将规避）全过 —— **无回归**
- 评估简化棋力影响：机动性（步差×4）与王安全（被将 -60）移除后评估=子力+PST，深度收益（4→5.5 层）补回有余 —— **实测达标**

### R2 交接记录

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R2 | Claude（用户批准计划后实现） | 实现完成：行级拷贝 + quiescence 8 + tick 4096 + 评估简化；测试 381/381、build 零错误、性能达标（d4 冷态 2.5 倍提速）；计划内三项实测无效后追加评估简化，已在验收如实记录 | 难度梯度仍偏小（5/5.5 层），下一步候选 B（Worker）/C（开局库） |

---

## R2.1 P0 修复：浏览器实测崩溃（killers is undefined）

> 用户浏览器困难模式实测捕获：`TypeError: can't access property 0, killers is undefined`，栈 `moveOrderScore → orderMoves → quiescence ×30+ → negamax → findBestMove`（ai.ts 368/377/437/440）。

### 根因（存量缺陷，R2 前同样存在，实战长链首次暴露）

- quiescence 被将时**不受 qdepth 限制**（`qdepth <= 0` 仅在不被将分支检查，被将必须搜索应将着法）→ 极端互将/互吃链无界延伸
- ply 超过 `MAX_PLY=40` 后 `killerMoves[ply]` 定长数组越界为 undefined → `moveOrderScore` 访问 `killers[0]` 崩溃

### 修复（三处防御，src/engine/xiangqi/ai.ts）

| 修改 | 完成 |
|------|:----:|
| quiescence 入口 `if (ply >= MAX_PLY) return -(MATE - ply)`：深链截断，按被杀处理（罕见兜底，正常路径不受影响） | [x] |
| moveOrderScore killer 读取防御：`ply < MAX_PLY ? killerMoves[ply] : null`，空则跳过 killer 加分 | [x] |
| beta 剪枝 killer 写入防御：`ply < MAX_PLY` 才写 killer（history 不受 ply 限制，照常） | [x] |

### R2.1 验收

- [x] `node tests/test-xiangqi.cjs` **387/387**（新增 Suite 32 六条：互将残局 d8 / d8+1800ms / 开局 d8+1800ms，断言不崩且着法合法）；build 零错误
- [x] 浏览器困难模式复测无崩溃（2026-08-11 用户确认）
- 说明：Suite 32 互将残局链长不足以精确复现 40+ 层越界（构造成本高），防御为硬保证（任何局面 ply 达上限即截断），真实场景由浏览器复测确认

---

## R3 追加：难度参数分级（用户实测后立项，数据驱动定参）

> 背景：困难实测仍不够强（commit 后用户问 Worker/开局库哪个值得做——结论：都不是最优先，先做零成本的难度参数分级）。实测发现关键事实：medium/hard 共用 1.8s 时限，而热态 d5 只要 0.7s（medium 时限富余一半）、热态 d6 要 4.1s（陡坡，hard 放宽到 2500ms 也只到 ~5.7 层）→ 有效杠杆是降 medium 而非升 hard。

### R3 实测数据（同局面 TT 递进变热，tests/.tmp-xiangqi-diff.cjs 跑完即删）

| 测试 | 耗时 | 解读 |
|---|---:|---|
| d4 冷态 | 728ms | 开局基准 |
| d5 热态 | 716ms | 中盘基准（medium 原 1.8s 富余一半） |
| d6 热态 | 4090ms | d5→d6 分支陡坡 |
| d8+2500ms | 2600ms 超时 | ~5.7 层（d6 未完成） |
| d8+1800ms | 1991ms 超时 | ~5.5 层（对照） |

### R3 参数变更（src/views/XiangqiView.vue 两处）

| 配置 | 改前 | 改后 | 实际层数 |
|------|------|------|---------|
| medium AI 走子 | d5 + 1800ms | **d4 + 1200ms** | 中盘 ~4 层（开局 0.7s 内完成 d4） |
| medium 提示 | d5 + 1200ms | **d4 + 1200ms** | 同 AI |
| hard AI 走子 | d8 + 1800ms | **d8 + 2500ms** | ~5.5 → ~5.7 层 |
| hard 提示 | d8 + 1200ms | 不变（响应优先） | —— |

梯度：5 vs 5.5 层（几乎无差）→ **4 vs 5.7 层**（差 ~1.7 层，体感明显）。medium 副作用：响应变快（1.8s→1.2s）。

### R3 验收

- [x] 测试 387/387、build 零错误（视图参数改动，引擎零改动）
- [x] 浏览器实测：中等明显变弱/变快、困难微强（2026-08-11 用户确认）

### R3 遗留

- hard 再放宽（>2500ms）边际收益极低（d6 陡坡 4.1s），要上 6+ 层必须 Web Worker 化（BACKLOG #13，主线程阻塞 4s+ 不可接受）——若用户实测后仍觉不够，立项 #13
- 开局库（#14）仍可作为中等模式开局观感补强，独立可选

---

## R4 追加：AI 长将历史感知（用户实测困难模式 AI 连将判负后立项）

> 背景：用户实测困难模式 AI（先手）用同一棋子连将，触发 `checkRepetitionViolation` 长将判负，用户自动获胜。

### 根因（两条叠加，第二条为计划外发现）

1. **搜索路径盲区**：`negamax` 重复规避只查 `repPath`（本次搜索路径，从当前局面开始，`findBestMove` 内 `const repPath = [rootKey]`），**不含对局历史**。规则判罚长将要求同一局面第 3 次出现且间隔恰为周期 4（至少 9 个半步视距），AI 实际深度 4-5.7 层看不到；“根着法把局面带回历史第 3 次重复”的场景在搜索路径内不可见 → AI 走出长将。
2. **拦截符号反转（计划外，实测暴露）**：`negamax` 入口检测到 `key` 在 repPath 中已出现 2 次时返回当前 side 视角**负分**，但当前节点 key 是「上一步走子者」走出的局面——判罚对象是上一步走子者（= 当前 side 的对方，长将方）→ 父节点取负后根视角变为**强正分** → AI **反而偏好**长将线。此前从未暴露：29.6 深度 4 时拦截在第 5 步才触发，其 PASS 实为“吃炮净赚评估更高”驱动；用户困难模式 d8 深度 ≥5 时触发拦截 → AI 主动连将。**这才是用户复现的核心机制**，历史感知修复同时修复符号后共同生效。

### R4 文件级修改点

| 修改 | 完成 |
|------|:----:|
| `src/engine/xiangqi/ai.ts`：`findBestMove` 追加可选第 5 参数 `historyKeys?: bigint[]`（向后兼容）；`repPath = historyKeys && historyKeys.length > 0 ? [...historyKeys, rootKey] : [rootKey]`——根着法后新局面若与历史重复 ≥2 次（规则的第 3 次出现）→ 搜索第一步即给强负分 | [x] |
| `src/engine/xiangqi/ai.ts`：`negamax` 重复拦截符号修复 `-(MATE/2 - ply)` → `+(MATE/2 - ply)`（判罚对象为上一步走子者，当前 side 视角应为正分；注释同步说明） | [x] |
| `src/views/XiangqiView.vue`：新增 `recentHistoryKeys()` helper（最近 8 个半步局面 key，`positions[k]` 行棋方 k 偶红先，覆盖 `checkRepetitionViolation` 的 last-8/last-4 窗口）；`showHint` 与 `scheduleAIMove` 全部 6 个分支（easy/medium/hard × 提示/AI）追加第 5 参数——长将判负是规则正确性，与难度无关 | [x] |
| `tests/test-xiangqi.cjs`：Suite 33（4 断言）：封将路局面（红兵 (0,1) 挡车路断吃子线、黑炮 (0,3)(0,5) 封避将横路、红帅 (9,3) 移出 col4 避飞将）+ 手工 8 半步历史（A 局面在 p1/p5 出现 2 次）；不传历史 d4 返回长将（复现盲区），传历史不返回长将且着法合法 | [x] |

### R4 验收

- [x] `node tests/test-xiangqi.cjs` **391/391**（Suite 33 新增 4 条；29.6 等既有断言无回归——29.6 深度 4 不触发拦截，仍由吃炮评估驱动，行为不变）
- [x] `npm run build` 零错误（vue-tsc + vite）
- [x] 公共接口向后兼容：`findBestMove` 第 5 参数可选，无破坏性签名变化
- [x] 浏览器实测：AI 长将判负消失（困难模式复测，2026-08-11 用户确认）

### R4 风险与兜底（执行结果对照）

- 保守规避：历史中重复 ≥2 次但规则不判罚（间隔非周期 4）的局面 AI 也避开——安全方向（宁可不走不判负），可接受
- repPath 变长性能影响可忽略（+8 上限，每节点 O(24) 扫描）；历史 key 转换只在根调用一次
- 空着剪枝（enableRep=false）不受影响；TT 命中路径在重复检测之后，不绕过 —— **Suite 32 深搜索回归通过**
- 符号修复对互将残局影响：走子方视角改为正分 → 根视角负 → AI 规避互将循环 —— **Suite 32 互将残局 d8 回归通过**

### R4 交接记录

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R4 | Claude（用户批准计划后实现） | 实现完成：historyKeys 并入 repPath + 拦截符号反转修复（计划外实测暴露，29.6 从未覆盖拦截路径）+ 视图 6 分支传参 + Suite 33；测试 **391/391**、build 零错误 | 无 |
