# 任务模式：细（micro）

> 来源：用户提供真实对局棋谱（红方视角 40 手），黑 AI 单车在底线往返将军、红帅被迫往返应将，走满周期后黑方 perpetual_check 判负。Claude 逐手重放验证：① 棋谱 100% 合法解析，续走一轮后 checkRepetitionViolation 正确判黑负（数据成立）；② 当前修复后引擎在关键节点三档难度全部避开连将（hard/medium 走炮二退一、easy 走車四退二）——该局大概率在修复前版本/PWA 缓存上产生。本任务把该棋谱冻结为回归测试 + 加视图层最后防线，双保险杜绝「AI 主动犯规」。

## 任务目标
① Suite 40 冻结用户棋谱：40.1 断言棋谱续走一轮触发 `{violation, black, perpetual_check}` 裁决（数据语义）；40.2 断言第 19 回合（第 2 次连将前）引擎不选 車四退一 连将着法（修复前红）；② `scheduleAIMove` 执行前用 checkRepetitionViolation 预演 AI 着法，命中则把违规局面 key 并入 historyKeys 重搜一次（第 3 次重复分支必然惩罚），再校验重搜结果。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| `tests/test-xiangqi.cjs` | Suite 40（40 手棋谱常量 + replay 解析函数 + 40.1 裁决语义 + 40.2 引擎规避；toNotation 定位着法避免硬编码坐标；无计时断言） | [x] |
| `src/views/XiangqiView.vue` | `scheduleAIMove`：搜索参数抽为 `searchParams`；新增 `verdictForMove(move)` 预演（applyMove + checkRepetitionViolation）；命中 → 以 `boardKey(after, 对方)` 并入 historyKeys 重搜一次，重搜结果再校验（仍违规 toast 警示后照走）；aiThinking/seq 守卫与既有协议一致 | [x] |
| `docs/system_design.md` | 重复局面罚分段补「视图层裁决预演最后防线」说明 | [x] |

## 验收标准
- [x] `node tests/test-xiangqi.cjs` 全绿（443/443，含 Suite 40 新增 10 断言）
- [x] `npm run build` 零错误
- [x] 40.1：续走一轮触发裁决且 side=black / reason=perpetual_check（棋谱数据语义固化）
- [x] 40.2：第 19 回合引擎不选 車四退一 且着法合法（修复前红；断言仅排除连将着法，对套件污染稳健）
- [x] 兜底逻辑：未命中裁决时零额外开销；命中时重搜返回非违规着法；重搜仍违规时 toast 警示
- [ ] 浏览器实测（供用户）：按该棋谱下到第 17 回合后黑 AI 不再继续往返将军

## Review Checklist
- [x] replay 解析用 toNotation 双向匹配（棋谱合法性自校验），解析失败即抛错使测试响亮失败
- [x] 40.2 断言只排除连将着法（其他着法均通过），对 killer/history 污染稳健
- [x] 兜底重搜的 historyKeys 在 searchParams 快照基础上追加（board/side/depth 不变）；seq 守卫在每次 await 后执行
- [x] verdictForMove 用 applyMove 深拷贝新棋盘 + cloneBoard 快照，不污染 positions/playedMoves 真实状态
- [x] 兜底只在 AI 模式终局前执行，与 executeMove 内部 checkGameState 的正式裁决不冲突
- [x] build（vue-tsc）通过：Move 类型导入、searchParams 类型推断、boardKey 导入均无问题

## 关键参考
- `src/views/XiangqiView.vue`：scheduleAIMove（L693-773）、recentHistoryKeys、checkRepetitionViolation/applyMove/cloneBoard/boardKey 导入
- `tests/test-xiangqi.cjs`：Suite 33（historyKeys 模式）、Suite 39（用户场景模拟先例）
- 棋谱（40 手）：`炮二平五 馬二進三 馬二進三 炮八平六 車一平二 馬八進七 兵七進一 炮六進一 兵三進一 炮二進三 炮八平六 炮二平七 馬八進七 車一平二 車九進一 車九平八 車二進九 炮七進四 仕四進五 馬七退八 馬七進六 車二進九 馬六進七 炮六平三 相七進九 炮七退一 仕五退四 炮七平二 兵七進一 炮三平四 兵七進一 車二平四 帥五進一 車四退一 帥五退一 車四進一 帥五進一 車四退一 帥五退一 車四進一`；续走 `帥五進一 車四退一` 触发裁决

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Claude（实现） | 全部实现：Suite 40（棋谱解析自校验 + 裁决语义 + 引擎规避）+ 视图层 verdictForMove 最后防线；测试 443/443、build 零错误；修复前该棋谱在第 19 回合会继续连将（用户实测），修复后引擎三档难度均避开 | 浏览器实测待用户确认（不阻塞）；若用户确认最新版本仍复现，需进一步排查构建/缓存 |
