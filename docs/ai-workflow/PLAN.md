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

<!--
# 任务模式：细（micro）
  — 或 —
# 任务模式：粗（macro）

  选择依据：
  - 细（micro）：≤ 50 行改动、bug 修复、单文件修改 → 给行号级指令 + 改前/改后代码
  - 粗（macro）：新游戏、多文件重构、架构级变更 → 只给约束和参考，Codex 自主实现
-->

## 任务目标

将 `copyText` 函数从 `WhackAMoleRaceView.vue` 和 `TicTacToeOnlineView.vue` 两处重复实现抽取到 `src/lib/clipboard.ts`，统一维护。来源：BACKLOG #4。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/lib/clipboard.ts` | **新建**：导出 `copyText(text: string): Promise<boolean>` | [x] |
| `src/views/WhackAMoleRaceView.vue` | 删除本地 `copyText` 定义（L279-301）→ 改为 import | [x] |
| `src/views/TicTacToeOnlineView.vue` | 删除本地 `copyText` 定义（L322-345）→ 改为 import | [x] |

## 验收标准

- [x] `src/lib/clipboard.ts` 导出 `copyText`，逻辑与原来完全一致（Clipboard API 优先 → textarea + execCommand 降级）
- [x] 两处视图不再定义本地 `copyText`，改为 `import { copyText } from '@/lib/clipboard'`
- [x] `npm run build` 零错误
- [x] 复制房间邀请链接功能在两个游戏中正常工作

## Review Checklist

- [x] **正确性**：降级路径完整（secure context 判断、try/catch 包裹、execCommand 清理 DOM）
- [x] **规范**：没有新建多余的 composable，走 `@/lib/` 工具文件路径
- [x] **引用**：import 路径用 `@/lib/clipboard`，与项目现有 `@/lib/games.ts` 等一致
- [x] **清理**：两处原函数完全删除，不留注释或死代码

## 关键参考

- 原实现：`src/views/WhackAMoleRaceView.vue:279-301`
- 原实现：`src/views/TicTacToeOnlineView.vue:322-345`
- 调用点：`WhackAMoleRaceView.vue:308`（`copyRoom` 内）、`TicTacToeOnlineView.vue:353`（`copyRoom` 内）
- 同目录现有工具文件命名惯例：`games.ts` / `rank.ts` / `supabase.ts`（全小写 `.ts`）

## 实现细节（细模式专有）

### 1. 新建 `src/lib/clipboard.ts`

```typescript
/**
 * 复制文本到剪贴板。
 * 优先 Clipboard API（需安全上下文），HTTP 局域网下降级到 execCommand。
 * 返回是否成功。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // 落到降级方案
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.top = '-9999px'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
```

### 2. `WhackAMoleRaceView.vue` 改动

- **删除** L278-301（`// 复制邀请链接` 注释 + 整个 `async function copyText`）
- **添加 import**：`import { copyText } from '@/lib/clipboard'`
- `copyRoom` 函数（L303+）调用不变，无需改动

### 3. `TicTacToeOnlineView.vue` 改动

- **删除** L321-345（`// 复制文本：优先 Clipboard API...` 注释 + 整个 `async function copyText`）
- **添加 import**：`import { copyText } from '@/lib/clipboard'`
- `copyRoom` 函数（L348+）调用不变，无需改动

## 修复方案（review 阶段追加）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| 0 | Claude | 计划建好，待 Codex 执行 | — |
| 1 | Codex | 执行完成，build 通过 | — |
| 2 | Claude | Review 通过，P0/P1/P2/P3 全清零 | — |

<!-- TEMPLATE:END -->
