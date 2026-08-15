# 任务模式：细（micro）

> 来源：用户反馈主要 bug（长将判负/复制棋谱）已修复，询问「除不够聪明外还有哪些细节可优化」。审查盘点出 AI 模式 4 个体验缺口（本轮做）：① AI 模式不能暂停（canPause 排除 ai，PauseOverlay/ResumePrompt 为死代码）；② 无双方吃子显示；③ 提示与 AI 走子参数不一致（2s/下限3 vs 4s/下限4 → 提示建议的棋 AI 自己不走）；④ 400ms 固定延迟占比上升 + 「AI 思考中」无动效。棋力增强按用户意愿不动。

## 任务目标
A1 开启 AI 模式暂停（失焦自动暂停 + P/Esc + 暂停中取消 AI 搜索、恢复按需重调度）；A2 棋盘下方显示双方已吃棋子；A3 提示搜索参数与 AI 走子完全一致（提示 = AI 下一步会走的棋）；A4 固定延迟 400→250ms + AI 思考省略号动效。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `src/views/XiangqiView.vue` | ① `canPause` 放行 ai（`mode!=='online' && !gameOver && result===null`）+ `useGamePause` 挂 `onPause`（aiSeq++/cancel/清 aiTimer/aiThinking=false）/`onResume`（轮到 AI 则 scheduleAIMove）；② `capturedByRed/capturedByBlack` computed（playedMoves.captured 按被吃方统计）+ 两处 move-count 后加棋盒行 + 样式（红吃=黑子深色、黑吃=红子红色）；③ `showHint` 参数与 `scheduleAIMove` 对齐（hard 4000ms/minDepth 4）；④ `setTimeout(400)`→`250`；AI 模式 turn-indicator 加 `thinking` class + `.turn-label` 包裹 + `.thinking-dots`（3 个 i 元素）；turnLabel 思考态去掉手写省略号 | [x] |
| `src/styles/animations.css` | 新增 `@keyframes thinking-blink`（受全局 prefers-reduced-motion 覆盖） | [x] |
| `docs/system_design.md` | AI 模式交互说明（暂停/棋盒/提示同参数） | [x] |

## 验收标准
- [x] `npm run build`（vue-tsc + vite）零错误；`node tests/test-xiangqi.cjs` 433/433 回归绿（引擎未动）
- [x] A1 代码审查：onPause 取消 AI 调度（aiSeq++/cancel/清 aiTimer），onResume 按 currentSide 重调度，scheduleAIMove 内部守卫防双发；回调引用后续声明绑定无 TDZ（vue-tsc 通过）
- [x] A2 棋盒数据源 playedMoves.captured 与 undo/reset 同步（pop/清空）
- [x] A3 提示与走子参数逐项一致（depth/timeLimitMs/minDepth）
- [x] A4 动效 keyframes 仅放 animations.css；aria-hidden；全局 reduced-motion 覆盖
- [ ] 浏览器冒烟（待用户确认）：AI 模式失焦自动暂停/恢复续走；棋盒随吃子/悔棋更新；提示=AI 走子；思考动效可见

## Review Checklist
- [x] 暂停钩子与现有 seq/cancel/aiTimer 协议一致，onResume 重调度不双发
- [x] 闭包时序：useGamePause 回调引用 aiSeq/aiTimer/cancel/scheduleAIMove 均为运行时初始化，vue-tsc 编译通过
- [x] 棋盒红吃=黑子字符（BLACK_GLYPH）、黑吃=红子字符（RED_GLYPH），颜色语义正确
- [x] 提示同参数后「提示≠AI 走子」困惑消除；复杂局面提示最长 4s（早退兜底）
- [x] turn-label 包裹不破坏布局（white-space: nowrap）；本地双人指示器未动

## 关键参考
- `src/views/XiangqiView.vue`：useGamePause（L346-361）、showHint（L512-530）、scheduleAIMove（L706-733）、move-count（L82-96 / L210-224）、turn-indicator（L166-173）
- `src/styles/animations.css`：badge-pop 后、prefers-reduced-motion 前
- `src/composables/useGamePause.ts`：onPause/onResume 钩子

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude（实现） | A1-A4 全部实现；build 零错误、433/433 回归绿；可选 B5（战绩）/B6（续局）/B7（开局库扩充）已登记 BACKLOG #21-23 | 浏览器冒烟待用户确认（不阻塞） |
