# PLAN.md — 当前任务计划

> 本文件是 Claude/Codex 协作的**动态交接文件**。路径固定不变，永远代表「当前正在进行的任务」；历史版本由 git 保留，不做手动归档。

## 本文件使用规则（Claude / Codex 都必须遵守）

- **新建任务**：Claude 直接覆盖重写本文件（保留模板结构，填充任务目标 / 修改点 / 验收标准 / review checklist）。**不要新建 PLAN-xxx.md**
- **执行阶段**：Codex 完成修改后，勾选「文件级修改点」的完成列，并在「交接记录」表追加一轮
- **Review 阶段**：Claude 的 review 结果写入本文件的「交接记录」表，并勾选下方 Review Checklist；**不新建 review.md**（review 证据 = git diff + 本文件记录，单独文件会导致状态漂移）
- **任务结束**（提交后）：把值得沉淀的规范合并进 AGENTS.md，然后清空本文件恢复为模板（或删除），供下一个任务复用
- 固定路径与「严格串行」硬规则匹配：同一时刻只有一个任务、一份 PLAN.md

## 任务目标

给 `src/views/WhackAMoleView.vue`（打地鼠）接入浮动分数反馈。该游戏目前是全部游戏里唯一没用 `useScoreFloats` 的，命中地鼠时只有分数数字跳变，没有飘字反馈，需参考 SnakeView 已成熟的实现模式补齐。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/WhackAMoleView.vue`（script） | 引入 `useScoreFloats` + `ScoreFloat`；setup 解构 `{ popups, pop }`；`boardEl` ref；`whack()` 内计算坐标并调用 `pop('+N', x, y)` | ✅ |
| `src/views/WhackAMoleView.vue`（template） | `.mole-board` 加 `ref="boardEl"`；hole 循环后追加 `<ScoreFloat :popups="popups" />` | ✅ |
| `src/views/WhackAMoleView.vue`（style） | `.mole-board` 加 `position: relative` 建立 ScoreFloat 定位上下文 | ✅ |

不修改 `src/composables/useScoreFloats.ts` / `src/components/ScoreFloat.vue`（已有设施直接复用）。

## 验收标准

- [ ] 命中地鼠时，命中格中心出现 `+N` 金色飘字，约 800ms 后消失
- [ ] 连击时飘字显示实际得分（连击 2 显示 `+15`，连击 3 显示 `+20`，依此类推）
- [ ] 飘字不拦截点击（`pointer-events: none` 已由 ScoreFloat 保证）
- [ ] 空击（点非地鼠格）不触发飘字，只重置 combo
- [ ] 切换难度（3×3 / 4×4 / 5×5）飘字仍居中显示
- [ ] `npm run build` 通过（`noUnusedLocals` 无报错）
- [ ] `popups` 满阵（快速连击）时无残留 id 泄漏

## Review Checklist（Claude review 时逐项勾）

- [ ] 逻辑正确性：`points` 与 `score.value` 实际增量一致（复用 `baseScore + comboBonus` 表达式，非硬编码）
- [ ] 坐标计算正确：用 `getBoundingClientRect()` 差值，非 `offsetX/offsetY`（后者在嵌套元素上不准）
- [ ] 符合 AGENTS.md 硬规则：复用 `useScoreFloats` + `ScoreFloat`，不新建 composable / 组件
- [ ] 模板结构符合统一框架：`GameLayout` + `GameDialog` 未改动，仅追加 `ScoreFloat`
- [ ] 无未使用变量：`popups` 仅传给 `<ScoreFloat>`、`boardEl` 仅用于坐标计算，均有引用
- [ ] 无重复 keyframes：未新增动画定义（复用 `scoreFloatUp`）
- [ ] 移动端可用：飘字渲染在 `.mole-board` 内，不溢出视口；触摸命中仍触发 pop
- [ ] 防御性检查：`boardEl.value` 和 `holeEl` 的 `&&` 守卫存在，空安全

## 关键参考

- `src/views/SnakeView.vue` 行 79 / 94 / 23 / 275-283 — 参考实现
- `src/composables/useScoreFloats.ts` — 接口：`pop(text, x, y)`，800ms 自清理
- `src/components/ScoreFloat.vue` — prop `popups`，需父容器 `position: relative`
- `src/views/WhackAMoleView.vue` 行 238-267 — `whack()` 函数，行 250 为得分点

## 实现细节（给 Codex 的执行指引）

### 1. 导入（行 107-119 区域追加）

```ts
import { useScoreFloats } from '@/composables/useScoreFloats'
import ScoreFloat from '@/components/ScoreFloat.vue'
```

### 2. setup 顶层（与 `holes`、`score` 等 ref 同级）

```ts
const { popups, pop } = useScoreFloats()
const boardEl = ref<HTMLElement | null>(null)
```

### 3. 模板：`.mole-board` 加 ref + 追加 ScoreFloat

```html
<!-- 改前 -->
<div class="mole-board" :style="{ '--grid-cols': gridCols, '--grid-rows': gridRows }">

<!-- 改后 -->
<div ref="boardEl" class="mole-board" :style="{ '--grid-cols': gridCols, '--grid-rows': gridRows }">
  ...hole 循环...
  <ScoreFloat :popups="popups" />
</div>
```

`<ScoreFloat>` 作为 `.mole-board` 的**最后一个子元素**（与 SnakeView 一致），靠 `position: absolute; inset: 0` 覆盖在棋盘上方。

### 4. `whack()` 函数（行 250 附近）

在 `score.value += baseScore + comboBonus` 之后、`sound.hit()` 之前插入：

```ts
// 浮动分数反馈
const points = baseScore + comboBonus
const el = boardEl.value
const holeEl = el?.querySelectorAll('.hole')[index] as HTMLElement | undefined
if (el && holeEl) {
  const boardRect = el.getBoundingClientRect()
  const r = holeEl.getBoundingClientRect()
  pop(`+${points}`, r.left + r.width / 2 - boardRect.left, r.top + r.height / 2 - boardRect.top)
}
```

> `points` 复用已算好的得分，不重复计算逻辑。坐标算法与 SnakeView 完全一致：`getBoundingClientRect()` 格子中心 − 棋盘左上 → 容器本地像素坐标。

### 5. 样式 `.mole-board` 加定位上下文

```css
.mole-board {
  position: relative;  /* 新增：建立 ScoreFloat 定位上下文 */
  /* 现有 display: grid / gap / ... 全部保留 */
}
```

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成，写入 PLAN.md | — |
| 2 | Codex（执行） | 完成，build 通过 | — |
| 3 | Claude（review） | ☐ | ☐ |

> 终止条件：阻塞性问题（bug / 逻辑错误 / 违反规范）清零 + 非阻塞建议进 backlog 即可提交；最多 2 轮 review，第 3 轮起人工介入。
