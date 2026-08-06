# 打地鼠联机竞速：加入流程 Bug 修复 + 房间号输入入口

**日期**：2026-08-04
**状态**：已确认
**相关文件**：
- `src/views/WhackAMoleRaceView.vue`
- `src/views/WhackAMoleView.vue`
- `src/composables/useRaceRoom.ts`
- `src/composables/useRealtimeRoom.ts`

---

## 1. 问题描述

### 1.1 Bug：同事加入后只有一个棋盘能看到地鼠

**复现步骤**：
1. 房主本地启动，进入打地鼠联机竞速，房间号 `BNPG`
2. 通过本地 IP（如 `192.168.x.x:5173`）把链接发给同事
3. 同事打开链接，选难度，点开始
4. **结果**：只有一个棋盘跑地鼠，另一个棋盘静止（idle 状态）

**根因**：双方 `isHost` 判定都为 true。

`useRaceRoom.ts` 的 presence 同步逻辑只在首次检测到 ≥2 人时锁一次 `lockedPlayers`。如果首次触发时 presence 未完全同步（本地只看到自己），`lockedPlayers` 就永远为空或错误。双方各自认为自己是房主，都显示"开始"按钮。

当同事（实际是客人）点开始，走的是 `requestStart()` → `send('start', {})`，但房主不认为自己需要响应客人的 start（房主等的是自己点开始），所以房主的棋盘永远不会启动。

### 1.2 体验问题：localhost 复制出来的房间号没处输入

`copyRoom()` 在 localhost 下复制的是纯文字 `房间号 BNPG`。同事拿到这 4 个字母后，没有输入框可以填入。生产环境复制的是完整 URL（带 `?room=XXXX`），但 localhost 没有域名，URL 对同事无用。

---

## 2. 设计方案

### 2.1 显式加入握手协议（主路径）

不再纯靠 presence 判定角色，引入显式消息握手：

| 步骤 | 发起方 | 消息 | 作用 |
|---|---|---|---|
| 1 | 客人（URL 带 `?room=XXXX`） | `join` | 进入房间时报到 |
| 2 | 房主收到 `join` | `ack { players: [hostId, guestId] }` | 回传约定的角色分配 |
| 3 | 客人收到 `ack` | — | 用 ack 列表锁定角色 |

**房主判定（确定性，不依赖网络）**：
- 进入 race 视图时，如果 URL **没有** `?room` 参数 → 自己是房主（生成房间号）
- 如果 URL **有** `?room` 参数 → 自己是客人
- 这个判定在 `WhackAMoleRaceView.vue` 初始化时就确定，不依赖 presence

**消息处理**：
- 房主侧：`room.on('join', (data, from) => { room.send('ack', { players: [myId, from] }) })`
- 客人侧：收到 `ack` 后设置 `lockedPlayers = ack.players`，`opponentPresent` 变 true

**兜底**：如果客人发 `join` 后 3 秒没收到 `ack`（房主已离开），显示"房间不存在或房主已离开"提示。

### 2.2 presence 逻辑修复（兜底）

修复 `useRaceRoom.ts` 中 `onPresenceSync` 的 `lockedPlayers` 管理逻辑：

**现状（Bug）**：
```ts
if (lockedPlayers.value.length === 0 && present.length >= 2) {
  lockedPlayers.value = present.slice(0, 2)  // 只锁一次
}
```

**修复后**：
```ts
if (present.length >= 2) {
  // 两人都在 → 每次重新计算锁定列表（避免首次时序问题）
  lockedPlayers.value = present.slice(0, 2)
} else if (lockedPlayers.value.length >= 2) {
  // 已锁但人数不足 → 检查是否全部离开
  const here = lockedPlayers.value.filter(id => present.includes(id))
  if (here.length === 0) lockedPlayers.value = []
  // 走了一人、还剩一人 → 保持锁定（避免角色抖动）
}
```

**关键变化**：
- 不再"只锁一次"，每次 presence 变化都重新评估
- 已锁 2 人后，走了一人**不立即解锁**，等全部离开或新人补位

### 2.3 房间号输入入口

在 `WhackAMoleView.vue` 模式选择屏底部加一个"输入房间号加入"区域。

**UI 结构**：
```
[单人模式按钮]  [联机竞速创建房间按钮]
┌──────────────────────────────────┐
│ 输入房间号加入：[____] [加入]    │
└──────────────────────────────────┘
```

**交互**：
- 输入框：4 位，自动大写，字符集限制为 `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`
- 加入按钮：校验通过后 `router.push({ query: { room: code.toUpperCase() } })`
- 校验失败：显示提示"房间号为 4 位字母或数字"

### 2.4 localhost 复制文案优化

**现状**：`房间号 BNPG`
**改为**：`房间号 BNPG（好友在「联机竞速」输入此号码即可加入）`

让拿到文字的人知道该去哪里输入。

---

## 3. 改动范围

| 文件 | 改动类型 | 内容 |
|---|---|---|
| `useRaceRoom.ts` | 修改 | 加 `join`/`ack` 握手；修 presence `lockedPlayers` 逻辑 |
| `WhackAMoleRaceView.vue` | 修改 | 初始化时判定房主/客人；客人发 `join`；处理 `ack`；更新 `copyRoom()` 文案 |
| `WhackAMoleView.vue` | 修改 | 模式选择屏加"输入房间号加入"区域 |

**不涉及**：`useRealtimeRoom.ts`（底层通道不变）、`WhackAMoleBoard.vue`（棋盘逻辑不变）、路由定义、Supabase 配置。

---

## 4. 消息协议变更

| 消息类型 | 方向 | payload | 备注 |
|---|---|---|---|
| `join` | 客人→房主 | 无（from 自带） | 新增 |
| `ack` | 房主→客人 | `{ players: [string, string] }` | 新增 |
| `score` | 双向 | `number` | 不变 |
| `final` | 双向 | `number` | 不变 |
| `start` | 房主→客人 | 无 | 不变 |
| `difficulty` | 房主→客人 | `string` | 不变 |
| `play-again` 等 | — | — | 不变 |

---

## 5. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 旧版房主 + 新版客人互通 | 旧版房主不发 `ack`，新版客人 3 秒后超时兜底（显示提示，不卡死） |
| presence 修复引入角色抖动 | 已锁后走了一人不立即解锁，避免中间态 |
| 输入框被恶意输入 | 前端校验字符集 + 长度，后端无（纯 P2P） |

**回滚**：所有改动在 3 个文件内，无数据库迁移，无 breaking API 变更。`git revert` 即可。

---

## 6. 验收标准

1. 房主创建房间 → 同事通过 URL 带 `?room=XXXX` 加入 → 双方都能看到对方加入 → 房主点开始 → **双方棋盘同时跑地鼠**
2. 房主创建房间 → 同事打开**无参数 URL** → 在模式选择屏输入房间号 → 点加入 → 同上
3. 同事输入无效房间号（3 位 / 含非法字符） → 显示格式错误提示，不跳转
4. 同事加入后房主刷新页面 → 房主仍为房主（localStorage 稳定 id），角色不翻转
5. 同事加入后掉线 → 房主看到"对手已离开"提示
