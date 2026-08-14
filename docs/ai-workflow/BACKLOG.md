# BACKLOG.md — P3 可选事项积压

> Review 中 ⚪ P3（可选）事项的落地处。规则见 [AGENTS.md](../../AGENTS.md) 的「Review 四级分级标准」。

## 维护规则

- review 写出 P3 项的一方（通常是 Claude）负责同步登记到本表，不登记视为流程未完成
- 条目被顺手消化或正式立项时更新「状态」列并注明 commit / 任务，**不删除行**（保留可追溯性）
- 收尾约定：执行期无法预知 commit 哈希，状态列允许以**任务名**作追溯引用（如 `已完成(2026-08-10-xxx)`）；主提交后若已获哈希可回填替换，非强制
- 状态取值：`待处理` / `已完成(<commit>|<任务名>)` / `已放弃(原因)`
- 🔵 P2（打磨）不进本表，由 Codex 顺手修

## 积压清单

| # | 登记日期 | 来源 | 描述 | 状态 |
|---|---------|------|------|------|
| 1 | 2026-08-03 | WhackAMole 飘字 review（`aaa292c`） | `src/views/WhackAMoleView.vue` 中 `<ScoreFloat :popups='popups' />` 使用单引号，与项目统一双引号不一致 | 已完成(bdc008e) |
| 2 | 2026-08-03 | WhackAMole 飘字 review（`aaa292c`） | `src/views/WhackAMoleView.vue` 的 `@media (max-width: 640px)` 内 `.mole-board` 重复声明 `position: relative`（基类已声明），可删 | 已完成(bdc008e) |
| 3 | 2026-08-04 | BACKLOG 消化任务 review | PLAN.md 模板头注「Codex 执行：只改 TASK_BODY 区的勾选」表述含糊，未限定可勾选的节（应仅限「文件级修改点 / 验收标准」，Review Checklist 归 Claude），建议在模板注释中显式化 | 已完成(cfee3ed) |
| 4 | 2026-08-04 | 打地鼠联机竞速 review（909cfed） | `copyText` 函数跨组件重复（WhackAMoleRaceView / TicTacToeOnlineView），建议抽到 `@/lib/clipboard.ts` | 已完成(afd317b) |
| 5 | 2026-08-04 | 打地鼠联机竞速 review（909cfed） | 倒计时同步依赖网络 RTT，当前 ±1s 容忍度满足；后续可带时间戳同步（composable 内记录 startTimestamp，双方对齐） | 待处理 |
| 6 | 2026-08-04 | 打地鼠竞速独立复审 | 竞速 UX 遗留两条：客人开局前看不到房主所选难度；结算后房主离开时客人等待界面缺少明确提示 | 已完成(0107c18) |
| 7 | 2026-08-04 | 竞速修复轮 P2 明确跳过（留痕） | 观战者（第三人）进房仍见空闲棋盘与「等待房主开始…」横幅，应短路游戏区（P2 按新纪律跳过须可追溯，下次触碰打地鼠时带上） | 已完成(0107c18) |
| 8 | 2026-08-06 | 流程迁移独立 review（`78b192b..cff244e`） | `docs/ai-workflow/state.json` 的 `current_task` 取值格式（= 任务文件名去 `.md`，即 `<date>-<slug>`）建议在 state.json 或 TEMPLATE 显式给示例，降低新人误填概率 | 已完成(AGENTS.md 已注明格式示例) |
| 9 | 2026-08-06 | 竞速收尾轮 review | 「review 通过后才 commit」规则下，执行期无法在 BACKLOG 填 commit 哈希（提交尚未发生）；建议明确收尾约定：主提交后追加一个回填提交把任务名引用替换为哈希，或规则允许以任务名作为追溯引用 | 已完成(2026-08-10 维护规则已显式化：状态列允许任务名引用，提交后可回填哈希；#12 已按此实践) |
| 10 | 2026-08-10 | 象棋重复局面裁决（checkRepetitionViolation） | 不识别「杀」（一将一杀/一杀一捉等按闲着处理）；完整棋规需检测走子后形成的叫杀，判定复杂度显著上升 | 已完成(2026-08-11-xiangqi-repetition-rules：新增 isMateThreat 杀判定（对方所有应着后我方都有将死/困毙着法，1 层搜索低频路径），一将一杀/长杀判罚；遗留边界：将>杀>捉混合优先级未实现（双方混合双打判和）、捉沿用简化定义) |
| 11 | 2026-08-10 | 象棋重复局面裁决（checkRepetitionViolation） | 不判长周期循环（如周期 8 互捉）；当前仅检测周期 4 半步的严格重复，更长循环不变着不会触发裁决 | 已完成(2026-08-11-xiangqi-repetition-rules：周期扫描泛化为 4..32 偶数半步，取最小成立周期，周期 8 互捉等长循环可判罚；视图 AI 历史窗口联动扩展到 32 半步) |
| 12 | 2026-08-10 | 象棋 AI 加强 review（ai-enhancement） | AI 不感知重复局面裁决：对人局 AI 自身可能长捉/长将触发判负；搜索内无 repetition avoidance（可对最近局面哈希做避让或判和剪枝） | 已完成(2026-08-10-xiangqi-ai-strength-boost，negamax 路径 repPath 检测，重复 >=2 次给 -(MATE/2-ply) 强负分；2026-08-10-xiangqi-search-optimization R4 补充：repPath 已并入对局历史 key（findBestMove 第 5 参数 historyKeys，视图 6 分支传最近 8 半步），覆盖“根着法撞历史第 3 次重复”盲区，并修复拦截符号反转 bug（判罚对象为上一步走子者，原实现使 AI 反而偏好长将）) |
| 13 | 2026-08-10 | 象棋 AI 加强 review（ai-enhancement） | 困难模式同步搜索阻塞主线程 ≤1.8s（提示按钮 ≤1.2s），思考动画依赖合成器线程；后续可 Web Worker 化（延续 ai-mode 任务的 P3 预判）。2026-08-10 更新：R3 实测热态 d6 4.1s 是陡坡，2500ms 时限也只到 ~5.7 层；要上 6+ 层必须 Worker（主线程阻塞 4s+ 不可接受） | 已完成(2026-08-11-xiangqi-ai-worker：Worker 化 + hard 时限 4000ms ~6 层 + 取消保留 TT；实测中发现并修复 Vue Proxy 无法结构化克隆的 P0——toPlainBoard 深拷贝) |
| 14 | 2026-08-10 | 象棋 AI 加强 review（ai-enhancement） | 置换表/killer-history 启发与机动性/王安全评估项已实现（2026-08-10-xiangqi-ai-strength-boost）；剩余：开局库、王翼兵形细化、车半开放线等更多评估项，棋力上限仍受评估质量约束 | 已完成(开局库 2026-08-11-xiangqi-opening-book：7 条 UCCI 主变查表直出 + 构建期自检 + 随机变着，全难度与提示统一启用；评估项 2026-08-11-xiangqi-eval-structure：车半开放线/全开放线、连兵/孤兵/叠兵、王翼兵保护，单遍扫描零额外开销，权重 < 1 兵) |
| 15 | 2026-08-10 | 搜索热路径优化 review（2026-08-10-xiangqi-search-optimization） | 叶子机动性评估每节点 2 次全量 generateMoves，本次明确跳过（收益风险不划算，已复用一次生成）；后续可做降权/采样 | 已完成(2026-08-10-xiangqi-search-optimization R2：机动性评估**整体移除**（非采样），评估回归子力+PST，深度收益补回；恢复需先评估每叶子 2 次全量 generateMoves 的成本) |
| 16 | 2026-08-10 | 搜索提速计划（2026-08-10-xiangqi-search-optimization R2） | make/unmake 增量走子替代 copy-on-write（行级拷贝已省 80% 分配，仍有每节点数组分配与 GC）；需棋盘增量更新重构，架构级、正确性风险高，暂不立项 | 待处理 |
| 17 | 2026-08-14 | 象棋 AI 修复 review（2026-08-14-xiangqi-ai-fix） | 搜索内重复局面裁决与视图裁决语义不一致：negamax 把局面第 3 次出现一律判最后走子方负（±MATE），视图对双方闲着循环判和 → AI 在可循环求和局面误判必胜且主动避和；完整对齐需搜索内做将/杀/捉分类（成本高），暂维持现状 | 待处理 |
| 18 | 2026-08-14 | 象棋 AI 修复 review（2026-08-14-xiangqi-ai-fix） | 简单模式也吃开局库理论着法，对纯新手偏强；可选：简单模式禁用开局库或仅前 2 手命中 | 待处理 |
| 19 | 2026-08-14 | 象棋 AI 修复 review（2026-08-14-xiangqi-ai-fix） | 评估恢复王安全/机动性可再提升困难上限（R2 因热路径性能移除：每叶子 2 次全量 generateMoves）；恢复需先做成本评估或采用 isSquareAttacked 九宫轻量扫描方案 | 待处理 |
