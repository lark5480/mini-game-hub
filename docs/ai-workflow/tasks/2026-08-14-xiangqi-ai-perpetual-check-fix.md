# 任务模式：细（micro）

> 来源：用户反馈「AI 下到后面一个棋子连将、将不死、触发规则判负」+「棋谱无法复制」。Claude 实证复现根因：搜索内重复局面罚分 `MATE - ply` 随层数衰减，败局中比「立刻被将死」的 `-(MATE-2)` 分数还高 → AI 理性选择违规长将拖延 → 视图裁决判负。另有棋谱面板无复制功能的 UX 缺口。

## 任务目标

① 引擎重复局面罚分加强为 `2 * MATE - ply`（严格劣于任何真实将杀分），AI 永不主动走进长将/长捉判负，仅唯一合法着法时被迫走出；② 棋谱面板加「复制」按钮导出中文记谱。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | negamax 重复局面罚分重写（**执行调整：调查中发现的真实根因比计划更深**）：① 罚分 `MATE - ply` → `2*MATE - ply`；② 归属按「当前方是否被将」（被将节点罚将军方、未被将节点罚当前方）——旧实现一律归责最后走子方，根局面在历史中时前置局面先达第 3 次出现、罚分误归应将方反而奖励将军方；③ 被将局面的第 2 次重复即惩罚将军方（阻止「连将与送杀同分时排序选中连将」走满周期） | [x] |
| `src/views/XiangqiView.vue` | 两处 `notation-panel` 头部加「复制」按钮（`.notation-actions` 容器 + `copyNotation()` + 样式）；`copyText` from `@/lib/clipboard.ts`，成功/失败 toast + 成功 haptics | [x] |
| `tests/test-xiangqi.cjs` | 新增 Suite 39（4 断言）：39.1 败局违规偏好回归（修复前红）；39.2 forced 唯一合法着法边界；39.3 全流程模拟（AI 连将 + 人类脚本应着，20 手内不触发长将判负） | [x] |
| `docs/system_design.md` | 引擎段补重复局面罚分语义 | [x] |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全绿（433/433，含 Suite 39 新增 4 条）
- [x] `npm run build` 零错误
- [x] 实证构造局面修复后翻转：AI 不再走满长将周期（39.1 单元断言 + 39.3 全流程模拟均验证）
- [x] Suite 33（历史感知不选长将）/ 29.6（长将规避）/ 38（提前出手）不翻转
- [x] TT 杀棋分校正阈值 |score| ≥ MATE - MAX_PLY 自动覆盖双倍分
- [ ] 浏览器实测：AI 残局不再主动长将判负；棋谱复制按钮可用（含 execCommand 降级路径）

## Review Checklist
- [x] 罚分只改重复局面检测块；quiescence MAX_PLY 守卫与真实将死分数保持 MATE 不变
- [x] 双倍分与 findBestMove 杀棋早停（<= -(MATE-1000)）兼容
- [x] 被将局面的第 2 次重复提前惩罚：杀棋场景无冲突（同一局面既是第 2 次重复又是将死意味着首次出现时已终局，不可达）
- [x] forced 边界：rootMoves.length===1 提前返回，唯一合法长将仍走出（39.2 验证单着法路径）
- [x] 复制按钮：本地/人机两处一致；空棋谱禁用；copyText 失败有 toast；黑方阿拉伯数字由 toNotation 保证
- [x] 全流程模拟对 historyKeys 窗口与视图 recentHistoryKeys 一致（32 半步）

## 关键参考
- `src/engine/xiangqi/ai.ts`：negamax 重复局面罚分（约 L545-570）、ttScoreToPly/FromPly、findBestMove 杀棋早停
- `src/views/XiangqiView.vue`：notation-panel（L87-106 / L206-225）、notationList computed、useToast
- `src/lib/clipboard.ts`：copyText
- `tests/test-xiangqi.cjs`：Suite 33（历史感知长将规避，L1256-1303）
- 实证构造（Suite 39 冻结用）：base 棋子 = 红帅(9,3)/红仕(8,3)/红车(0,0)；黑将(1,4)/黑卒(2,4)/黑车(8,5)/黑车(5,4)/黑马(7,1)；P0=车(0,0)将(1,4)红行棋；P1=车(1,0)将(1,4)黑行棋；P2=车(1,0)将(0,4)红行棋；P3=车(0,0)将(0,4)黑行棋；historyKeys=[boardKey(P0,'red'),boardKey(P1,'black'),boardKey(P2,'red'),boardKey(P3,'black')]；长将着法=(0,0)->(1,0)（黑一步杀 R(8,5)->(9,5)# 威胁下，修复前 AI 选长将）

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude（实现） | 全部实现 + 执行调整（根因调查发现归属判定错误与同分排序漏洞，罚分方案从「仅加大」调整为「2×MATE + 按被将归属 + 第 2 次重复提前惩罚」）；测试 433/433、build 零错误；全流程模拟验证不再触发长将判负 | 浏览器实测待用户确认（不阻塞） |
