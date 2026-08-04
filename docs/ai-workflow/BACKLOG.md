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
| 3 | 2026-08-04 | BACKLOG 消化任务 review | PLAN.md 模板头注「Codex 执行：只改 TASK_BODY 区的勾选」表述含糊，未限定可勾选的节（应仅限「文件级修改点 / 验收标准」，Review Checklist 归 Claude），建议在模板注释中显式化 | 待处理 |
