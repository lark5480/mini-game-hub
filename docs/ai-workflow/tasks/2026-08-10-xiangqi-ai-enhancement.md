# 任务：中国象棋 AI 加强 — 静态搜索 + 迭代加深（消除水平线效应）

> 模式：**粗（macro）** —— 引擎层 AI 重写 + 视图层难度参数接入 + 测试覆盖。
> 日期：2026-08-10
> 背景：用户反馈困难模式"不够聪明"。诊断发现旧 AI（固定深度 3 minimax + 纯静态评估）存在严重水平线效应：开局第一步贪炮打马（炮 450 换马 400 净亏，对方车反吃在搜索边界外被误判为净赚）。
> 约定：任务文件创建即登记，state.json 的 `current_task` 指向本文件 `<date>-<slug>`（去 `.md`）。

---

## 任务目标

重写 `src/engine/xiangqi/ai.ts`，在不改规则引擎的前提下显著提升 AI 棋力：
- 静态搜索（Quiescence Search）：叶子沿吃子线延伸，消除"吃子后立刻被反吃"的误判；被将时延伸所有应将着法
- Negamax + Alpha-Beta + MVV-LVA 走法排序：提升剪枝效率，同等耗时搜更深
- 迭代加深 + 可选时限：困难模式在时间预算内逐层加深，超时回退已完成深度的最佳着法
- 杀棋距离分：偏好速杀、拖延被杀

---

## 约束（明确不改什么）

- **不动规则引擎**：`rules.ts` / `types.ts` / `notation.ts` 一律不改
- **纯引擎层**：`ai.ts` 零 Vue/DOM 依赖
- **接口兼容**：`findBestMove(board, side, depth)` 旧签名可用（depth 默认 3，新增可选 `timeLimitMs`）
- **不动联机版** `XiangqiOnlineView.vue`（真人对战不涉及 AI）
- **不动** `games.ts`、router、stores、achievements、其他游戏
- 不引入新依赖，不新增测试框架（沿用 `tests/*.cjs`）
- 简单模式保持"可被新手击败"的定位与响应速度（固定深度 2，<300ms）

---

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | 全量重写：negamax + alpha-beta、MVV-LVA 排序（吃子 `100000 + victim*10 - attacker`，非吃子按位置增益）、静态搜索（stand-pat + 吃子延伸，被将时搜索全部应将着法，上限 12 层）、迭代加深时限（每 1024 节点查时，超时抛 `SearchTimeout` 保留上层结果）、杀棋距离分（`MATE=1000000`，`-(MATE-ply)`）；保留 `isGameOver` 导出 | [x] |
| `src/views/XiangqiView.vue` | 仅两处难度参数：`scheduleAIMove` 困难改 `findBestMove(board, aiSide, 6, 1800)`（简单仍深度 2）；`showHint` 困难改 `findBestMove(board, humanSide, 6, 1200)` | [x] |
| `tests/test-xiangqi.cjs` | Suite 29「AI 战术」11 断言：吃悬子、避保子陷阱、一步取胜（含终局返回 null）、开局不贪炮打马（回归）、着法合法性 | [x] |

---

## 验收标准

- [x] 旧签名 `findBestMove(board, side, depth)` 兼容，无 timeLimit 时行为确定（无时限=固定深度）
- [x] 简单模式固定深度 2，单步实测 ≤200ms（开局 6 步 max 184ms）
- [x] 困难模式迭代加深至多 6 层、限 1.8s；提示限 1.2s；超时回退已完成深度结果，不返回 null（除非无子可走）
- [x] 静态搜索生效：不贪吃有保护子（车换马陷阱）；吃悬子果断
- [x] 开局纪律回归：深度 2 不再走炮打马（旧版必走）
- [x] 杀棋距离分：能一步取胜的局面立即取胜（将死/困毙均算）
- [x] `node tests/test-xiangqi.cjs` 358/358 通过；`npm run build` 零错误
- [x] 强度对照：新 AI 执红将死旧 AI（深度 3），执黑逼平

## Review Checklist（粗模式：架构合规 + 正确性）

- [x] `ai.ts` 零 Vue/DOM 依赖；仅 import `types` 与 `rules` 的既有导出
- [x] 模块级搜索状态（`searchNodes` / `searchDeadline`）每次 `findBestMove` 入口重置，无跨调用泄漏
- [x] `SearchTimeout` 仅在迭代加深根部捕获，其余位置向上抛
- [x] negamax 符号约定一致：静态搜索 stand-pat、被将分支、困毙返回值 `-(MATE-ply)` 均按走子方视角
- [x] MVV-LVA 排序：吃子恒优先于非吃子（`100000` 基差大于任何位置增益差）
- [x] 视图层 diff 仅限两处难度参数与注释，无其他逻辑改动
- [x] 无 `@keyframes` 新增、无样式改动、无 composable 新建（本任务不涉及）
- [x] `noUnusedLocals` / `noUnusedParameters` 合规（build 已过，复核 diff 无游离代码）

