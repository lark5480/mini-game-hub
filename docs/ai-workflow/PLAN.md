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

# 任务模式：粗（macro）

## 任务目标

给 `src/views/SokobanView.vue`（推箱子）接通 `useGameOver`，实现新纪录检测与成就提示。推箱子是 5 关总分制，需要设计检测时机：全部通关时主检测 + 手动提交时补充检测，一局只触发一次。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/SokobanView.vue`（script） | 引入 `useGameOver`；新增 `hasCheckedThisRun` ref；`checkWin()` 内通关时调用 `checkGameOver`；`submitScore()` 内手动提交时补充检测；删除手动 `addScore`；重启时重置标志 | ✅ |

## 验收标准

- [ ] 全部通关时，若破纪录则 GameDialog 显示"新纪录！"徽章
- [ ] 手动提交分数时，若破纪录且本次游戏未检测过，也触发检测
- [ ] 同一局内不重复检测（通关时已检测，手动提交不再检测）
- [ ] 接近成就时 GameDialog 显示成就提示
- [ ] `checkWin()` 内的手动 `addScore` 已删除
- [ ] 游戏重启时检测标志重置
- [ ] `npm run build` 通过

## Review Checklist（Claude review 时逐项勾）

- [ ] `checkGameOver` 是否在通关路径调用
- [ ] `checkGameOver` 是否在手动提交路径调用（仅当 `!hasCheckedThisRun`）
- [ ] `hasCheckedThisRun` 防重复是否生效
- [ ] 手动 `addScore` 是否已删除
- [ ] 游戏重启时 `hasCheckedThisRun` 是否重置
- [ ] build 通过

## 关键参考

- `src/composables/useGameOver.ts` — 接口：`checkGameOver(gameName, score)` → `{ isNewRecord, achievementHint }`，内部处理 addScore + 音效
- `src/views/SokobanView.vue` 行 370-390 — `checkWin()` 函数（通关逻辑）
- `src/views/SokobanView.vue` 行 405+ — `submitScore()` 函数
- `src/views/SokobanView.vue` 行 235-236 — `newRecord`/`achievementHint` ref（已声明）
- `src/views/SimonView.vue` — 上次接通 useGameOver 的参考实现（commit `78b40a6`）

## 实现指引（给 Codex）

### 核心约束

1. `checkGameOver` 内部已处理 `addScore` + 音效，**调用方不重复**
2. 检测条件用 `levelIndex.value >= 4`（最后一关索引），**不是** `gameComplete.value`（它在 `nextLevel()` 内才设置为 true）
3. 手动提交路径只在 `!hasCheckedThisRun` 时检测，防重复
4. 游戏重启（`restartGame` / `newGame`）时重置 `hasCheckedThisRun = false`
5. 删除 `checkWin()` 内的 `gameStore.addScore('sokoban', totalScore.value)`；如果 `useGameStore` 不再使用，删除对应 import

### 检测逻辑伪码

```ts
// checkWin() 内，levelIndex.value >= 4 分支中
if (!hasCheckedThisRun.value) {
  const { isNewRecord, achievementHint: hint } = checkGameOver('sokoban', totalScore.value)
  newRecord.value = isNewRecord
  achievementHint.value = hint
  hasCheckedThisRun.value = true
}

// submitScore() 内
if (!hasCheckedThisRun.value) {
  const { isNewRecord, achievementHint: hint } = checkGameOver('sokoban', totalScore.value)
  newRecord.value = isNewRecord
  achievementHint.value = hint
  hasCheckedThisRun.value = true
}
```

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成，写入 PLAN.md（macro 模式） | — |
| 2 | Codex（执行） | SokobanView.vue 接通 useGameOver：双路径检测 + 去重 + 重启重置；删除手动 addScore；build 通过 | — |
