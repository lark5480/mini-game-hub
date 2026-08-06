# 任务模式：细（micro）

## 任务目标

打地鼠联机竞速收尾：消化 BACKLOG 条目 6（客人开局前看不到难度；结算后对手离开无明确提示）与条目 7（观战者短路游戏区）。本任务同时是 tasks/ 新机制（任务文件 + state.json + 交付报告）的首次实战。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/WhackAMoleRaceView.vue` | 观战者短路游戏区（5 处条件）；客人等待横幅显示难度；结算弹窗 action 区 opponentLeft 置首分支 | [x] |
| `docs/ai-workflow/BACKLOG.md` | 条目 6、7 回填已完成并注明 commit | [x] |

## 验收标准

- [ ] 第三人进房只见房间满员横幅与房间号栏，棋盘/对手分数条/等待横幅/开始操作区全部隐藏
- [x] 第三人进房只见房间满员横幅与房间号栏，棋盘/对手分数条/等待横幅/开始操作区全部隐藏
- [x] 客人开局前看到「等待房主开始…（难度：X）」，X 随房主选择实时同步
- [x] 结算后对手离开，弹窗 action 区显示「对手已离开房间」，房主与客人视角一致
- [x] 双人正常流程回归不受影响：开始/倒计时/对战/结算/再来一局
- [x] 单人模式与其他游戏零改动
- [x] `npm run build` 通过
- [x] **执行期间不 commit**（新规则）；完成后按 `<delivery_report>` 格式交付

## Review Checklist

- [x] 观战者短路无遗漏：对手分数条、倒计时覆盖层、棋盘、房主操作区、客人等待横幅五处全部受控
- [x] 难度标签映射正确（easy/normal/hard → 简单/普通/困难），房主切换时客人侧实时更新
- [x] action 区 v-if/v-else-if 链顺序正确：opponentLeft 优先于房主按钮与等待提示
- [x] diff 无外溢；无 console 残留；`noUnusedLocals` 通过

## 关键参考

- `src/views/WhackAMoleRaceView.vue:25-29` — banner 链（amSpectator 在 L25）
- `src/views/WhackAMoleRaceView.vue:31-76` — 游戏区（opponent-bar / countdown-overlay / Board / host-controls / 客人等待横幅）
- `src/views/WhackAMoleRaceView.vue:88-92` — 结算弹窗 action 槽
- `src/views/WhackAMoleRaceView.vue:116-120` — difficulties 表
- `src/composables/useRaceRoom.ts` — `amSpectator` / `opponentLeft` / `difficulty` 语义

## 实现细节

### 改动点 1：观战者短路游戏区（BACKLOG 条目 7）

不给游戏区加包装 div（避免破坏 flex 布局），对五个顶层元素分别加条件：

- L32 opponent-bar：`v-if="(room.opponentPresent.value || room.opponentLeft.value) && !room.amSpectator.value"`
- L41 countdown-overlay：`v-if="countdown !== null && !room.amSpectator.value"`
- L46 WhackAMoleBoard：加 `v-if="!room.amSpectator.value"`
- L55 host-controls：`v-if="room.isHost.value && phase === 'idle' && !room.amSpectator.value"`
- L74 客人等待横幅（与 host-controls 是 v-if/v-else-if 链）：`v-else-if="phase === 'idle' && !room.isHost.value && !room.amSpectator.value"`

效果：观战者只见房间号栏 + banner 链（满员横幅），不见任何对局元素。

### 改动点 2：客人侧显示当前难度（BACKLOG 条目 6a）

script 中新增 computed（放在 settle 相关 computed 附近）：

```ts
const difficultyLabel = computed(() => difficulties.find(d => d.name === room.difficulty.value)?.label ?? '普通')
```

L74-76 客人等待横幅改为：

```html
<div v-else-if="phase === 'idle' && !room.isHost.value && !room.amSpectator.value" class="banner banner-wait">
  等待房主开始…（难度：{{ difficultyLabel }}）
</div>
```

房主侧已有难度按钮 active 态，不需要额外处理。

### 改动点 3：结算后对手离开的提示（BACKLOG 条目 6b）

L88-92 action 槽改为（opponentLeft 置首分支，房主/客人视角统一）：

```html
<template #action>
  <span v-if="room.opponentLeft.value" class="wait-hint">对手已离开房间</span>
  <button v-else-if="room.isHost.value && !playAgainWaiting" class="dialog-btn" @click="onPlayAgain">再来一局</button>
  <span v-else-if="playAgainWaiting" class="wait-hint">等待对方确认…</span>
  <span v-else-if="!room.isHost.value && !playAgainConfirm" class="wait-hint">等待房主开始下一局…</span>
</template>
```

说明：原实现中房主在对手离开后仍会看到「再来一局」按钮，点击后永远卡在「等待对方确认…」——置首分支同时修复了这个对称性问题。

## 修复方案（review 阶段追加）

无——A 档通过，无 P0/P1/P2。

## Review 结果（Claude，第 3 轮）

- 代码 diff 与计划逐行一致：观战者短路 5 处条件精确、`difficultyLabel` computed 空安全（`?.label ?? '普通'`）、opponentLeft 置首分支且链条其余部分降级为 v-else-if 正确
- 勾选边界合规：仅勾「文件级修改点 / 验收标准」，Review Checklist 未动，交接记录只追加不篡改
- `npm run build` Claude 独立复验通过
- ⚪ P3×1 已登记 BACKLOG 条目 9：新 commit 时机规则下，BACKLOG「已完成(<commit>)」状态在执行期无哈希可填，回填应明确为提交后收尾步骤

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Claude（计划） | micro 计划写入，tasks/ 机制首次启用 | — |
| 2 | Codex（执行） | 三处改动全部落地，build 通过，BACKLOG 6/7 回填已完成 | 无 |
| 3 | Claude（review） | A 档通过：P0/P1/P2 清零，P3×1 登记条目 9；勾选边界合规 | 待提交 + BACKLOG 哈希收尾 |
| 4 | Claude（收尾） | 主提交 0107c18 + 哈希回填/state.json 复位收尾提交；任务闭环 | — |
