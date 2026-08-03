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

WhackAMoleView 接入 `useGameOver().checkGameOver()` 统一游戏结束流程：让新纪录检测、成就接近提示、统一音效生效，并清除与 useGameOver 重复的手写逻辑。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/WhackAMoleView.vue` | ① 新增 `useGameOver` 接入 ② 重写 `gameOver()` ③ 清理不再使用的 `gameStore` 声明与 import | ✅ |

## 验收标准

- [x] `npm run build` 通过（vue-tsc 无 noUnusedLocals 报错）
- [x] 游戏结束对话框：分数 > 历史最高分时显示「新纪录！」标题 + actionText「提交新纪录」（修复前永不触发）
- [x] 分数 ≥ 225 且未解锁 whack_master 时，GameDialog 显示 achievementHint（如「还差 X 分解锁⚒神速」）
- [x] 分数 ≥ 300 时成就解锁 toast「成就解锁：神速 🔨」正常弹出（行为不变）
- [x] 分数只写入一次（gameStore 数据无重复记录）
- [x] 未改动 `useGameOver.ts` / `useGameStore.ts` / 其他任何视图文件

## Review Checklist

- [x] P0 正确性：新纪录判定（`score > 0 && score > prevBest`）与 GameDialog 展示一致
- [x] P0 正确性：`gameStore` 已删除声明和 import，无残留引用（否则 build 失败）
- [x] P1 规范：未再手动调 `sound.gameOver()` / `addScore`（useGameOver 内部已处理，重复会污染数据）
- [x] P1 规范：成就 toast 块保留（useGameOver 内部 unlock 不弹 toast，需调用方弹）
- [x] P2 打磨：`gameOver()` 保持 stopAllTimers → 置位 → checkGameOver → 成就块的顺序

## 关键参考

- `src/composables/useGameOver.ts`：`checkGameOver` 行为（38-58 行）；whackamole 成就规则 threshold 300（23 行）
- `src/views/CatchFruitView.vue`：`endGame()`（195-202 行）——标准接入模式
- `src/views/SimonView.vue`：213 行——最近一次接入示例

## 实现细节（细模式专有）

**① import 区（108-122 行）**：在 `useGamePause` import 后新增一行：

```ts
import { useGameOver } from '@/composables/useGameOver'
```

**② script setup 组合式（129-137 行）**：在 `const { popups, pop } = useScoreFloats()` 后新增：

```ts
const { checkGameOver } = useGameOver()
```

**③ 重写 `gameOver()`（286-298 行）**：

改前：
```ts
function gameOver() {
  stopAllTimers()
  gameStarted.value = false
  gameOverDialog.value = true
  sound.gameOver()
  lastScore.value = score.value
  gameStore.addScore('whackamole', score.value)
  if (score.value >= 300) {
    if (achievements.unlock('whack_master')) {
      toast.show('成就解锁：神速', '🔨')
    }
  }
}
```

改后：
```ts
function gameOver() {
  stopAllTimers()
  gameStarted.value = false
  gameOverDialog.value = true
  lastScore.value = score.value
  const { isNewRecord: isNewRecordResult, achievementHint: hint } = checkGameOver('whackamole', score.value)
  newRecord.value = isNewRecordResult
  achievementHint.value = hint
  if (score.value >= 300) {
    if (achievements.unlock('whack_master')) {
      toast.show('成就解锁：神速', '🔨')
    }
  }
}
```

变更要点：
- **删除** `sound.gameOver()`（useGameOver 内部自动：新纪录 win / 否则 gameOver）
- **删除** `gameStore.addScore('whackamole', score.value)`（useGameOver 内部自动 addScore，且仅 score > 0 时写入）
- **保留** 成就 toast 块不动
- **新增** checkGameOver 调用并赋值 `newRecord` / `achievementHint`（本次核心修复）

**④ 清理残留**：删除第 129 行 `const gameStore = useGameStore()` 和第 111 行 `import { useGameStore } from '@/stores/game'`——删掉 addScore 后 gameStore 不再被使用，不删会触发 noUnusedLocals 导致 build 失败。`sound` 仍被 whack() 使用，保留。

## 修复方案（review 阶段追加）

（等待 review 后填写）

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | 计划完成（micro） | — |
| 2 | Codex（执行） | 完成，接入 useGameOver + 清理 gameStore | — |
