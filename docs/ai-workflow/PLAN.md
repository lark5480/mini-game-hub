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

- [x] 逻辑正确性：`points = baseScore + comboBonus` 与 `score.value +=` 完全一致，非硬编码 ✅
- [x] 坐标计算正确：`getBoundingClientRect()` 差值，与 SnakeView 一致 ✅
- [x] 符合 AGENTS.md 硬规则：复用 `useScoreFloats` + `ScoreFloat`，未新建 composable / 组件 ✅
- [x] 模板结构：<ScoreFloat> 已移至 .mole-board 内部最后一个子元素，与 SnakeView 一致 ✅
- [x] 无未使用变量：`popups` 传给 `<ScoreFloat>`、`boardEl` 用于坐标计算，均有引用 ✅
- [x] 无重复 keyframes：未新增动画定义（复用 `scoreFloatUp`）✅
- [x] 移动端可用：飘字在 `.mole-board` 内渲染，不溢出视口；触摸命中触发 pop ✅
- [x] 防御性检查：`el && holeEl` 守卫存在，空安全 ✅

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

## 修复方案（Codex 需处理）

### 🔴 阻塞问题：`<ScoreFloat>` 挂载位置错误

**现象**：diff 显示 `<ScoreFloat :popups='popups' />` 位于 `.mole-board` 闭合标签**之后**（第 48 行附近），作为兄弟元素挂载。

**后果**：`ScoreFloat.vue` 的 `.score-floats` 使用 `position: absolute; inset: 0`，会寻找最近的 `position` 非 `static` 的祖先作为定位参考。当前结构下定位祖先不是 `.mole-board`，导致：
- 飘字坐标原点偏移（JS 计算的是相对 `.mole-board` 的坐标，但渲染时参考系不同）
- 飘字整体向下偏移一个 `.mole-board` 高度 + gap 距离

**修复**：
- **文件**：`src/views/WhackAMoleView.vue`
- **位置**：模板第 47-48 行附近
- **改法**：把 `<ScoreFloat :popups="popups" />` 从 `.mole-board` 外部移入内部，作为其**最后一个子元素**（`</div>` 闭合标签之前），与 SnakeView 的实现完全一致

```html
<!-- 改前（错误） -->
<div ref="boardEl" class="mole-board" :style="...">
  ...hole 循环...
</div>
<ScoreFloat :popups="popups" />

<!-- 改后（正确） -->
<div ref="boardEl" class="mole-board" :style="...">
  ...hole 循环...
  <ScoreFloat :popups="popups" />
</div>
```

### ⚪ 非阻塞建议（backlog，不阻塞提交）

1. **引号风格**：`<ScoreFloat :popups='popups' />` 使用单 quotes，项目其他位置统一用双 quotes。非必须，可顺手改。
2. **媒体查询冗余**：`@media (max-width: 640px) { .mole-board { position: relative; ... } }` 重复声明了 `position: relative`，基类已声明，媒体查询内可省略。

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成，写入 PLAN.md | — |
| 2 | Codex（执行） | 完成，build 通过 | ScoreFloat 挂载位置错误 |
| 3 | Claude（review） | **B 档：有阻塞问题** | 需修复 ScoreFloat 位置 |
| 4 | Codex（修复） | 完成，ScoreFloat 移入 .mole-board 内部 | — |
| 5 | Claude（二次 review） | **A 档：无阻塞问题** ✅ | 非阻塞建议进 backlog |

> 终止条件已满足：阻塞性问题清零 + 非阻塞建议进 backlog → **可提交**。

### 非阻塞建议（backlog，后续可选处理）

1. **引号风格**：`<ScoreFloat :popups='popups' />` 使用单引号，项目其他位置统一用双引号。
2. **媒体查询冗余**：`@media (max-width: 640px) { .mole-board { position: relative; ... } }` 重复声明了 `position: relative`，基类已声明，媒体查询内可省略。
