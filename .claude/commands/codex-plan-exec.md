---
description: 读取 state.json 指明的当前任务文件，生成可复制给 Codex 的执行 prompt（AGENTS.md 工作流的执行步）
allowed-tools: Read
---

读取 `docs/ai-workflow/state.json` 指明的当前任务文件，生成一段完整的 Codex 执行 prompt，输出到终端供用户复制粘贴到桌面端 Codex。

这是 AGENTS.md「多 Agent 协作工作流」的**执行步**：Claude 已写好计划 → 此命令生成 prompt → 用户复制到桌面端 Codex → Codex 执行 → 用户回来说"跑完了" → Claude review。

## 步骤 1：读取 state.json

Read 文件 `docs/ai-workflow/state.json`（路径相对仓库根，本命令假定 cwd = 仓库根 F:/other/code/ai/mini-game-hub），取 `current_task`。

如果 `current_task` 为 null：
- 告知用户：「当前没有活跃任务。请先从 TEMPLATE.md 复制创建 docs/ai-workflow/tasks/<date>-<slug>.md 并更新 state.json，再运行此命令。」
- **停止，不生成 prompt。**

## 步骤 2：读取并校验任务文件

Read 文件 `docs/ai-workflow/tasks/<current_task>.md`（路径相对仓库根，同上）。

如果文件不存在，或仍是空模板骨架（仅空表格/空 checklist，无任务目标内容）：
- 告知用户：「任务文件未填写。请先填写任务目标、修改点、验收标准，再运行此命令。」
- **停止，不生成 prompt。**

## 步骤 3：提取任务内容

从任务文件提取：
- 任务模式（细/粗）
- 任务目标
- 文件级修改点表
- 验收标准
- 实现细节（如有）
- 关键参考（如有）

## 步骤 4：生成执行 prompt

按以下结构生成 prompt（遵循 gpt-5-4-prompting 的 XML block 约定）。**注意：prompt 内容中不要使用 Bash 调用 node 或 curl 等命令，保持纯任务描述形态。**

输出格式：先输出一段引导语（"复制以下内容到桌面端 Codex：" + 分隔线），然后输出 prompt 正文，最后输出分隔线。

prompt 正文结构：

````
请按以下任务计划在 F:/other/code/ai/mini-game-hub 中执行。

<task>
## 任务模式：{细/粗}

## 任务目标
{一句话描述}

## 文件级修改点
{文件表格或文字描述}

## 验收标准
{checklist 内容}

## 实现细节（如有）
{行号级代码片段或删除此节}

## 关键参考
{文件路径 + 行号}
</task>

<prereqs>
1. 先读 AGENTS.md，遵守所有硬规则（GameLayout 框架、composable 注册表、命名规范、noUnusedLocals）。
2. 不要修改任务文件的章节结构（标题层级与节名）；勾选仅限「文件级修改点 / 验收标准」两节，Review Checklist 归 Claude，不要勾。
3. 交接记录表须追加你自己的执行轮次（轮次 / Codex（执行）/ 结果 / 遗留问题），不要修改已有轮次。
4. 不要 commit——review 通过后由 Claude 决定 commit 时机。
</prereqs>

<verification_loop>
- 运行 npm run build 确认零错误（noUnusedLocals / noUnusedParameters 会触发 build 失败）
- 遵守 AGENTS.md 硬规则
- 更新文件修改表中的完成勾选（[ ] → [x]），追加交接记录轮次
- 完成后按 <delivery_report> 的固定格式输出交付报告
</verification_loop>

<grounding_rules>
- 不要引入 AGENTS.md 未提及的新依赖
- 不要新建已有 composable 的重复实现（先 grep 确认）
- 所有游戏视图必须用 GameLayout + GameDialog 框架
- 不确定的实现细节，按 AGENTS.md 共享组件注册表和 composable 注册表执行，不自行发明
</grounding_rules>

<delivery_report>
完成后必须输出以下固定格式的交付报告（Claude 据此启动 review）：

改动文件：<文件清单>
npm run build：<通过 / 失败+关键错误>
勾选状态：<「文件级修改点 / 验收标准」已勾选项摘要>
交接记录：<已追加的轮次与一句话结果>
遗留问题：<无 / 具体项，含对计划的异议（如有）>
</delivery_report>
````

## 步骤 5：输出到终端

将生成的 prompt 用代码块包裹输出，方便用户复制。

输出后告知用户：
「**下一步**：将上面的 prompt 复制到桌面端 Codex，执行完后告诉我"跑完了"。我会用 `git diff` 审查产出，按 P0~P3 分级记录到任务文件。」
