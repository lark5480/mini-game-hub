# 任务模式：细（micro）

选择依据：≤50 行改动、纯 Canvas 渲染层修改、无引擎变更，精确到行号级指令。

## 任务目标

将军时被将军方的将/帅加红色呼吸环动画（opacity 0.3→0.8 循环），让玩家一眼识别将军状态。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/components/XiangqiBoard.vue` | 新增 `checkHighlight` prop；render 循环绘制呼吸环 | ☐ |
| `src/views/XiangqiView.vue` | 传入 `checkHighlight` prop（基于 `isInCheck`） | ☐ |
| `src/views/XiangqiOnlineView.vue` | 传入 `checkHighlight` prop | ☐ |

## 验收标准

- [ ] 被将军时，将/帅外圈显示红色呼吸环（opacity 0.3→0.8 循环，周期约 1.5 秒）
- [ ] 呼吸环动画平滑，不卡顿
- [ ] 未被将军时无呼吸环
- [ ] 将军解除后呼吸环立即消失
- [ ] 本地双人 + 人机 + 联机模式均生效
- [ ] `npm run build` 零错误

## 实现细节（行号级）

### 1. XiangqiBoard.vue — 新增 prop

在现有 props 中追加：

```typescript
const props = withDefaults(defineProps<{
  board: Board
  selected: Position | null
  legalTargets: Position[]
  interactive: boolean
  lastMove: Move | null
  flipped?: boolean
  checkSide?: Side | null  // 被将军的一方，null 表示无将军
}>(), {
  flipped: false,
  checkSide: null,
})
```

### 2. XiangqiBoard.vue — 新增呼吸环绘制函数

在 `drawHighlights` 函数之后追加：

```typescript
// 将军呼吸环：红色光环 opacity 循环（0.3→0.8），周期 1.5s
let checkPulsePhase = 0
let checkPulseLastTime = 0

function drawCheckPulse(ctx: CanvasRenderingContext2D, timestamp: number) {
  if (!props.checkSide) return
  
  // 更新相位（周期 1500ms）
  if (checkPulseLastTime === 0) checkPulseLastTime = timestamp
  const elapsed = timestamp - checkPulseLastTime
  checkPulsePhase = (elapsed % 1500) / 1500  // 0→1
  checkPulseLastTime = timestamp
  
  // 计算 opacity：0.3 → 0.8 → 0.3（正弦曲线）
  const opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(checkPulsePhase * Math.PI * 2 - Math.PI / 2))
  
  // 找到被将军方的将/帅位置
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = props.board[r][c]
      if (piece && piece.type === 'king' && piece.side === props.checkSide) {
        const { x, y } = getCellCenter(viewRow(r), viewCol(c))
        const radius = cellSize * 0.48
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 50, 50, ${opacity})`
        ctx.lineWidth = 4
        ctx.stroke()
      }
    }
  }
}
```

### 3. XiangqiBoard.vue — 修改 render 函数

在 `render()` 函数中，`drawHighlights(ctx)` 之后追加：

```typescript
drawCheckPulse(ctx, performance.now())
```

### 4. XiangqiView.vue — 计算 checkSide 并传入

在 `checkGameState()` 函数中，已有 `isInCheck` 调用。新增 computed：

```typescript
const checkSide = computed<Side | null>(() => {
  if (gameOver.value) return null
  if (isInCheck(board.value, currentSide.value)) return currentSide.value
  return null
})
```

模板中 XiangqiBoard 组件传入：

```html
<XiangqiBoard
  :board="board"
  :selected="selected"
  :legalTargets="legalTargets"
  :interactive="!gameOver && !isCheckmate"
  :lastMove="lastMove"
  :check-side="checkSide"
  @tap="handleTap"
/>
```

### 5. XiangqiOnlineView.vue — 传入 checkSide

同样新增 computed 并传入（逻辑同上，基于 `currentTurn`）。

## 关键参考

- `src/components/XiangqiBoard.vue` — 当前渲染逻辑（drawHighlights, render）
- `src/engine/xiangqi/rules.ts:259` — `isInCheck(board, side)` API
- `src/views/XiangqiView.vue:273` — 当前 `checkGameState` 已调用 `isInCheck`

## 注意事项

- 呼吸环用 `performance.now()` 驱动，不依赖 Vue 响应式（避免频繁重渲染）
- `checkPulsePhase` 用模块级变量保持连续性
- 只在 `checkSide` 非空时绘制，无开销
- 动画周期 1.5s 是经验值，太长会显得迟钝，太快会刺眼

## Review 结论（2026-08-07）

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 | 0 | — |
| 🟡 P1 | 0 | — |
| 🔵 P2 | 0 | — |
| ⚪ P3 | 0 | — |

**P0~P2 清零。实现与计划完全一致。**

## 修复方案（review 阶段追加）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R1 | Codex（执行） | 呼吸环完整实现，build 零错误，303/303 测试通过 | 无 |
