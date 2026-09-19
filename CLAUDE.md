# CLAUDE.md

本项目的完整规范唯一事实源是 [AGENTS.md](./AGENTS.md)。**改任何代码前先读 AGENTS.md**，其中包含：游戏开发约定、完整模板、共享组件/composable 注册表、Supabase 排行榜、变更纪律、成就系统。

本文件不维护重复规则（避免两份文档漂移），只列绝不变化的红线。

## 红线（绝不变化）

- 所有游戏视图统一用 `GameLayout` + `GameDialog` + `DirectionPad` 框架，不各写一套
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败
- `@keyframes` 只放 `src/styles/animations.css`；`src/` 下不得有 `.js` 编译产物——两条均由 `npm run lint:conventions` 拦截

## 变更纪律

- 大改前先写意图、审查按严重度（🔴/🟡/🔵/⚪）、🔴/🟡 未清零不提交——见 [AGENTS.md](./AGENTS.md)「变更纪律」（工具无关，单/多 agent 均适用，不再绑定 Claude+Codex 接力流程）
- 可选积压见 `docs/ai-workflow/BACKLOG.md`，踩坑根因见 `docs/ai-workflow/knowledge.md`（历史过程不单独留档，靠 git + tests + system_design 追溯）
