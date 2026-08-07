# 任务模式：细（micro）

选择依据：≤100 行改动、AI 引擎已就绪（ai.ts）、参考 TTT classic 模式结构，精确到行号级指令。

## 任务目标

为中国象棋添加人机对战模式：玩家可选红方（先手）或黑方（AI 先手），AI 使用现有 `findBestMove` 引擎，难度两档（简单 depth=2 / 困难 depth=3）。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/XiangqiView.vue` | 模式选择屏加"单人挑战 AI"卡；新增 `ai` 模式分支；AI 自动走子循环；难度选择 UI | ☑ |
| `src/views/XiangqiView.vue` | 玩家选黑方时，首步由 AI 执行（红先规则） | ☑ |

## 验收标准

- [x] 模式选择屏出现三张卡：本地双人 / 单人挑战 AI / 联机对战
- [x] 选"单人挑战 AI"进入人机模式，出现难度选择（简单/困难，默认困难）
- [x] 玩家可选执红（先手）或执黑（AI 先手）
- [x] 玩家执红时：玩家走子 → AI 自动回应（300-500ms 延迟模拟思考）
- [x] 玩家执黑时：AI 先走第一步红方棋 → 玩家回应
- [x] AI 走子后正确切换回合，将军/将死/困毙判定正常
- [x] 悔棋在人机模式下可用（撤销玩家 + AI 各一步，回到玩家回合）
- [x] 认输/重启按钮功能正常
- [x] 人机模式不可暂停（canPause 排除 ai 模式）
- [x] `npm run build` 零错误

## 实现细节（行号级）

### 1. 模式选择屏新增 AI 卡

在 `XiangqiView.vue` 的 mode-panel 中，联机卡之后追加：

```html
<button class="mode-card" @click="startAI">
  <span class="mode-name">单人挑战 AI</span>
  <span class="mode-desc">与电脑对战</span>
</button>
```

### 2. 新增状态变量

在 `mode = ref<GameMode | null>(...)` 附近：

```typescript
type GameMode = 'local' | 'online' | 'ai'
type AISide = 'red' | 'black'  // AI 执哪一方（玩家选另一方）
type Difficulty = 'easy' | 'hard'

const aiSide = ref<AISide>('black')  // 默认玩家执红先手
const difficulty = ref<Difficulty>('hard')
const aiThinking = ref(false)  // AI 是否正在思考（用于暂停判断）
```

### 3. 难度选择 UI

进入 `ai` 模式后，棋盘上方或模式选择后显示难度 toggle（照抄 TTT 风格）：

```html
<div v-if="mode === 'ai'" class="ai-settings">
  <span class="ai-label">难度</span>
  <button class="diff-btn" :class="{ active: difficulty === 'easy' }" @click="difficulty = 'easy'">简单</button>
  <button class="diff-btn" :class="{ active: difficulty === 'hard' }" @click="difficulty = 'hard'">困难</button>
  <span class="ai-divider">|</span>
  <span class="ai-label">执子</span>
  <button class="diff-btn" :class="{ active: aiSide === 'black' }" @click="aiSide = 'black'">我执红（先手）</button>
  <button class="diff-btn" :class="{ active: aiSide === 'red' }" @click="aiSide = 'red'">我执黑（后手）</button>
</div>
```

**注意**：难度/执子选择应在**对局开始前**（类似 TTT 模式选择后进入）。一旦开始，本局不可更改。

### 4. 导入 AI 引擎

在现有 import 区域追加：

```typescript
import { findBestMove } from '@/engine/xiangqi/ai'
```

### 5. AI 自动走子函数

在 `executeMove` 之后追加：

```typescript
let aiTimer: ReturnType<typeof setTimeout> | null = null

