# 任务模式：粗（macro）

## 任务目标
中国象棋 AI 评估函数增强：在「子力 + PST」基础上新增轻量结构评估项（车半开放线/开放线、连兵/孤兵/叠兵、王翼兵保护），全部在 evaluateBoard 单遍扫描内 O(1) 收集与计算（无走法生成、无二次全盘扫描，规避 R2 性能教训）；权重总影响 < 1 个兵，不颠覆子力主导；导出 evaluateBoard 供 Suite 36 行为断言，测试与构建全回归。

## 背景与决策
- 用户确认开局库（BACKLOG #14 开局库部分已完成）后选择评估项优化方向（#14 剩余：王翼兵形细化、车半开放线）。
- 现状：evaluateBoard = 子力 + PST 单遍全盘扫描；R2 曾因热路径性能移除机动性/王安全（每叶子 2 次全量 generateMoves + findKing 扫描）。
- 关键决策：
  - 零额外扫描：新特征在现有单遍扫描内顺带收集（兵列位图 bitmask、车所在列计数、王位置），结构评估为 O(1)-O(9) 查表。
  - 权重宁小勿大：总影响 < 1 个兵（100 分），不翻转现有战术断言（Suite 29 均为 MATE/子力主导场景，初始局面红黑对称 eval=0）。
  - 导出评估函数：evaluateBoard 直接 export（先例：boardKey/isInCheckLight/findBestMove）。
  - 棋力验证边界：不做自对弈强度对比（执行环境限制，历史上已放弃），以「公认象棋特征 + 单元行为断言 + 全量回归」验收。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | 新增 6 个结构评估权重常量（ROOK_SEMI_OPEN 25 / ROOK_OPEN 15 / PAWN_CONNECTED 8 / PAWN_ISOLATED -12 / PAWN_DOUBLED -8 / KING_SHIELD 6）；evaluateBoard 重写为单遍扫描收集 + evalStructure 逐方独立计算（黑方取负）；`export function evaluateBoard` | ✅ |
| `tests/test-xiangqi.cjs` | **Suite 36 新增**（8 断言）：初始 eval=0、车半开放线 +25、全开放线 +15、孤兵 -12、连兵 +8、叠兵 -8、王翼保护 +6、红黑镜像 eval=0 | ✅ |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全通过（405 + Suite 36 新增 = **413/413**）
- [x] `npm run build`（vue-tsc + vite）零错误
- [x] Suite 29 AI 战术 / Suite 32 深搜索稳定性等既有搜索断言全部保持通过（评估增强不翻转战术行为）
- [x] 浏览器冒烟（Browser agent）：对局正常；AI 13 步连续正常（开局库零延迟命中 + 中盘 4.0s 思考），含 3 次吃子 1 次将军；提示按钮正常出提示；控制台零报错（无 evaluateBoard/evalStructure/worker 相关）；返回首页路由正常
- [x] 文档：本任务文件；state.json 指向本任务 round 1；BACKLOG #14 更新

## Review Checklist
- [x] 架构合规：评估增强仅动 evaluateBoard 内部（引擎公共接口 findBestMove 零改动）；导出仅加 evaluateBoard
- [x] 性能合规：无走法生成、无二次全盘扫描；Int8Array/Int32Array 叶子级小分配（9 元素）远低于 generateMoves 的每节点对象分配
- [x] 权重边界：总影响 < 1 个兵；初始局面红黑对称 eval=0；红黑镜像局面 eval=0（Suite 36 断言 8 验证黑方结构取负对称性）
- [x] 位图边界：掩码 & 0x3ff 截取行 0-9 有效位（b=0 时 1<<-1 高位被截断为 0，b=9 时 1<<10 被截断）；边界列 c=0/c=8 孤兵判定用 left/right 守卫变量避免 Int8Array 越界读 undefined
- [x] 战术断言回归：Suite 29（一步杀/吃悬子/长将规避）与 Suite 32（深搜索稳定性）全通过，评估增强未翻转行为

## 关键参考
- `src/engine/xiangqi/ai.ts`：结构评估权重常量（L131-140 附近）、evaluateBoard + evalStructure（L264-337 附近）
- `tests/test-xiangqi.cjs`：Suite 36（Summary 前）

## 交接记录
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| R1 | Claude（用户批准计划后实现） | 实现完成：ai.ts 评估增强（6 权重 + 单遍扫描收集 + evalStructure）+ Suite 36（8 断言）；测试 **413/413** 通过、build 零错误、既有战术断言全部保持；浏览器冒烟通过（AI 13 步正常含吃子/将军，提示正常，控制台零报错） | 无 |

<!-- Review 结果写法（四级分级）：
  🔴 P0 正确性（阻塞，必须修）
  🟡 P1 规范（阻塞，必须修）
  🔵 P2 打磨（顺手修，不进 backlog）
  ⚪ P3 可选（进 backlog）
-->
