# 任务模式：细（micro）

选择依据：≤50 行改动、成就接入 + 棋谱数据落 localStorage + 音效核对，精确到行号级指令。

## 任务目标

象棋游戏收尾：成就系统接入（2-3 个成就）、棋谱数据落 localStorage（为回放二期准备）、音效震动最终核对。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/stores/achievements.ts` | ACHIEVEMENTS 数组追加 2-3 个象棋成就 | ✅ |
| `src/views/XiangqiView.vue` | 本地对局结束时触发成就解锁 + toast | ✅ |
| `src/views/XiangqiOnlineView.vue` | 联机对局结束时触发成就解锁 + toast | ✅ |
| `src/views/XiangqiView.vue` | 棋谱数据（moves 数组）落 localStorage | ✅ |

## 验收标准

- [x] `npm run build` 零错误
- [x] 成就「象棋新手」：首次完成本地对局（胜/负/和均可）→ 解锁
- [x] 成就「象棋胜利」：首次赢得本地对局 → 解锁
- [x] 成就「联机先锋」：首次赢得联机对局 → 解锁
- [x] 成就解锁时 toast 显示
- [x] 每步走法追加到 localStorage `xiangqi_record`（JSON: { moves, sides, timestamp }）
- [x] 对局结束时更新 localStorage；新对局开始时空数组

## 实现细节（行号级）

### 1. achievements.ts 追加成就

在 `ACHIEVEMENTS` 数组末尾（`id: 'whack_master'` 之后、`id: 'first_submit'` 之前）追加：

```ts
{ id: 'xiangqi_first_game', name: '象棋新手', icon: '♟️', desc: '完成首次象棋对局' },
{ id: 'xiangqi_first_win', name: '象棋胜利', icon: '🏆', desc: '首次赢得象棋对局' },
{ id: 'xiangqi_online_win', name: '联机先锋', icon: '🌐', desc: '首次赢得联机对局' },
```

### 2. XiangqiView.vue 成就触发 + 棋谱存储

**2a. 导入**（在现有 import 区域加）：
```ts
import { useAchievements } from '@/stores/achievements.ts'
```

**2b. setup 中声明**：
```ts
const achievements = useAchievements()
```

**2c. 新增 ref**（记录棋谱）：
```ts
const gameRecord = ref<{ moves: Move[]; sides: Side[] }>({ moves: [], sides: [] })
```

**2d. executeMove 函数中**（`board.value = applyMove(board.value, move)` 之后）追加棋谱记录：
```ts
gameRecord.value.moves.push(move)
gameRecord.value.sides.push(currentSide.value === 'red' ? 'black' : 'red')  // 已切回合，记录上一步的 side
localStorage.setItem('xiangqi_record', JSON.stringify({ ...gameRecord.value, timestamp: Date.now() }))
```

**2e. checkGameState 函数中**（`gameOverDialog.value = true` 之前）追加成就触发：
```ts
// 成就：首次完成对局
if (achievements.unlock('xiangqi_first_game')) {
  toast.show('成就解锁：象棋新手 ♟️', '🏆')
}
// 成就：首次胜利（result.value === 'red-win' 或 'black-win' 且当前玩家是胜方）
if (result.value === 'red-win' || result.value === 'black-win') {
  if (achievements.unlock('xiangqi_first_win')) {
    toast.show('成就解锁：象棋胜利 🏆', '🏆')
  }
}
```

**2f. resetGame 函数开头**重置棋谱：
```ts
gameRecord.value = { moves: [], sides: [] }
```

### 3. XiangqiOnlineView.vue 成就触发

**3a. 导入**：
```ts
import { useAchievements } from '@/stores/achievements.ts'
```

**3b. setup 中声明**：
```ts
const achievements = useAchievements()
```

**3c. checkGame 函数中**（`gameOverDialog.value = true` 之前）追加：
```ts
if (result.value === 'win') {
  if (achievements.unlock('xiangqi_online_win')) {
    toast.show('成就解锁：联机先锋 🌐', '🏆')
  }
}
```

## 关键参考

- `src/stores/achievements.ts` — ACHIEVEMENTS 数组 + unlock() API（内部自动音效+震动，调用方只需加 toast）
- `src/views/TicTacToeView.vue` — 成就触发先例（`achievements.unlock('xxx')` + `toast.show(...)`）
- `src/composables/useSound.ts` — 已有 select/hit/win/miss/unlock 预设（T2/T3 已用，无需新增）
- `AGENTS.md` — 成就系统操作流程

## 注意事项

- `achievements.unlock()` 内部自动触发 `sound.unlock()` + `haptics.success()`，调用方只需加 `toast.show()`
- 棋谱数据仅落 localStorage，不做回放 UI（二期）
- `Date.now()` 在组件 setup 中可用（非 workflow 脚本）
- 成就 id 命名 snake_case，与现有一致

## 修复方案（review 阶段追加）

### T5 Round 2 修复（2026-08-07，Review 后）

| 级别 | 问题 | 修复 |
|------|------|------|
| 🔴 P0 | 成就解锁在 if/else 外，第一步就触发 | 移入 checkmate/stalemate 块内部 |
| 🔴 P0 | sides 记录反了（记录了对方） | `sides.push(currentSide.value)` |
| 🔵 P2 | icon `'♟️ '` 尾部空格 | → `'♟️'` |
| 🔵 P2 | toast 消息尾部空格 | 清除 |

## Review 结论（2026-08-07，两轮）

| 轮次 | 🔴 P0 | 🟡 P1 | 🔵 P2 | ⚪ P3 |
|------|-------|-------|-------|-------|
| Round 1 | 2 | 0 | 2 | 0 |
| Round 2 | 0 ✅ | 0 | 0 ✅ | 0 |

**P0+P1 清零，P2 已修。T5 可提交。**

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R1 | Codex | 3 成就写入 achievements.ts；XiangqiView 成就触发+棋谱 localStorage+resetGame 重置；XiangqiOnlineView 联机胜利成就触发 | 无 |
| R2 | Codex | P0-1 成就代码移入分支内；P0-2 sides 修正；P2 icon 尾部空格清除 | 无 |
