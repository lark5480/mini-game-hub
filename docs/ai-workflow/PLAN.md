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

修复打地鼠联机竞速独立复审发现的 🔴 P0×1 + 🟡 P1×3，顺手修 🔵 P2×3。背景：问题存在于已提交的 `909cfed`/`93b1290`（旧流程"先 commit 后 review"的遗留），经双方确认按**修复前进**处置，不走 revert。本任务按新规则执行：**Codex 只写文件不 commit**，Claude 复审未提交 diff，清零后由 Codex 一次性 commit。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/WhackAMoleView.vue` | 重启按钮仅单人模式绑定（P0-1） | ☐ |
| `src/views/WhackAMoleRaceView.vue` | 倒计时可取消（P1-1）；开始防重入守卫（P1-2）；再来一局双向确认（P1-3）；满员分支 + 离开横幅文案（P2） | ☐ |
| `src/composables/useRaceRoom.ts` | game 标签入参化（P2）；play-again 确认/拒绝消息；删未消费 payload | ☐ |
| `docs/ai-workflow/BACKLOG.md` | P3 条目 6 已由 Claude 登记，无需改 | — |

## 实现细节

### P0-1 竞速模式隐藏重启按钮（WhackAMoleView.vue）

GameLayout 依据 `$attrs.onRestart` 有无渲染重启按钮（`GameLayout.vue:10`）。把 WhackAMoleView 模板里无条件的 `@restart="onRestart"` 改为仅单人模式绑定（动态 `v-on`），并删除 `onRestart`（L225-228）的 race 分支——该分支纯本地重置，会造成双端失同步且本端永不结算。效果：竞速模式顶栏只剩返回/静音，单人模式不变。

### P1-1 倒计时计时器可取消（WhackAMoleRaceView.vue L174-193）

`runCountdown` 的递归 setTimeout 未保存 id、无清理。保存挂起的 timer id，`resetForNextRound()` 与新增的 `onUnmounted` 中清除并复位 `countdown`。保证倒计时中重置/离开页面后，残余计时器不会把棋盘重新开局。

### P1-2 开始流程防重入（WhackAMoleRaceView.vue L138、L168）

`onHostStart` 开头加 `if (phase.value !== 'idle') return`；客人侧 `onStartCountdown` 回调同样仅在 `phase === 'idle'` 时执行 `runCountdown`（对局中再收到 start 一律忽略）。

### P1-3 再来一局双向确认（useRaceRoom + RaceView）

现状与验收标准（房主发起 → 客人确认 → 新局）不符：客人侧无确认、无提示、不自动开局。消息协议扩展：

- 房主：`requestPlayAgain()` 广播 `'play-again'`（**删除 payload 里未消费的 difficulty**），本地进入等待态，UI 显示「等待对方确认…」
- 客人：收到 `'play-again'` → 显示确认 UI（接受/拒绝）；接受 → 发 `'play-again-accept'`，随后 `resetForNextRound` + `runCountdown`；拒绝 → 发 `'play-again-decline'`
- 房主：收到 accept → `resetForNextRound` + `runCountdown`；收到 decline → toast「对方拒绝了再来一局」，回到结算态

确定性约束：`play-again` 只可能由房主发出、accept/decline 只可能由客人发出，无竞态分支。

### P2 顺手修（与主修复同一 commit，message 注明）

1. `useRaceRoom.ts` L46 硬编码 `{ game: 'whackamole-race' }` → 入参化（RaceRoomOptions 加可选 `game`，默认 `'race'`），RaceView 显式传 `'whackamole-race'`
2. RaceView 满员（`amSpectator`）分支只保留满员横幅，隐藏等待横幅与游戏区
3. `opponentLeft` 横幅文案分阶段：「时间到后结算」仅在 playing 阶段显示

## 验收标准

- [ ] 竞速模式顶栏无重启按钮；单人模式重启行为不变
- [ ] 倒计时中重置/离开后无残余计时器自动开局
- [ ] 开始按钮快速双击不重复广播；对局中收到 start 被忽略
- [ ] 再来一局：房主发起 → 客人显式确认 → 双端倒计时进新局；客人拒绝 → 不开新局且房主收到提示
- [ ] `useRaceRoom` 不含打地鼠硬编码；满员与离开提示文案正确
- [ ] 单人模式与其他游戏代码零改动
- [ ] `npm run build` 通过
- [ ] **执行期间不 commit**（新规则）；完成后报告改动文件，等 Claude 复审

## Review Checklist

- [ ] P0：竞速模式重启入口消失，单人模式回归正常
- [ ] P1：所有 timer id 在 reset/unmount 路径清零，无泄漏
- [ ] P1：房主/客人两侧守卫齐全
- [ ] P1：play-again 协议确定性（发送方约束成立）
- [ ] diff 无外溢：不触碰单人模式、其他游戏、useRealtimeRoom
- [ ] build 通过

## 关键参考

- `src/components/GameLayout.vue:10` — 重启按钮受 `$attrs.onRestart` 控制
- `src/views/WhackAMoleView.vue:225-228` — 待删的 race 分支
- `src/views/WhackAMoleRaceView.vue:138,168-172,174-193,218-230` — 守卫/计时器/再来一局
- `src/composables/useRaceRoom.ts:46,144-153,177-180` — game 标签 / play-again 路由 / requestPlayAgain

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（独立复审） | 复审已提交实现（909cfed/93b1290）：P0×1 + P1×3 + P2×3；上一轮自检漏判，闭环不成立 | 旧流程遗留：commit 先于 review |
| 2 | Claude（计划） | 双方确认修复前进（不 revert，下不为例）；micro 修复计划写入 | 新 P3 已登记 BACKLOG 条目 6 |
