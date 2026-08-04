# PLAN.md — 当前任务计划

> 本文件是 Claude/Codex 协作的**动态交接文件**。路径固定不变，永远代表「当前正在进行的任务」；历史版本由 git 保留，不做手动归档。

<!-- TEMPLATE:START -->
<!-- ═══════════════════════════════════════════════════════════════════════
  模板骨架 — 永远保留，不删除。
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Claude 新建任务：复制下方结构 → 填入 TASK_BODY 区                    │
  │ Codex 执行：      只改 TASK_BODY 区的勾选和交接记录                  │
  │ Claude review：   只改 TASK_BODY 区的 checklist、修复方案、交接记录   │
  │ 任务提交后：      清空 TASK_BODY 区（保留标题占位），TEMPLATE 不动     │
  └─────────────────────────────────────────────────────────────────────┘
  动态区只覆盖「任务模式」到文件末尾，TEMPLATE:START ~ TEMPLATE:END 之间不动。
  ═══════════════════════════════════════════════════════════════════════ -->

<!--
# 任务模式：细（micro）
  — 或 —
# 任务模式：粗（macro）

  选择依据：
  - 细（micro）：≤ 50 行改动、bug 修复、单文件修改 → 给行号级指令 + 改前/改后代码
  - 粗（macro）：新游戏、多文件重构、架构级变更 → 只给约束和参考，Codex 自主实现
-->

## 任务目标
<!-- 一句话描述要做什么 -->

## 文件级修改点
<!-- 细模式：表格形式 | 粗模式：文字描述改哪些模块、不改哪些 -->
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|

## 验收标准
<!-- 可逐条勾选，review 时对照 -->
- [ ] ...

## Review Checklist
<!-- 细模式偏正确性（逻辑/空安全/build）| 粗模式偏架构合规（分层/复用/命名）-->
- [ ] ...

## 关键参考
<!-- 给 Codex 的关键文件 + 行号 -->

<!-- 细模式专有：实现细节（行号级代码片段）-->
## 实现细节（细模式专有，粗模式可删除此节）

<!-- review 阶段追加：修复方案 -->
## 修复方案（review 阶段追加，粗模式可改为「执行调整」）

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|

<!-- Review 结果写法（四级分级）：
  🔴 P0 正确性（阻塞，必须修）
  🟡 P1 规范（阻塞，必须修）
  🔵 P2 打磨（顺手修，不进 backlog）
  ⚪ P3 可选（进 backlog）
-->

<!-- TEMPLATE:END -->

---

# 任务模式：细（micro）

## 任务目标

消化 `docs/ai-workflow/BACKLOG.md` 的两条存量事项（均在 `src/views/WhackAMoleView.vue`，纯风格/CSS 改动、零逻辑风险），并回填 backlog 状态。本轮同时是新 backlog 消费流程的首次实战。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/WhackAMoleView.vue` | 行 46：`ScoreFloat` 的 prop 单引号 → 双引号 | ☐ |
| `src/views/WhackAMoleView.vue` | 行 564：删媒体查询内 `.mole-board` 的冗余 `position: relative;` | ☐ |
| `docs/ai-workflow/BACKLOG.md` | 条目 1、2 状态改「已完成」并注明 commit 哈希 | ☐ |

## 验收标准

- [ ] 行 46 变为 `<ScoreFloat :popups="popups" />`
- [ ] `@media (max-width: 640px)` 内 `.mole-board` 只保留 `gap: 10px; padding: 14px;`，无 `position` 声明
- [ ] 基类 `.mole-board`（行 372-373）的 `position: relative` 保留（ScoreFloat 的定位锚点，勿动）
- [ ] 无其他改动（不顺手格式化无关代码）
- [ ] `npm run build` 通过
- [ ] BACKLOG.md 条目 1、2 标注完成并注明 commit

## Review Checklist

- [ ] diff 仅三处：单双引号 1 行、CSS 删除 1 行、BACKLOG 状态 2 行
- [ ] ScoreFloat 挂载位置未被误动（仍是 `.mole-board` 最后一个子元素，行 46）
- [ ] 未顺带改动其他引号风格
- [ ] build 通过

## 关键参考

- `src/views/WhackAMoleView.vue:46` — ScoreFloat 引用处（改动点 1）
- `src/views/WhackAMoleView.vue:372-378` — `.mole-board` 基类声明，`position: relative` 在行 373（勿动）
- `src/views/WhackAMoleView.vue:562-572` — 待清理的媒体查询（改动点 2）
- `docs/ai-workflow/BACKLOG.md` — 条目 1、2

## 实现细节

### 改动点 1：单引号 → 双引号（行 46）

改前：

```html
      <ScoreFloat :popups='popups' />
```

改后：

```html
      <ScoreFloat :popups="popups" />
```

### 改动点 2：删除冗余 CSS 声明（行 563-567）

改前：

```css
  .mole-board {
  position: relative;
    gap: 10px;
    padding: 14px;
  }
```

改后：

```css
  .mole-board {
    gap: 10px;
    padding: 14px;
  }
```

原因：基类（行 373）已声明 `position: relative`，媒体查询内重复声明不产生任何效果。

### 提交方式（分两个 commit）

1. 两处代码改动完成、`npm run build` 通过后提交，建议消息：`style(whackamole): 消化 backlog 两条 — 引号风格与冗余 CSS`
2. 再将 BACKLOG.md 条目 1、2 状态更新为 `已完成(<上一条 commit 哈希>)`，单独提交，建议消息：`docs: BACKLOG 回填 — whackamole 两条消化完毕`

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | micro 计划完成，写入 PLAN.md | — |