function scheduleAIMove() {
  if (mode.value !== 'ai') return
  if (gameOver.value) return
  // 轮到 AI 走子
  if (currentSide.value === aiSide.value) {
    aiThinking.value = true
    aiTimer = setTimeout(() => {
      const depth = difficulty.value === 'easy' ? 2 : 3
      const move = findBestMove(board.value, aiSide.value, depth)
      aiThinking.value = false
      if (move) {
        executeMove(move.from, move.to)
      }
    }, 400)
  }
}
```

### 6. 修改 executeMove

在 `checkGameState()` 之后追加一行：

```typescript
scheduleAIMove()
```

### 7. 玩家选黑方时的首步 AI

在 `startAI()` 函数中，如果 `aiSide === 'red'`，开局就调度 AI：

```typescript
function startAI() {
  mode.value = 'ai'
  resetGame()
  // 如果 AI 执红，首步由 AI 走
  if (aiSide.value === 'red') {
    scheduleAIMove()
  }
}
```

### 8. 悔棋处理

修改 `undoMove()`：人机模式下应撤销两步（AI 一步 + 玩家一步），确保回到玩家回合：

```typescript
function undoMove() {
  if (history.value.length === 0 || gameOver.value) return
  // 人机模式：撤销 AI 一步 + 玩家一步
  const stepsToUndo = mode.value === 'ai' ? 2 : 1
  for (let i = 0; i < stepsToUndo && history.value.length > 0; i++) {
    const prev = history.value.pop()!
    board.value = prev.board
    currentSide.value = prev.side
    lastMove.value = prev.lastMove
    moveCount.value = Math.max(0, moveCount.value - 1)
  }
  clearSelection()
  aiThinking.value = false
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
  sound.select()
  haptics.light()
}
```

### 9. 暂停处理

修改 `useGamePause` 的 `canPause`：

```typescript
canPause: () => mode.value !== 'online' && mode.value !== 'ai' && !gameOver.value && result.value === null,
```

**注意**：人机模式是否可暂停？TTT 设计是 AI 思考时不可暂停。但象棋 AI 计算快（depth=3 约 100-300ms），暂停意义不大。建议：**人机模式不可暂停**（简单实现）。

如果需要暂停，加 `onPause` 清理 `aiTimer`。

### 10. 清理 AI 定时器

在 `resetGame()` 开头追加：

```typescript
if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }
aiThinking.value = false
```

### 11. turnLabel 适配

修改 `turnLabel` computed，人机模式显示"AI 思考中..."：

```typescript
const turnLabel = computed(() => {
  if (gameOver.value) { /* 原有逻辑 */ }
  if (mode.value === 'ai' && aiThinking.value) return 'AI 思考中...'
  if (mode.value === 'ai') {
    return currentSide.value === aiSide.value ? 'AI 回合' : '你的回合'
  }
  return currentSide.value === 'red' ? '红方走子' : '黑方走子'
})
```

### 12. handleTap 适配

在 `handleTap` 开头追加 AI 模式守卫：

```typescript
if (gameOver.value || mode.value !== 'local' && mode.value !== 'ai') return
// AI 思考中禁止玩家操作
if (mode.value === 'ai' && (aiThinking.value || currentSide.value === aiSide.value)) return
```

## 关键参考

- `src/views/TicTacToeView.vue` — AI classic 模式完整实现（lines 155-280, 428-460）
- `src/engine/xiangqi/ai.ts` — `findBestMove(board, side, depth)` 已就绪
- `src/views/XiangqiView.vue` — 当前本地双人模式在其上扩展
- `AGENTS.md` — 游戏开发约定

## 注意事项

- `findBestMove` 是同步函数，用 `setTimeout` 包装模拟思考延迟
- AI depth=3 在中局可能耗时 200-500ms，不会阻塞 UI（若未来变深，改用 Web Worker）
- 悔棋撤销两步时需确保 history 长度足够（开局首步 AI 走子后 history 只有 1 条，此时悔棋应只撤销 1 条）
- 模式切换时（local ↔ ai）需清理 aiTimer

## Review 结论（2026-08-07）

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 | 0 | — |
| 🟡 P1 | 0 | — |
| 🔵 P2 | 1 | 文件末尾游离代码块（layoutEntrance 重复定义）需清理 |
| ⚪ P2 | 1 | template 根节点 GameLayout 起始标签缩进丢失（风格） |
| ⚪ P3 | 1 | startAIGame/resetGame gameStarted 状态管理可集中化 |

**P0+P1 清零，P2 建议修（游离代码必须清，缩进顺手），P3 进 BACKLOG。**

## 修复方案（review 阶段追加）

### 必须修（P2）
- 删除 `XiangqiView.vue` 末尾 5 行游离代码（第 796-800 行的 `const layoutEntrance = computed(...)` 重复定义）

### 顺手修（P2 风格）
- 修复 `<template>` 内 `<GameLayout` 起始标签缩进（加 2 空格）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------:|
| R1 | Codex（执行） | 完成全部 12 项实现细节 + 验收标准 10/10 通过 | 游离代码块 + 模板缩进需清理 |
