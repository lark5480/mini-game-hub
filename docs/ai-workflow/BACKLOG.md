# BACKLOG.md — P3 可选事项积压

> Review 中 ⚪ P3（可选）事项的落地处。规则见 [AGENTS.md](../../AGENTS.md) 的「Review 四级分级标准」。

## 维护规则

- review 写出 P3 项的一方（通常是 Claude）负责同步登记到本表，不登记视为流程未完成
- 条目被顺手消化或正式立项时更新「状态」列并注明 commit / 任务，**不删除行**（保留可追溯性）
- 状态取值：`待处理` / `已完成(<commit>)` / `已放弃(原因)`
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
| 9 | 2026-08-06 | 竞速收尾轮 review | 「review 通过后才 commit」规则下，执行期无法在 BACKLOG 填 commit 哈希（提交尚未发生）；建议明确收尾约定：主提交后追加一个回填提交把任务名引用替换为哈希，或规则允许以任务名作为追溯引用 | 待处理 |
| 10 | 2026-08-10 | 象棋重复局面裁决（checkRepetitionViolation） | 不识别「杀」（一将一杀/一杀一捉等按闲着处理）；完整棋规需检测走子后形成的叫杀，判定复杂度显著上升 | 待处理 |
| 11 | 2026-08-10 | 象棋重复局面裁决（checkRepetitionViolation） | 不判长周期循环（如周期 8 互捉）；当前仅检测周期 4 半步的严格重复，更长循环不变着不会触发裁决 | 待处理 |