## Review 结论（2026-08-10，Claude 基于 git diff）

| 级别 | 数量 | 说明 |
|------|------|------|
| 🔴 P0 | 0 | negamax 窗口传递、静态搜索符号约定、超时回退、杀棋距离分逐项复核无误；困毙=负符合棋规 |
| 🟡 P1 | 0 | 引擎层零 Vue 依赖、无新建应复用设施、无游离代码 |
| 🔵 P2 | 1 | `applyMoveForAI` 与 `rules.applyMove` 形似重复，实为**有意的浅拷贝优化**（rules 走 cloneBoard 深拷贝每子）；已补注释说明刻意不复用，防止后人误"去重"引入性能退化 —— **已修** |
| ⚪ P3 | 3 | 见下，已登记 BACKLOG #12-#14 |

P3 清单：
- AI 不感知重复局面裁决（对人局 AI 自身长捉/长将可能触发判负；搜索内无 repetition avoidance）
- 困难模式同步搜索阻塞主线程 ≤1.8s（提示按钮 ≤1.2s）；后续可 Web Worker 化
- 评估仅子力+PST：无机动性/王安全项；无开局库/置换表/killer-history 启发

**P0+P1 清零，P2 已修，P3 已登记 → 可提交。**

> ⚠️ R3 补充（2026-08-10，用户实测报告）：R2 复核后遗漏一个 P0 —— **XiangqiView 多根节点导致返回首页白屏**（详见交接记录）。已修复并复验，不影响上文结论。

## 关键参考

- `src/engine/xiangqi/ai.ts`（重写后 ~310 行）：`moveOrderScore` L143、`quiescence` L191、`negamax` L236、`findBestMove` L272
- `src/views/XiangqiView.vue`：`showHint` L403、`scheduleAIMove` L447
- `tests/test-xiangqi.cjs`：Suite 29 位于 Summary 前
- 子力价值 / PST 表沿用旧版未改（本次只改搜索，不改评估权重）

## 已知局限（已定级 P3，登记 BACKLOG #12-#14）

- AI 不感知重复局面裁决：对人局可能陷入长捉循环触发己方判负（搜索内无 repetition avoidance）
- 无开局库、无置换表、无 killer/history 启发；评估仅子力+PST（无机动性/王安全项）
- 困难模式主线程阻塞 ≤1.8s，思考动画依赖合成器线程（与旧版一致的取舍）

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:|---------|
| R1 | Claude（用户授权直接实现） | 实现完成：测试 358/358、build 零错误、新旧对局 1 胜 1 平 | 待 Claude 基于 git diff 正式 review |
| R2 | Claude（review） | P0=0 P1=0 P2=1（已修：浅拷贝注释）P3=3（登记 BACKLOG #12-#14）；P2 修后复验 358/358 + build 过 | 无，可提交 |
| R3 | Claude（用户实测报告 → 修复） | **新发现 P0 已修**：AI 模式返回首页白屏。根因：`XiangqiView.vue` 模板双根节点（`<GameLayout>` 与 `<PauseOverlay>` 平级）→ `App.vue` 的 `<Transition mode="out-in">` 无法对 fragment 执行离开动画 → leave 永不完成 → HomeView 不挂载；控制台警告 `Component inside <Transition> renders non-element root node`。修复：`<PauseOverlay>` 移入 `</GameLayout>` 之前（默认 slot 内，与其他游戏一致，`.pause-overlay` 为 fixed 不受布局影响）。复验：build 零错误；浏览器实测 AI 对局中点返回正常显示首页，警告消失 | 无，可提交 |
| R4 | Claude（用户实测报告 → 修复） | **新发现 P0 已修**：本地双人每走一步棋盘翻转。根因：`XiangqiBoard` 的 `:flipped="currentSide === 'black'"` 绑定回合方，每步切换回合导致视角跟着翻转（首版遗留，AI 模式 `humanSide`、联机 `myRole` 均为固定视角，唯独本地双人动态翻转）。修复：改为 `:flipped="false"` 固定红方视角。复验：build 零错误；浏览器实测红/黑各走一步均不翻转，红方始终在下 | 无，可提交 |
