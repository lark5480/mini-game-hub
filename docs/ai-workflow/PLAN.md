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
|------|--------|------|---------|

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

给 `src/views/SimonView.vue`（记忆游戏 Simon）接入浮动分数反馈（ScoreFloat），并补齐 `useGameOver` 接通新纪录检测与成就提示。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/SimonView.vue`（script） | 引入 `useScoreFloats` + `useGameOver`；setup 解构 `{ popups, pop }` + `{ checkGameOver }`；`boardEl` ref；过关逻辑内调用 `pop()`；`gameOver()` 内 `checkGameOver` 替代手动 `addScore` | ✅ |
| `src/views/SimonView.vue`（template） | `.simon-board` 加 `ref="boardEl"`；内部末尾追加 `<ScoreFloat :popups="popups" />` | ✅ |
| `src/views/SimonView.vue`（style） | `.simon-board` 已有 `position: relative`，确认即可，无需新增 | ✅ |

不修改 `src/composables/useScoreFloats.ts` / `src/components/ScoreFloat.vue` / `src/composables/useGameOver.ts`（已有设施直接复用）。

## 验收标准

- [ ] 过关时 `.simon-board` 中心出现 `+N` 飘字（N = level），约 800ms 后消失
- [ ] 飘字不拦截点击（`pointer-events: none` 已由 ScoreFloat 保证）
- [ ] 打破个人纪录时 GameDialog 显示金色"新纪录！"徽章
- [ ] 接近成就时 GameDialog 显示成就提示
- [ ] `npm run build` 通过（`noUnusedLocals` 无报错）

## Review Checklist（Claude review 时逐项勾）

- [ ] 飘字坐标是否相对 `.simon-board`（非视口绝对坐标）
- [ ] `<ScoreFloat>` 是否为 `.simon-board` 最后一个子元素
- [ ] `checkGameOver` 是否**替换**了手动 `addScore`（非双重写入）
- [ ] `newRecord` / `achievementHint` ref 是否正确赋值
- [ ] 过关飘字文本为 `+N`（N = level），非硬编码
- [ ] build 通过、无未使用变量
- [ ] 飘字在 `.simon-board` 内渲染，不溢出视口

## 关键参考

- `src/views/WhackAMoleView.vue` — ScoreFloat 参考实现（commit `8553159` + `75dd200`）
- `src/composables/useScoreFloats.ts` — 接口：`pop(text, x, y)`，800ms 自清理
- `src/components/ScoreFloat.vue` — prop `popups`，需父容器 `position: relative`
- `src/composables/useGameOver.ts` — 接口：`checkGameOver(gameName, score)` → `{ newRecord, achievementHint }`
- `src/views/SimonView.vue` 行 184-188 — 过关逻辑（`score.value = level.value`）
- `src/views/SimonView.vue` 行 199-205 — `gameOver()` 函数
- `src/views/CatchFruitView.vue` / `TetrisView.vue` — `checkGameOver` 调用参考

## 实现细节（给 Codex 的执行指引）

### 1. 导入（setup 顶层 import 区域追加）

```ts
import { useScoreFloats } from '@/composables/useScoreFloats'
import ScoreFloat from '@/components/ScoreFloat.vue'
import { useGameOver } from '@/composables/useGameOver'
```

### 2. setup 顶层（与现有 ref 同级）

```ts
const { popups, pop } = useScoreFloats()
const { checkGameOver } = useGameOver()
const boardEl = ref<HTMLElement | null>(null)
```

### 3. 模板：`.simon-board` 加 ref + 追加 ScoreFloat

`.simon-board` 已有 `position: relative`。在内部末尾（`</div>` 闭合前）追加：

```html
<ScoreFloat :popups="popups" />
```

### 4. 过关逻辑（`score.value = level.value` 之后）

```ts
// 浮动分数反馈
const el = boardEl.value
if (el) {
  const rect = el.getBoundingClientRect()
  pop(`+${level.value}`, rect.width / 2, rect.height / 2)
}
```

> 飘字显示在棋盘**中心**（非某个特定格），因为 Simon 是序列记忆游戏，没有"命中格"概念。

### 5. `gameOver()` 函数（替换手动 addScore）

```ts
// 改前
function gameOver() {
  sound.gameOver()
  gameStore.addScore('simon', score.value)
  gameOverDialog.value = true
}

// 改后
function gameOver() {
  sound.gameOver()
  const { newRecord: isNew, hint } = checkGameOver('simon', score.value)
  newRecord.value = isNew
  achievementHint.value = hint
  gameOverDialog.value = true
}
```

> `checkGameOver` 返回值字段名以 `src/composables/useGameOver.ts` 实际导出为准。`newRecord` / `achievementHint` ref 已在 setup 顶层声明（行 102-103），直接赋值即可。

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成，写入 PLAN.md | — |
| 2 | Codex（执行） | 完成 ScoreFloat 飘字 + useGameOver 接通，build 通过 | — |
