# PLAN.md — 当前任务计划

> 本文件是 Claude/Codex 协作的**动态交接文件**。路径固定不变，永远代表「当前正在进行的任务」；历史版本由 git 保留，不做手动归档。
>
> **模板骨架唯一真相源：[docs/ai-workflow/TEMPLATE.md](./ai-workflow/TEMPLATE.md)**。每次新任务只覆盖 TASK_BODY 区，TEMPLATE.md 永远保留不删除。

---

# 任务模式：细（micro）

选择依据：≤ 50 行改动、bug 修复、3 文件修改 → 给行号级指令 + 改前/改后代码

## 任务目标

修复打地鼠联机竞速"双方都认为自己是房主"的 Bug，加显式 join/ack 握手协议 + 修复 presence 逻辑 + 加房间号输入入口 + 优化 localhost 复制文案。

设计文档：`docs/superpowers/specs/2026-08-04-whackamole-race-join-fix-design.md`

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/composables/useRaceRoom.ts` | 加 join/ack 握手；修 presence `lockedPlayers` 逻辑 | ☑ |
| `src/views/WhackAMoleRaceView.vue` | 初始化判定房主/客人；客人发 join；处理 ack；优化 copyRoom 文案 | ☑ |
| `src/views/WhackAMoleView.vue` | 模式选择屏加"输入房间号加入"区域 | ☑ |

## 验收标准

- [x] 房主创建房间 → 同事通过 URL 带 `?room=XXXX` 加入 → 双方都能看到对方加入 → 房主点开始 → 双方棋盘同时跑地鼠
- [x] 房主创建房间 → 同事打开无参数 URL → 在模式选择屏输入房间号 → 点加入 → 同上
- [x] 同事输入无效房间号（3 位 / 含非法字符） → 显示格式错误提示，不跳转
- [x] 同事加入后房主刷新页面 → 房主仍为房主，角色不翻转
- [x] 同事加入后掉线 → 房主看到"对手已离开"提示

## Review Checklist

- [x] 逻辑：join/ack 握手时序正确，不会出现"双方房主"或"双方客人"
- [x] 空安全：supabase 为 null（no-supabase）时握手逻辑不报错
- [ ] 兼容性：旧版房主 + 新版客人互通时不卡死（3 秒超时兜底）
- [x] build：`npm run build` 通过（noUnusedLocals / noUnusedParameters）
- [x] 风格：匹配现有代码风格（注释密度、命名）

## 关键参考

- `src/composables/useRaceRoom.ts:105-123` — presence 同步逻辑（需修改）
- `src/composables/useRaceRoom.ts:70-81` — isHost / opponentPresent 计算属性
- `src/views/WhackAMoleRaceView.vue:136-139` — 房间号初始化（需加房主判定）
- `src/views/WhackAMoleRaceView.vue:297-303` — copyRoom 函数（需优化文案）
- `src/views/WhackAMoleView.vue:131-134` — 当前检测 URL room 参数逻辑

## 实现细节（细模式专有）

### 文件 1：`src/composables/useRaceRoom.ts`

**改动 A：修 presence `lockedPlayers` 逻辑（第 105-123 行）**

改前：
```ts
room.onPresenceSync((ids: string[]) => {
  const present = ids.slice().sort()
  if (lockedPlayers.value.length >= 2) {
    const here = lockedPlayers.value.filter(id => present.includes(id))
    if (here.length === 0) lockedPlayers.value = []
  }
  if (lockedPlayers.value.length === 0 && present.length >= 2) {
    lockedPlayers.value = present.slice(0, 2)
  }
  const iAmP = lockedPlayers.value.includes(room.myId)
  opponentId.value = iAmP ? (lockedPlayers.value.find(id => id !== room.myId) ?? null) : null
  if (iAmP && opponentId.value) hadOpponent.value = true
  if (hadOpponent.value && !opponentPresent.value && !leftNotified) {
    leftNotified = true
    opts.onOpponentLeave?.()
  }
})
```

改后：
```ts
room.onPresenceSync((ids: string[]) => {
  const present = ids.slice().sort()
  if (present.length >= 2) {
    // 两人都在 → 每次重新计算锁定列表（避免首次时序问题）
    lockedPlayers.value = present.slice(0, 2)
  } else if (lockedPlayers.value.length >= 2) {
    // 已锁但人数不足 → 检查是否全部离开
    const here = lockedPlayers.value.filter(id => present.includes(id))
    if (here.length === 0) lockedPlayers.value = []
    // 走了一人、还剩一人 → 保持锁定（避免角色抖动）
  }
  const iAmP = lockedPlayers.value.includes(room.myId)
  opponentId.value = iAmP ? (lockedPlayers.value.find(id => id !== room.myId) ?? null) : null
  if (iAmP && opponentId.value) hadOpponent.value = true
  if (hadOpponent.value && !opponentPresent.value && !leftNotified) {
    leftNotified = true
    opts.onOpponentLeave?.()
  }
})
```

**改动 B：加 join/ack 握手（在现有 `room.on(...)` 注册之后，约第 154 行后追加）**

```ts
// 握手：客人发 join，房主回 ack 并附带双方 id
room.on('join', (_data: any, from: string | undefined) => {
  if (isHost.value && from) {
    room.send('ack', { players: [room.myId, from] })
  }
})
```

同时在 `RaceRoomApi` 接口（第 10-29 行）加一个方法：
```ts
/** 客人调用：向房主发送加入报到 */
join: () => void
```

实现（在 requestStart 前）：
```ts
function join() {
  room.send('join', {})
}
```

并在 return 里加上 `join`。

### 文件 2：`src/views/WhackAMoleRaceView.vue`

**改动 C：初始化判定房主/客人（第 136-139 行附近）**

在 `roomCode` 初始化后，加一个房主标志：
```ts
const isHostClient = !(typeof q === 'string' && /^[A-Z0-9]{4}$/.test(q))
```

**改动 D：客人挂载后发 join（在 onMounted 里，约第 305 行）**

```ts
onMounted(() => {
  if (!(typeof route.query.room === 'string' && /^[A-Z0-9]{4}$/.test(route.query.room))) {
    router.replace({ query: { ...route.query, room: roomCode.value } })
  } else {
    // 客人：主动发 join 报到
    room.join()
  }
})
```

**改动 E：处理 ack（在 useRaceRoom 调用时加 onAck 回调）**

需要在 `useRaceRoom` 的 `RaceRoomOptions` 里加 `onAck`：
```ts
onAck?: (players: [string, string]) => void
```

并在 `room.on('ack')` 里调用：
```ts
room.on('ack', (data: any) => {
  if (Array.isArray(data?.players) && data.players.length === 2) {
    opts.onAck?.(data.players as [string, string])
  }
})
```

在视图里处理：
```ts
const room = useRaceRoom(roomCode.value, {
  // ...现有回调...
  onAck: (players) => {
    // 锁定角色（兜底，presence 修复已处理大部分场景）
  },
})
```

**改动 F：优化 copyRoom 文案（第 297-303 行）**

改前：
```ts
const text = isLocalhost ? `房间号 ${roomCode.value}` : window.location.href
```

改后：
```ts
const text = isLocalhost
  ? `房间号 ${roomCode.value}（好友在「联机竞速」输入此号码即可加入）`
  : window.location.href
```

### 文件 3：`src/views/WhackAMoleView.vue`

**改动 G：加房间号输入入口**

在模式选择按钮下方，加一个加入区域的 UI + 逻辑：
- 输入框 + 加入按钮
- 校验：4 位字母数字（ROOM_CHARS 字符集）
- 校验通过 → `router.push({ query: { room: code } })`

（具体实现由 Codex 自主布局，约束：放在模式选择屏底部、不破坏现有单人/联机按钮布局）

## 修复方案（review 阶段追加，粗模式可改为「执行调整」）

<!-- review 时填写 -->

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| 1 | Claude | 设计完成，写 PLAN.md | 待执行 |
| 2 | Codex | 执行 3 文件修改，commit 231ae30 | CSS P1 |
| 3 | Claude | Review → 修 CSS，commit cb8f175 | 无 |
