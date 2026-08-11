# 任务模式：细（micro）

## 任务目标

修复象棋困毙（无子可走）被判和棋的 P0 逻辑错误：视图层将 stalemate 判为 draw，而中国象棋规则与 AI 引擎均判负（ai.ts quiescence 明确"困毙也判负"），导致 AI 优势方把玩家逼到无子可走时反而显示和棋。人机/本地/联机三处一并修复。

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| src/views/XiangqiView.vue | stalemate 分支（L822-832）判负（无子可走方负）+ first_win 成就对齐；新增 staleMated ref + resultMessage 困毙文案；resetGame 清理 | ✅ |
| src/views/XiangqiOnlineView.vue | checkGame stalemate（L500-510）判负（观战端 spectResult 判负 + 玩家端 lose/win + 联机胜利成就）；applyRemoteState（L301-308）stalemate 纳入 lose；L163 文案"将死"泛化为"击败"（P2） | ✅ |

## 验收标准

- [x] `npm run build` 零错误（noUnusedLocals）
- [x] `node tests/test-xiangqi.cjs` 全量通过（引擎层未动，413 项）
- [ ] 手动冒烟：本地双人构造困毙局面（红车困黑将）→ 弹窗显示"XX困毙（无子可走）判负"而非"和棋"；AI 模式残局 AI 逼玩家困毙 → 玩家负
- [x] 工作流收尾：state.json 指向任务 → 完成后复位 current_task=null

## Review Checklist

- [x] 正确性：stalemate 判负方向（无子可走方 = 当前 currentSide/currentTurn/myTurn 语义一致）
- [x] 正确性：成就解锁与 checkmate 分支对齐（first_win / xiangqi_online_win）
- [x] 空安全：staleMated 初始 false、resetGame 清理、undoMove 无需清理（gameOver 时禁止撤销）
- [x] build 零错误

## 关键参考

- src/views/XiangqiView.vue L807-832（checkmate 为正确参照，stalemate 对齐之）
- src/views/XiangqiOnlineView.vue L483-510（checkmate 为正确参照，stalemate 对齐之）
- src/engine/xiangqi/ai.ts L508-509（引擎认知：困毙判负，勿改）

## 实现细节（细模式专有）

### 1. XiangqiView.vue

stalemate 分支（L822-832）改为：

```ts
} else if (status === 'stalemate') {
  isCheckmate.value = true
  gameOver.value = true
  staleMated.value = true
  result.value = currentSide.value === 'red' ? 'black-win' : 'red-win'
  sound.win()
  haptics.win()
  if (achievements.unlock('xiangqi_first_game')) {
    toast.show('成就解锁：象棋新手 ♟️', '🏆')
  }
  if (result.value === 'red-win' || result.value === 'black-win') {
    if (achievements.unlock('xiangqi_first_win')) {
      toast.show('成就解锁：象棋胜利 🏆', '🏆')
    }
  }
  gameOverDialog.value = true
}
```

新增 `const staleMated = ref(false)`（drawByRepetition 旁 L324）。

resultMessage（L396）开头加：

```ts
if (staleMated.value) {
  const loser = result.value === 'red-win' ? '黑方' : '红方'
  return `${loser}困毙（无子可走）判负，共 ${moveCount.value} 步`
}
```

resetGame（L896 旁）补 `staleMated.value = false`。

### 2. XiangqiOnlineView.vue

checkGame stalemate 分支（L500-510）对齐 checkmate：

```ts
} else if (status === 'stalemate') {
  if (amSpectator.value) {
    spectResult.value = currentTurn.value === 'red' ? 'black-win' : 'red-win'
    sound.win()
    gameOverDialog.value = true
    return
  }
  result.value = myTurn.value ? 'lose' : 'win'
  if (result.value === 'win') {
    if (achievements.unlock('xiangqi_online_win')) {
      toast.show('成就解锁：联机先锋 🌐', '🏆')
    }
  }
  sound.win()
  haptics.win()
  gameOverDialog.value = true
}
```

applyRemoteState（L303）`status === 'checkmate'` → `status === 'checkmate' || status === 'stalemate'`。

L163 文案：`'你成功将死了对手'` → `'你成功击败了对手'`（P2 顺手）。

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude | 直接实施（本会话内联执行） | 手动冒烟待用户验证 |

## 背景与根因

中国象棋规则：无子可走（困毙）判走子方负、对方胜。视图层三处将 stalemate 判和：

- XiangqiView.vue L822-825：`result.value = 'draw'`
- XiangqiOnlineView.vue L500-510：玩家端 `'draw'`、观战端 `spectResult = 'draw'`
- XiangqiOnlineView.vue L301-308：applyRemoteState 重连分支，stalemate 落入 else → `'draw'`

AI 引擎认知正确（ai.ts quiescence L508-509："象棋中困毙也判负"，返回 -(MATE - ply)），AI 优势方会积极追求困毙取胜 → 用户"感觉 AI 优势"却被判和。checkmate 分支（判负）为正确参照。测试 Suite 13 仅断言引擎层 getGameStatus 返回 'stalemate'（引擎语义正确），视图层映射错误未被覆盖。
