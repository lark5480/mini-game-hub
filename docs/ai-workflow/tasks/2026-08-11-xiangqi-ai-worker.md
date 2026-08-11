# 任务模式：粗（macro）

## 任务目标
象棋 AI 搜索 Web Worker 化：主线程零阻塞 + hard 时限放宽（5.7→6 层），为后续深度类优化解锁时限自由度；引擎最小侵入（可取消搜索标志），测试全回归。

## 背景与决策
- 用户实测确认 R1-R4 后问下一步方向：开局库 vs Web Worker。分析结论：Worker 是唯一「体验 + 棋力」双收益方向（当前每步 AI 思考 2.5s 主线程冻结、动画靠合成器线程硬撑；hard 卡在 d6 陡坡 4.1s 的 5.7 层，放宽时限必须异步）；开局库只改开局几步、对棋力零提升，留作后续可选小轮。用户授权执行者决定方向 → **Web Worker（BACKLOG #13）**。
- 关键约束：ai.ts 模块级 TT/killer/history 跨调用保留是「同对局内搜更深」的支柱，**取消不能用 worker.terminate()（丢 TT）**，必须用引擎内中断标志（tickTimeout 每 4096 节点已检查一次，注入成本最低）。
- worker 文件不能放 `src/engine/xiangqi/`（tsconfig.xiangqi.json include 该目录且 lib 仅 ES2020，无 WebWorker/DOM 类型会编译失败），放 `src/workers/`。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/engine/xiangqi/ai.ts` | 模块级 `cancelRequested` 标志 + `export cancelSearch()`；`tickTimeout()` 检查 `cancelRequested` 抛 SearchTimeout（复用超时路径）；`findBestMove` 入口重置标志。引擎其余逻辑零改动，公共签名不变 | ✅ |
| `src/workers/xiangqi-ai.worker.ts` | **新增**。`/// <reference lib="webworker" />`；协议：`search { id, board, side, depth, timeLimitMs, historyKeys }` → `result { id, move }`；`cancel` 调 `cancelSearch()` | ✅ |
| `src/composables/useXiangqiAI.ts` | **新增**。调度器：`new Worker(new URL(...), { type: 'module' })`；`requestSearch`（先 post cancel 再 post search，seq 丢弃过期结果）/ `cancel` / `dispose`（terminate + 拒绝挂起 Promise） | ✅ |
| `src/views/XiangqiView.vue` | 移除 `findBestMove` 直调，改 `requestSearch`；`scheduleAIMove` / `showHint` 异步化 + seq 防竞态 + `hintThinking` 防连点；取消点（悔棋/认输/重开/离开/clearHint）各加 `cancel()` + `aiSeq++`；`onUnmounted(dispose)`；hard 时限 2500→4000ms、hard 提示 1200→2000ms | ✅ |
| `tests/test-xiangqi.cjs` | **Suite 34 新增**（4 断言）：cancel 后搜索正常（入口重置）、重复 cancel 幂等、cancel 间隙后结果稳定一致 | ✅ |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全通过（391 + Suite 34 新增 = **395/395**）
- [x] `npm run build`（vue-tsc + vite）零错误；构建输出含独立 worker chunk，且被 workbox precache 收录（73 entries 含 `xiangqi-ai.worker-*.js`）
- [x] 浏览器实测（2026-08-11 用户确认）：AI 思考时主线程零阻塞（动画流畅、可交互）；hard 实际深度 ~6 层（4000ms 达 d6）；走子/悔棋/重开/离开即时响应无残留；连续对局棋力不降（TT 保留验证）；提示不卡 UI
- [x] 引擎公共接口向后兼容：`findBestMove` 签名不变，仅新增 `cancelSearch` export
- [x] 文档：本任务文件；state.json 指向本任务 round 1；BACKLOG #13 状态更新

## Review Checklist
- [x] 架构合规：引擎（ai.ts）零行为变更，仅加取消标志；调度逻辑全在 composable/worker 层，分层清晰
- [x] 竞态安全：AI 走子 `aiSeq` + await 后状态校验双保险；提示 `hintSeq` 防过期；worker 级 seq 丢弃旧结果；dispose 拒绝挂起 Promise
- [x] 取消不丢 TT：杜绝 terminate 方案（仅 dispose 时 terminate，此时组件已卸载）
- [x] 命名/风格：与项目一致（composable 导出函数、模块级状态注释、中文注释）
- [x] 正确性：Suite 34 覆盖取消生命周期；build 零错误；worker chunk 打包 + precache 收录已验证

## 关键参考
- `src/engine/xiangqi/ai.ts`：搜索状态区（L192-205）、`tickTimeout`、`findBestMove` 入口（L601-604）
- `src/views/XiangqiView.vue`：`scheduleAIMove`（L500-521）、`showHint`（L427-447）、`clearHint`（L451-456）、取消点（undoMove/surrender/resetGame/goHome）
- `tests/test-xiangqi.cjs`：Suite 33（L1256-1303）为 Suite 34 的上下文范本
- `tsconfig.xiangqi.json`：include 仅 `src/engine/xiangqi`（worker 必须放外部目录的原因）

## 交接记录
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------|---------|
| R1 | Claude（用户批准计划后实现） | 实现完成：ai.ts 取消标志 + worker + useXiangqiAI 调度器 + 视图异步化/取消点 + 时限调整 + Suite 34；测试 **395/395** 通过、build 零错误、worker chunk 已入 precache | 浏览器实测待用户确认（非阻塞）：零阻塞/深度 ~6 层/即时响应无残留/TT 保留 |
| R2 | Claude（浏览器实测发现 P0 后修复） | 🔴 P0：`requestSearch` 的 postMessage 抛 `DataCloneError: [object Object] could not be cloned` —— `board.value` 是 Vue 响应式 Proxy，结构化克隆无法克隆 Proxy。症状：AI 先手（困难模式）不走子，且 await 抛错后 `aiThinking` 永不重置（永久卡在思考中）。修复：`toPlainBoard()` 深拷贝棋盘为纯对象（`board.map(row => row.map(p => p ? { ...p } : null))`，worker 端只读无需响应式）+ postMessage try/catch 拒绝并清理 pending 防悬挂。复测：困难模式 AI 先手首步正常（炮八進七吃马，~4s）、第二步正常、控制台零报错、UI 无卡顿。测试 395/395 仍全通过、build 零错误 | 无 |

<!-- Review 结果写法（四级分级）：
  🔴 P0 正确性（阻塞，必须修）
  🟡 P1 规范（阻塞，必须修）
  🔵 P2 打磨（顺手修，不进 backlog）
  ⚪ P3 可选（进 backlog）
-->
