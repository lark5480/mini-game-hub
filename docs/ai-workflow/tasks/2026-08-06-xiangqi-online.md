# 任务模式：粗（macro）

选择依据：联机子组件功能补齐（认输/求和协议 + 断线恢复 + 状态 banners），多消息类型扩展，Codex 自主实现细节，Claude 只验收结果。

## 任务目标

在 T2 已完成的 XiangqiOnlineView.vue 基础上，补齐联机对战完整功能：认输/求和协议、断线重连恢复、对手离开/满员/重连状态提示横幅。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/XiangqiOnlineView.vue` | 认输/求和协议 + 断线恢复（sync-req/state）+ 状态 banners（opponentLeft / amSpectator / reconnecting） | ✅ |

## 验收标准

- [ ] `npm run build` 零错误
- [ ] **认输**：一方点击认输 → 广播 `{type:'surrender'}` → 对手端立即弹出"对手认输，你赢了"对话框
- [ ] **求和**：一方点击求和 → 广播 `{type:'draw-offer'}` → 对手端弹出确认卡（"对手求和，是否接受？" + 接受/拒绝按钮）→ 接受则广播 `{type:'draw-accept'}` 双方进和棋；拒绝则广播 `{type:'draw-decline'}` 继续对局
- [ ] **断线恢复**：重连玩家（presence 变化且本地无棋局）→ 自动发送 `sync-req` → 有棋局的对手广播 `state`（含 board + turn + gameOver）→ 接收方应用权威状态
- [ ] **对手离开横幅**：`opponentLeft`（对手不在 presence 中且棋局已开始）→ 显示"对手已离开"横幅
- [ ] **满员横幅**：`amSpectator`（第三人加入）→ 显示"房间已满"横幅
- [ ] **重连中横幅**：`room.status.value === 'reconnecting'` → 显示"网络不稳定，正在重新连接…"
- [ ] 认输/求和按钮仅在本方回合或任意非结束状态可点击（认输随时可点；求和仅在对手在线时可点）
- [ ] 求和弹窗使用 confirm 卡片（非阻塞游戏内操作），参照竞速 play-again 的 accept/decline 模式

## Review Checklist

- [x] 架构合规：一切消息走 `room.send()` / `room.on()`，不新建 WebSocket 或自建同步方案
- [x] 消息类型命名清晰（surrender / draw-offer / draw-accept / draw-decline / sync-req / state）
- [x] 断线恢复逻辑参照 TTT `authorizedState` + `applyRemoteState` 模式
- [x] 状态 banners 条件互斥（error > reconnecting > amSpectator > opponentLeft > connecting > waiting）
- [x] 无死代码、无未使用变量（npm run build 通过）
- [x] 命名 snake_case 与项目一致

## Review 结论（2026-08-06，两轮）

| 轮次 | 🔴 P0 | 🟡 P1 | 🔵 P2 | ⚪ P3 |
|------|-------|-------|-------|-------|
| Round 1 | 1 | 0 | 1 | 2 |
| Round 2 | 0 ✅ | 0 | 0 ✅ | 2（进 BACKLOG） |

**P0+P1 清零，P2 已修，P3 进 BACKLOG。T3 可提交。**

## 关键参考

- `src/views/TicTacToeOnlineView.vue` — sync-req/state 断线恢复（line 186-245）、角色分配、消息协议（**最直接的参照**）
- `src/views/WhackAMoleRaceView.vue` — play-again accept/decline 确认卡片（line 98-102, 265-281）、状态 banners（line 22-29）
- `src/composables/useRealtimeRoom.ts` — RoomApi 接口（send / on / onPresenceSync / status / peerIds）
- `src/views/XiangqiOnlineView.vue`（T2 已交付）— 当前已有基础走法同步、角色分配、reset，在其上扩展
- `AGENTS.md` — 联机一切行为走 useRealtimeRoom，严禁自建同步方案

## 实现约束（Codex 必须遵守）

1. **禁止自建同步方案**：所有联机消息走 `room.send(type, data)` / `room.on(type, cb)`，不改 `useRealtimeRoom.ts`
2. **消息协议设计**：
   - `surrender`：无 data，接收方立即判定胜利
   - `draw-offer`：无 data，接收方弹出确认卡
   - `draw-accept`：无 data，双方进和棋结算
   - `draw-decline`：无 data，继续对局（可 toast 提示"对手拒绝求和"）
   - `sync-req`：无 data，有棋局的一方响应 `state`
   - `state`：`{ board: Board, turn: Side, gameOver: boolean }`，接收方完整替换本地状态
3. **断线恢复参照 TTT**：
   - `onPresenceSync` 中检测 `peerCountPrev < 2 && present.length >= 2 && !boardHasMoves() && iAmPlayer` → 延迟 300ms 发 `sync-req`
   - `room.on('sync-req')`：若本地 `boardHasMoves()` 则发 `state`
   - `room.on('state')`：校验后替换 board / turn / gameOver，若 gameOver 则按本端角色推导胜负
4. **opponentLeft 判定**：`!opponentPresent.value && boardHasMoves()`（对手不在且棋局已开始）
5. **amSpectator 判定**：沿用已有的 `computed`（lockedPlayers.length >= 2 && !lockedPlayers.includes(myId)）
6. **banners 优先级**（从高到低）：error > reconnecting > amSpectator > opponentLeft > connecting > waiting
7. **求和确认卡片**：用 overlay 卡片（非 GameDialog），包含"对手求和，是否接受？"文字 + 接受按钮 + 拒绝按钮；被拒绝后 toast 提示
8. **认输/求和按钮**：放在"重新开始"按钮旁边，仅 `mode === 'online'` 且非 spectator 状态显示
9. **重启按钮广播**：`resetBoard(broadcast=true)` 已广播 'reset'，保持不变
10. **GameLayout confirmRestart**：联机模式 `confirmRestart=false`（已有，保持）

## 修复方案（review 阶段追加）

### T3 Review 修复（P0 + P2）

**P0 — 本地认输结果设反**：
- 新增 `surrenderByMe` ref 标记"我方主动认输"
- `surrender()` 内 `result.value = 'win'` → `'lose'`，`sound.win()` → `sound.miss()`，`haptics.win()` → `haptics.error()`
- `resultTitle` / `resultMessage` / `resultIcon` 三个 computed 顶部加 `surrenderByMe` 分支（"你认输" / "你选择认输，对手获胜" / `'fail'`）
- `resetBoard` 开头加 `surrenderByMe.value = false` 重置

**P2 — applyRemoteState 终局结果推导**：
- 原来远端终局一律判 `'draw'`，改为用 `getGameStatus(board, myRole)` 推导：`checkmate` → `'lose'`（轮到我方走但无合法走法且被将死 → 我方负），其余 → `'draw'`
- 增加 `myRole.value` 非空守卫，避免观战状态下误触发

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | Codex（执行） | 认输/求和/sync-req/state/banners 全部实现，build 零错误 | 无 |
| 2 | Codex（修复） | P0 认输结果修正 + P2 终局推导，build 零错误 | 无 |
