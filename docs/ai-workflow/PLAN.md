# PLAN.md — 当前任务计划

> 本文件是 Claude/Codex 协作的**动态交接文件**。路径固定不变，永远代表「当前正在进行的任务」；历史版本由 git 保留，不做手动归档。
>
> **模板骨架唯一真相源：[docs/ai-workflow/TEMPLATE.md](./ai-workflow/TEMPLATE.md)**。每次新任务只覆盖 TASK_BODY 区，TEMPLATE.md 永远保留不删除。

---

<!-- TEMPLATE:START -->
<!-- ═══════════════════════════════════════════════════════════════════════
  模板骨架 — 永远保留，不删除。
  ┌─────────────────────────────────────────────────────────────────────┐
  │ Claude 新建任务：复制下方结构 → 填入 TASK_BODY 区                    │
  │ Codex 执行：      只改 TASK_BODY 区（勾选仅限「文件级修改点 / 验收标准」│
  │                   与交接记录；Review Checklist 归 Claude，TEMPLATE 禁动）│
  │ Claude review：   只改 TASK_BODY 区的 checklist、修复方案、交接记录   │
  │ 任务提交后：      清空 TASK_BODY 区（保留标题占位），TEMPLATE 不动     │
  └─────────────────────────────────────────────────────────────────────┘
  动态区只覆盖「任务模式」到文件末尾，TEMPLATE:START ~ TEMPLATE:END 之间不动。
  ═══════════════════════════════════════════════════════════════════════ -->

# 任务模式：细（micro）

  选择依据：
  - 细（micro）：≤ 50 行改动、bug 修复、单文件修改 → 给行号级指令 + 改前/改后代码

## 任务目标

联机对战视图中"复制房间号"按钮点击后无 toast 反馈，用户不知道复制成功还是失败。在两个视图的 `copyRoom` 函数中根据 `copyText()` 返回值加 toast 提示。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/TicTacToeOnlineView.vue` | 1. 引入 `useToast`  <br>2. `copyRoom` 成功后 `toast.show('房间号已复制', '📋')` <br>3. 失败后 `toast.show('复制失败，请手动选择', '⚠️')` | [x] |
| `src/views/WhackAMoleRaceView.vue` | 1. `copyRoom` 成功后 `toast.show('房间号已复制', '📋')` <br>2. 失败后 `toast.show('复制失败，请手动选择', '⚠️')`（已有 `toast` 实例，直接用） | [x] |

## 验收标准

- [x] TicTacToeOnlineView 引入并使用了 `useToast`
- [x] 复制成功 → toast 显示"房间号已复制"
- [x] 复制失败 → toast 显示"复制失败，请手动选择"
- [x] WhackAMoleRaceView 同上
- [x] 两个视图的 `copied` ref 按钮文字保留（不删除现有行为，只加 toast）
- [x] `npm run build` 零错误

## Review Checklist

- [x] 逻辑：toast 在 `copyText()` 返回后立即调用，不阻塞 UI
- [x] 空安全：`toast` 实例存在后再调用
- [x] build：`npm run build` 通过（无 noUnusedLocals 报错）
- [x] 风格：toast icon 使用 emoji，与项目其他地方一致

## 关键参考

- `src/composables/useToast.ts` — `toast.show(message, icon?)` API
- `src/lib/clipboard.ts` — `copyText()` 返回 `Promise<boolean>`
- `src/views/WhackAMoleRaceView.vue:108` — 已有 `import { useToast }` 示例
- `src/views/WhackAMoleRaceView.vue:279-287` — `copyRoom` 当前实现
- `src/views/TicTacToeOnlineView.vue:322-329` — `copyRoom` 当前实现

## 实现细节（细模式专有）

### TicTacToeOnlineView.vue

**1. 引入 useToast**（在 `import { copyText } from '@/lib/clipboard'` 之后加一行）：
```ts
import { useToast } from '@/composables/useToast'
```

**2. 创建 toast 实例**（在 `const haptics = useHaptics()` 之后加）：
```ts
const toast = useToast()
```

**3. 修改 copyRoom 函数**（当前 line 322-329）：
```ts
async function copyRoom() {
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const text = isLocalhost ? `房间号 ${roomCode.value}` : window.location.href
  const ok = await copyText(text)
  copied.value = ok
  if (ok) {
    toast.show('房间号已复制', '📋')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.show('复制失败，请手动选择', '⚠️')
  }
}
```

### WhackAMoleRaceView.vue

**1. 无需引入**——`useToast` 已在 line 108 引入，`toast` 实例已在 line 128 创建。

**2. 修改 copyRoom 函数**（当前 line 279-287）：
```ts
async function copyRoom() {
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const text = isLocalhost
    ? `房间号 ${roomCode.value}（好友在「联机竞速」输入此号码即可加入）`
    : window.location.href
  const ok = await copyText(text)
  copied.value = ok
  if (ok) {
    toast.show('房间号已复制', '📋')
    setTimeout(() => (copied.value = false), 1500)
  } else {
    toast.show('复制失败，请手动选择', '⚠️')
  }
}
```

<!-- review 阶段追加：修复方案 -->
## 修复方案（review 阶段追加）

## 修复方案（review 阶段追加）

无 P0/P1。P2 一条已修：`'⚠️ '` 末尾空格 → `'⚠️'`（两处）。

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| 1 | Codex（桌面端） | 两个视图加 toast 反馈，build 通过。P2：emoji 末尾空格。 | P2 已修 |
| 2 | Claude（review + 顺手修） | P0/P1 清零，P2 已修，验收全通过。 | 无 |

<!-- TEMPLATE:END -->
