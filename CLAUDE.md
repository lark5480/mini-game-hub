# CLAUDE.md

本项目的完整规范唯一事实源是 [AGENTS.md](./AGENTS.md)。**改任何代码前先读 AGENTS.md**，其中包含：游戏开发约定、完整模板、共享组件/composable 注册表、Supabase 排行榜、多 Agent 协作工作流、成就系统。

本文件不维护重复规则（避免两份文档漂移），只列绝不变化的红线。

## 红线（绝不变化）

- 所有游戏视图统一用 `GameLayout` + `GameDialog` + `DirectionPad` 框架，不各写一套
- TS 启用了 `noUnusedLocals` / `noUnusedParameters`，未使用变量会导致 `npm run build` 失败

## 多 Agent 协作

- 协作工作流（Claude 计划 → Codex 执行 → Claude review）与交接机制见 AGENTS.md「多 Agent 协作工作流」小节
- 当前任务计划见 `docs/ai-workflow/tasks/`（当前任务由 `docs/ai-workflow/state.json` 指明）
