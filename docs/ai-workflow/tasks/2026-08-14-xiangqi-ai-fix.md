# 任务模式：粗（macro）

> 来源：用户反馈「象棋 AI 对战有问题，说不上是难度不够还是 bug」。Claude 审查确认：既有真 bug（兵 PST 方向写反 + 悔棋不同步棋谱 + AI 执红悔棋后冻结），难度设计也确有缺陷（墙钟时限依赖设备性能、三档难度在慢设备坍缩、棋力上限低）。本任务修复 P0/P1 + P2 顺手项，P3 登记 BACKLOG。

## 任务目标

修复中国象棋人机模式的核心问题：兵（卒）位置价值表方向性错误（AI 不愿挺兵过河的战略盲区）、悔棋后棋谱记录不同步（点旧着法崩溃）、AI 执红悔棋后棋盘冻结、搜索 Promise 异常无声锁死；并为迭代加深增加 `minDepth` 深度下限参数，使三档难度在慢设备上仍保持可感知分层。

## 文件级修改点

- `src/engine/xiangqi/ai.ts`：① 重写 `POSITION_BONUS.pawn` 为红方视角正确梯度（home≈0-10 → 过河明显奖励 → 纵深递增、中心列加权；总摆动 ≤ 100 分；保持红黑镜像对称，`getPositionBonus` 无需改）；② `findBestMove` 新增可选第 6 参 `minDepth = 0`：迭代加深超时回退前必须已完成 minDepth 层，未达标则延长搜索重试（绝对硬截止 2×timeLimitMs；`cancelRequested` 触发的超时不延长、立即中断；`minDepth` 钳制为 ≤ depth）。| ✅ |
- `src/workers/xiangqi-ai.worker.ts`：search 消息解构透传 `minDepth`。| ✅ |
- `src/composables/useXiangqiAI.ts`：`SearchParams` 增加可选 `minDepth?: number` 并透传（向后兼容）。| ✅ |
- `src/views/XiangqiView.vue`：① `undoMove` 记录实际弹出步数 `popped`，同步 pop `gameRecord.moves/sides` 尾部并重写 localStorage `xiangqi_record`；结束后若轮到 AI（`mode==='ai' && !gameOver && currentSide===aiSide`）调用 `scheduleAIMove()`（防重复调度）；② `scheduleAIMove` / `showHint` 的 `await requestSearch(...)` 包 try/catch：失败或 null 复位 `aiThinking/hintThinking` + `toast.show` 提示；③ 难度参数：中等 `minDepth: 3`、困难 `minDepth: 4`（提示困难 `minDepth: 3`），其余深度/时限不变。| ✅ |
- `tests/test-xiangqi.cjs`：新增 Suite 37（兵价值方向断言 + 镜像回归 + 29.4 回归确认）；Suite 36 断言 3/5 构造更新为 PST 抵消构造（新兵表列向/行向梯度使旧构造隐含假设失效）。| ✅ |
- 不改：`rules.ts` / `types.ts` / `notation.ts` / `openings.ts`、联机 `XiangqiOnlineView.vue`、其余游戏。不引入外部依赖。| ✅ |

## 验收标准

- [x] `node tests/test-xiangqi.cjs` 全绿（419/419，含新增 Suite 37）
- [x] `npm run build`（vue-tsc + vite）零错误
- [x] Suite 37 断言：红兵过河(4,4) 评估 > 在家(6,4)；黑卒过河(5,4) 对红方评估更差于在家(3,4)；初始局面 eval=0 与红黑镜像 eval=0 保持；Suite 29.4（开局不贪炮打马）不翻转
- [x] minDepth 语义：超时回退前尽力完成 minDepth 层；取消（cancel）不触发延长；硬截止 2×timeLimitMs（实测 minDepth=6/limit=300ms 实际 752ms ≈ 600ms 硬截止 + 单批节点粒度余量）；minDepth>depth 钳制
- [x] 悔棋一致性：棋谱条目数与棋盘步数一致、无空条目、点击旧着法不崩溃；AI 执红开局后立即悔棋 → AI 重新落子、对局可继续
- [x] 健壮性：搜索失败/返回 null 时复位 thinking 状态并 toast 提示，不无声锁死
- [x] 文档：`docs/system_design.md` 难度参数同步；BACKLOG 登记 P3 项（#17-19）

## Review Checklist

- [x] 兵表镜像对称：初始局面 eval=0、红黑镜像 eval=0 不翻转（Suite 36 断言 1/8 + Suite 37 断言 4 全过）
- [x] 兵表权重边界：总摆动 ≤ 100 分，不颠覆子力主导（Suite 29 战术断言全保持；行为实测：AI 主动挺兵过河 5,4->4,4）
- [x] minDepth 延长搜索的取消语义：cancelRequested 超时立即中断不延长（条件 `!cancelRequested` 短路）；无限重试防御（绝对硬截止 hardDeadline=2×timeLimitMs，实测 minDepth=6/limit=300ms 总 752ms ≈ 硬截止+单批粒度余量）
- [x] undo 弹步数用实际 `popped`（history 不足 2 条时 splice 不越界）；重调度 AI 有 scheduleAIMove 内部 mode/gameOver/currentSide 守卫 + aiTimer 先清理无重复调度
- [x] Worker 协议向后兼容：minDepth 可选，缺省 undefined → 引擎默认 0，旧调用行为不变
- [x] try/catch 兜底覆盖 showHint 与 scheduleAIMove 两条链路，先复位 thinking 状态再 toast 提示；seq 过期校验在 toast 之前（悔棋/重开不弹陈旧提示）
- [x] 浏览器冒烟（AI 挺兵/悔棋重调度/慢设备）：本环境无浏览器自动化，待用户实测确认（历史先例同款处理，不阻塞提交）

## 关键参考

- `src/engine/xiangqi/ai.ts`：POSITION_BONUS.pawn（L36-48）、getPositionBonus（L147-152）、findBestMove（L658-725）
- `src/views/XiangqiView.vue`：undoMove（L847-873）、scheduleAIMove（L628-663）、showHint（L454-484）、难度参数（L468-476 / L646-654）
- `src/composables/useXiangqiAI.ts`：SearchParams（L7-13）、requestSearch（L40-53）
- `src/workers/xiangqi-ai.worker.ts`：search 消息（L15-19）
- `tests/test-xiangqi.cjs`：Suite 36（L1381-1447，结构评估断言位置）
- `docs/system_design.md` L93 难度参数说明

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude（实现） | 全部实现：兵表重写 + minDepth（硬截止 2×时限）+ undo 同步/重调度 + 调度兜底 + Suite 37；测试 419/419、build 零错误、minDepth 时长语义实测验证 | 浏览器冒烟（AI 挺兵/悔棋重调度/慢设备）待用户实测确认；P3 已登记 BACKLOG #17-19 |
| R2 | Claude（review） | git diff 全量审查：P0/P1/P2 清零，无 P0/P1 遗留；Review Checklist 逐项核对通过；顺手修 ai.ts 过时注释（历史窗口 8→32 半步） | 浏览器冒烟待用户确认（不阻塞，历史先例） |

<!-- Review 结果写法（四级分级）：
  🔴 P0 正确性（阻塞，必须修）
  🟡 P1 规范（阻塞，必须修）
  🔵 P2 打磨（顺手修，不进 backlog）
  ⚪ P3 可选（进 backlog）
-->
