# PLAN.md — 当前任务计划

> 本文件是 Claude/Codex 协作的**动态交接文件**。路径固定不变，永远代表「当前正在进行的任务」；历史版本由 git 保留，不做手动归档。

## 本文件使用规则（Claude / Codex 都必须遵守）

- **新建任务**：Claude 直接覆盖重写本文件（保留模板结构，填充任务目标 / 修改点 / 验收标准 / review checklist）。**不要新建 PLAN-xxx.md**
- **执行阶段**：Codex 完成修改后，勾选「文件级修改点」的完成列，并在「交接记录」表追加一轮
- **Review 阶段**：Claude 的 review 结果写入本文件的「交接记录」表，并勾选下方 Review Checklist；**不新建 review.md**（review 证据 = git diff + 本文件记录，单独文件会导致状态漂移）
- **任务结束**（提交后）：把值得沉淀的规范合并进 AGENTS.md，然后清空本文件恢复为模板（或删除），供下一个任务复用
- 固定路径与「严格串行」硬规则匹配：同一时刻只有一个任务、一份 PLAN.md

## 任务目标

（一句话描述本次要解决的问题）

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/XxxView.vue` | ... | ☐ |
| `src/composables/Xxx.ts` | ... | ☐ |

## 验收标准

- [ ] 标准 1（可运行、可测试的具体描述）
- [ ] 标准 2
- [ ] `npm run build` 通过（noUnusedLocals 无报错）

## Review Checklist（Claude review 时逐项勾）

- [ ] 逻辑正确性：边界用例覆盖（分数边界 / 关卡边界 / 空输入）
- [ ] 符合 AGENTS.md 硬规则：统一框架、composable 复用、样式约定
- [ ] Canvas 游戏 rAF 已清理 / 事件监听已解绑（onUnmounted）
- [ ] 移动端：safe-area 内边距、触摸交互、44px 触摸区
- [ ] 无未使用变量 / 无重复 keyframes 定义

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成 | — |
| 2 | Codex（执行） | ☐ | ☐ |
| 3 | Claude（review） | ☐ | ☐ |

> 终止条件：阻塞性问题（bug / 逻辑错误 / 违反规范）清零 + 非阻塞建议进 backlog 即可提交；最多 2 轮 review，第 3 轮起人工介入。
