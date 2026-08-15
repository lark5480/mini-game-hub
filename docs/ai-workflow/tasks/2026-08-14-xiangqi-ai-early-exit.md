# 任务模式：细（micro）

> 来源：用户疑问「困难模式是否一定思考 2 秒以上才出手，搜得够深了能否提前出手」。审查确认：无强制最短时长，但中局 8 层在 4s 内到不了（实测 5 层 2.5s / 7 层 6.2s / 8 层 8.5s），迭代加深一直加层到超时 → 中局每步 ≈ 4.4s。本任务为搜索增加「提前出手」启发式：大局已定/最佳着法多轮稳定时提前终止，焦灼局面仍搜满保强度。

## 任务目标

`findBestMove` 新增可选 `earlyExit` 参数（默认开启）：① 决定性优势（根分 ≥ 900 ≈ 净多一车，完成 ≥ 4 层）提前终止；② 最佳着法连续 3 层不变且完成 ≥ 5 层、|根分| ≥ 150（排除极均势）提前终止。大劣不提前（保留翻盘深搜）。实际只作用于困难/困难提示（简单深度 2、中等深度 4 低于下限天然不触发）。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | 导出 `EarlyExitOptions`；`findBestMove` 第 8 参 `earlyExit`（`decisive?: {score,minDepth}\|null` 默认 {900,4}、`stable?: {runs,minDepth,minAbsScore?}\|null` 默认 {3,5,150}；null 关闭）；循环内跟踪 `prevBest/stableRuns`，完成每层后按序 break：杀棋 → decisive → stable；**执行调整：另导出测试专用 `resetSearchState()`（清空 TT/killer/history）**——跨调用 TT 复用会让浅层搜索命中先前深搜条目而改变冷态参照着法，测试需在每个测量前重置以获得确定性冷态对照 | [x] |
| `src/workers/xiangqi-ai.worker.ts` | search 消息解构透传 `earlyExit` | [x] |
| `src/composables/useXiangqiAI.ts` | `SearchParams` 增加可选 `earlyExit?: EarlyExitOptions` | [x] |
| `tests/test-xiangqi.cjs` | 新增 Suite 38（冻结局面 + 机制断言，无计时断言防 flaky；每个测量前 resetSearchState） | [x] |
| `docs/system_design.md` | 难度参数段补充提前出手说明 | [x] |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全绿（428/428，含 Suite 38 新增 9 条）
- [x] `npm run build` 零错误
- [x] 38.1/38.2 机制断言：decisive{极小阈值,1} 与 stable{runs:1,minDepth:1,minAbsScore:null} 均在第 1 层退出（返回 m1 而非 m3）
- [x] 38.3 默认回归：不带 earlyExit 深度 3 返回 m3；传空对象与不传一致
- [x] 38.4 真实阈值：去掉黑一车局面 decisive{400,1} 返回合法且等于 d1 结果
- [x] 既有 Suite 29/32/33 战术断言不翻转
- [x] 行为实测（默认参数）：决定性大优局面（-黑车）722ms 出手（原 4s）；均势开局主线局面 4173ms（仍搜满保强度）；随机中局 1573ms（失衡局面提前出手）
- [ ] 浏览器实测项（供用户确认）：困难对局大优时落子变快、被将杀威胁时仍想满 4s、简单/中等行为无变化

## Review Checklist
- [x] 参数语义：undefined=默认、null=关闭；minAbsScore null=无分数护栏；向后兼容（旧调用行为不变，38.3 验证）
- [x] 提前退出与 minDepth 延长不冲突（延长在 catch 超时路径，提前退出在正常完成路径）
- [x] 大劣不提前（只检查 bestScore >= 正阈值，负大分保持深搜）
- [x] 稳定性计数：bestAtDepth 提交后按 sameMove 更新 stableRuns，prevBest 初始化 null → 首层 runs=1（38.2 验证）
- [x] Worker 结构化克隆：earlyExit 为纯对象可克隆；透传顺序与引擎签名一致（worker 编译产物 12.71kB 正常）
- [x] 测试确定性：resetSearchState 清空 TT/killer/history，Suite 38 每个测量前重置，冷态对冷态无 flaky（428/428 复跑通过）
- [x] 行为边界实测：均势局面 4173ms 仍搜满（护栏 150 分生效）、大优局面 722ms 提前出手

## 关键参考
- `src/engine/xiangqi/ai.ts`：findBestMove（L658-744 附近）、MATE 常量
- `src/workers/xiangqi-ai.worker.ts`：search 消息（L15-19）
- `src/composables/useXiangqiAI.ts`：SearchParams
- `tests/test-xiangqi.cjs`：Suite 37 之后、Summary 之前
- 冻结局面（16 手谱，红方行棋）：`[[7,1,4,1],[2,7,6,7],[9,6,7,4],[6,7,3,7],[9,7,7,8],[2,1,9,1],[6,4,5,4],[3,7,6,7],[4,1,3,1],[3,2,4,2],[9,8,8,8],[3,4,4,4],[8,8,8,1],[0,2,2,0],[3,1,3,2],[3,6,4,6]]`；冷态 m1=(9,0)->(9,1)，m3=(8,1)->(1,1)

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude（实现） | 全部实现 + 执行调整（resetSearchState 测试导出，解决跨调用 TT 污染导致机制断言非确定问题）；测试 428/428、build 零错误；行为实测：大优 722ms / 均势 4173ms / 失衡中局 1573ms | 浏览器实测待用户确认（不阻塞）；P3 已登记 BACKLOG #20 |
