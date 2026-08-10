# 任务：中国象棋单机版 UX 增强（A 棋谱 + B 翻转 + C 提示 + D 复盘/和棋）

> 模式：**粗（macro）** —— 多文件 UX 增强，给约束与落点，执行者自主实现细节。
> 日期：2026-08-10
> 关联分析：无（独立优化项，源自「中国象棋 UX 优化点」梳理）
> 约定：任务文件创建即登记，state.json 的 `current_task` 指向本文件 `<date>-<slug>`（去 `.md`）。

---

## 任务目标

给中国象棋**单机版（本地双人 + 人机）**补齐四项体验增强：

- **A 棋谱面板 + 中文记谱**：每步实时显示中文记谱（炮二平五、马八进七），下完能回看本局。
- **B 本地双人对弈翻转棋盘**：轮到黑方时棋盘自动翻转，黑方在自己视角下方行棋（现成 `flipped` 机制，本地模式未接）。
- **C 人机「提示一步」**：玩家回合可点「提示」，高亮引擎推荐的一步，不自动落子。
- **D 终局复盘 + 本地双人和棋**：终局弹窗加「查看棋谱」入口；本地双人可发起「提议和棋」。

---

## 约束（明确不改什么）

- **不动引擎规则层正确性**：`generateMoves / applyMove / isInCheck / getGameStatus / classifyMove / isPinned` 一律不改，只**新增** `toNotation` 纯函数。
- **不动联机版** `XiangqiOnlineView.vue`：翻转、观战、重连已完整，本次只动单机。
- **不动** `src/lib/games.ts`（注册）、`router`、`stores`、`achievements`。
- **不引入新依赖**，不新增测试框架（沿用 `tests/*.cjs` 手写 node 脚本）。

---

## 文件级修改点

| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/rules.ts`（或新建 `notation.ts` 并 re-export） | 新增 `toNotation(move: Move, board: Board): string` 中文记谱纯函数 | [x] |
| `src/views/XiangqiView.vue` | **A**：侧栏棋谱列表，从 `gameRecord.moves` 实时渲染；点击某步可定位/高亮该步 | [x] |
| `src/views/XiangqiView.vue` | **B**：本地双人模式给 `<XiangqiBoard>` 传 `:flipped="currentSide === 'black'"`；加手动翻转切换按钮（可选） | [x] |
| `src/views/XiangqiView.vue` | **C**：人机模式新增「提示」按钮，调 `findBestMove(board, humanSide, depth)` 得一步并高亮 | [x] |
| `src/components/XiangqiBoard.vue` | 新增 `:hint?: {from,to} | null` prop，画提示标记（复用 selected/lastMove 的描边样式） | [x] |
| `src/views/XiangqiView.vue` | **D**：终局 `GameDialog` 加「查看棋谱」按钮（复用 A 列表）；本地双人加「提议和棋」入口与确认流 | [x] |
| `tests/test-xiangqi.cjs` | **A-2**：新增 Suite 验证 `toNotation`（7 种棋子典型步 + 吃子步 + 红黑视角列序） | [x] |

---

## 验收标准

- [x] **A-1**（如 炮二平五、马八进七），红黑按回合成对显示。
- [x] **A-2** + 进/退/平 + 吃子均正确；`tests/test-xiangqi.cjs` 至少 20 个样例断言通过。
- [x] **A-3**，与 `board` / `lastMove` / `history` 完全一致（不出现「棋谱比棋盘多一步」）。
- [x] **B-1**，黑方棋子位于己方视角下方；点击命中仍「点哪打哪」无偏移。
- [x] **B-2**，不抖动、不丢失选中态。
- [x] **C-1**（`currentSide !== aiSide && !aiThinking && !gameOver`），点击后高亮引擎推荐一步（from 描边 + to 落点标记）。
- [x] **C-2**；玩家可忽略提示继续自己走，或走提示步均可。
- [x] **D-1**，点击展开本局完整棋谱（复用 A 的列表组件）。
- [x] **D-2**，对方确认后判和（`result = 'draw'`），触发现有和棋弹窗。
- [x] **D-3**（仅本地双人）；联机模式行为不变。
- [x] **Z**，无 TS `noUnusedLocals` / 类型报错；`npm test` 全绿（含新增记谱 Suite）。

---

## Review Checklist（架构合规）

- [ ] `toNotation` 为纯函数：输入 `Move` + `Board`，输出 `string`，**零 Vue/DOM 依赖**（放 `engine/xiangqi/`，与 `rules.ts` 同层）。
- [ ] `flipped` 复用现成机制（`XiangqiBoard` 渲染层 `viewRow/viewCol` + 命中层 `flipIndex` 已支持），**不新写翻转逻辑**。
- [ ] 不新增全局状态污染；棋谱列表唯一数据源为 `gameRecord`（已存 localStorage，见 `XiangqiView.vue:212,397-399`）。
- [ ] 中文记谱视角正确：红方按红视角列序（col 大端为「一」→ `redCol = 9 - col`）、黑方按黑视角列序（col 小端为「一」→ `blackCol = col + 1`）；进/退规则与惯例一致（车/炮/兵/帅跟步数，马/象/士跟落点列）；单测覆盖红黑两个视角。
- [ ] 提示高亮通过新增 `:hint` prop 实现，**不滥用** `selected` / `legalTargets`（那两个语义是「当前选中/可走」，hint 是「建议」）。
- [ ] 「提议和棋」仅在 `mode === 'local'` 生效，不侵入 `ai` / `online` 分支。

---

## 关键参考（执行者必读，含行号）

- `src/views/XiangqiView.vue:43-51` —— 本地双人 `<XiangqiBoard>` **未传 `:flipped`**（B 的唯一改动点：加 `:flipped="currentSide === 'black'"`）。
- `src/views/XiangqiView.vue:186` —— rules 导出清单（`initialBoard, generateMoves, applyMove, isInCheck, getGameStatus, classifyMove, isPinned`），`toNotation` 在此追加 import/export。
- `src/views/XiangqiView.vue:212, 397-399` —— `gameRecord` 结构（`{ moves: Move[], sides: Side[] }`）与 localStorage 写入（A 的数据源，目前只写不读）。
- `src/views/XiangqiView.vue:187, 304` —— `findBestMove(board, side, depth)` 已导入并在 `scheduleAIMove` 调用（C 复用，depth 取 `difficulty==='easy'?2:3`）。
- `src/components/XiangqiBoard.vue:22, 25` —— `flipped` prop 已定义（`withDefaults`，默认 `false`）。
- `src/components/XiangqiBoard.vue:57-62, 354-355` —— `viewRow/viewCol` 与命中层 `flipIndex` 已实现翻转，渲染与命中共用，保证点哪打哪（B 只传 prop 即可）。
- `src/components/XiangqiBoard.vue:279-304` —— `drawHighlights` 现有 lastMove/legalTargets 描边样式，hint 标记可参照。
- `src/engine/xiangqi/types.ts:7-25` —— `PieceType` / `Side` / `Move` / `Position` 形状（`toNotation` 字段依据）。
- `src/components/XiangqiBoard.vue:241` —— `getPieceLabel` 已有的红黑棋子汉字（记谱函数参考其映射表，但在 `engine/xiangqi/notation.ts` 内**自建**汉字映射，避免引擎层反向依赖 Vue 组件）。
- `tests/test-xiangqi.cjs` —— 现有 26 个 Suite，新记谱 Suite 接在末尾（A-2 落点）。

---

## 实现细节（记谱算法，给执行者参考，非强制）

中文记谱 MVP 规则（以「红黑各自视角」为准，不追求专业棋谱软件的全部歧义消歧）：

1. **棋子名**：复用 `getPieceLabel` 映射 —— 红 帥仕相馬車炮兵 / 黑 將士象馬車炮卒。
2. **列序**：以「该方自身视角」从右到左记 一 二 三 … 九。
   - 红方（row 7-9）视角：最右列 col=8 记为「一」，最左 col=0 记为「九」→ `redCol = 9 - col`。
   - 黑方（row 0-2）视角：同理 `blackCol = col + 1`（黑方 col 小端为「一」，即 col=0 → 一）。
   - *注：上述映射为简化约定，执行时用单测对齐到常见记谱（如「炮二平五」中「二/五」指红方第 2/5 列），不对齐到全部专业细则。*
3. **走法动词**：
   - **平**：横向移动（col 变、row 不变，如车/炮/帅/兵平移）→ `<名><起列><平><落列>`（例：炮二平五）。
   - **进**：向前（朝对方阵营）→ `<名><起列><进><步数或落点列>`。
   - **退**：向后 → `<名><起列><退><步数或落点列>`。
   - **车/炮/兵/帅**的进/退后跟**步数**（纵向格数，如车二进六）；平跟**落点列**。
   - **马/象/士**的进/退后跟**落点列**（如马八进七）；无平。
   - 以上与标准中文记谱惯例一致（横向记落列、纵向记步数）；单测覆盖各棋子典型步。
4. **吃子**：棋谱文本保持「名+列+动词+目标」，列表 UI 用不同颜色/「×」标识吃子步（`move.captured` 已知）。

> 记谱细节允许执行者微调，但**必须**有 `tests/test-xiangqi.cjs` 的 Suite 覆盖 7 种棋子典型步 + 至少 2 个吃子步 + 红黑各一视角，保证不假绿。

---

## 修复方案（review 阶段追加）

（空，待 review 填写）

---

## 交接记录（每轮更新）

| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| 1 | — | 文档创建，待认领 | — |
| 2 | Codex（执行） | 完成：toNotation + 棋谱面板 + 翻转 + 提示 + 复盘/和棋 + 单测 20 样例全绿 | 无 |
| 3 | Codex（修复） | P0：notationList 改用预计算数组（落子前算记谱）；P2：AI 模式去掉 :flipped；测试补至 20 断言 | 无 |
