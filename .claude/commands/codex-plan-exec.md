---
description: 读取 PLAN.md 的活跃任务，生成可复制给 Codex 的执行 prompt（AGENTS.md 工作流的执行步）
allowed-tools: Read
---

读取 `docs/ai-workflow/PLAN.md` 的 TASK_BODY 区，生成一段完整的 Codex 执行 prompt，输出到终端供用户复制粘贴到桌面端 Codex。

这是 AGENTS.md「多 Agent 协作工作流」的**执行步**：Claude 已写好计划 → 此命令生成 prompt → 用户复制到桌面端 Codex → Codex 执行 → 用户回来说"跑完了" → Claude review。

## 步骤 1：读取 PLAN.md

Read 文件 `docs/ai-workflow/PLAN.md`。

## 步骤 2：校验活跃任务

TASK_BODY 区 = `<!-- TEMPLATE:END -->` 标记之后的全部内容。

如果 TASK_BODY 仍是占位状态（含 `（未选择 — 等待新任务填入）` 或 `（等待新任务填入）` 或仅有空表格/空 checklist）：
- 告知用户：「PLAN.md 没有活跃任务。请先填写 TASK_BODY 区（任务目标、修改点、验收标准），再运行此命令。」
- **停止，不生成 prompt。**

## 步骤 3：提取任务内容

从 TASK_BODY 区提取：
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
2. 不要修改 PLAN.md 中 <!-- TEMPLATE:END --> 以上的模板骨架。
3. 不要修改 PLAN.md 的交接记录表——那是 Claude review 时填的。
4. 不要 commit——review 通过后由 Claude 决定 commit 时机。
</prereqs>

<verification_loop>
- 运行 npm run build 确认零错误（noUnusedLocals / noUnusedParameters 会触发 build 失败）
- 遵守 AGENTS.md 硬规则
- 更新文件修改表中的完成勾选（[ ] → [x]）
- 用一句话告诉我改了哪些文件
</verification_loop>

<grounding_rules>
- 不要引入 AGENTS.md 未提及的新依赖
- 不要新建已有 composable 的重复实现（先 grep 确认）
- 所有游戏视图必须用 GameLayout + GameDialog 框架
- 不确定的实现细节，按 AGENTS.md 共享组件注册表和 composable 注册表执行，不自行发明
</grounding_rules>
````

## 步骤 5：输出到终端

将生成的 prompt 用代码块包裹输出，方便用户复制。

输出后告知用户：
「**下一步**：将上面的 prompt 复制到桌面端 Codex，执行完后告诉我"跑完了"。我会用 `git diff` 审查产出，按 P0~P3 分级记录到 PLAN.md。」
