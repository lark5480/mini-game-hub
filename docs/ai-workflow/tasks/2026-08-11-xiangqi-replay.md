# 任务模式：细（micro）

## 任务目标
为中国象棋（本地双人 + 人机模式）新增复盘演示能力：点击棋谱条目回退棋盘局面 + 自动播放（三档速度）+ 逐手回放。联机模式不做（已拍板）。

## 文件级修改点
| 文件 | 修改内容 | 完成 |
|------|---------|:----:|
| src/views/XiangqiView.vue | 脚本区：新增 playSpeed/playing/playTimer 状态；新增 goToStart/stepBack/stepForward/togglePlay/tick/cycleSpeed/stopPlayback/exitReview 函数；reviewMoveAt 追加局面切换；openNotation 追加 AI 调度清理；closeNotation 追加 exitReview；handleTap 加回放守卫；resetGame/onUnmounted 加 stopPlayback | ✅ |
| src/views/XiangqiView.vue | 模板区：local/ai 两处——XiangqiBoard :interactive 加 reviewMove 条件、controls-row 加「棋谱」按钮、悔棋/求和/提示按钮 disabled 追加回放条件、notation-panel 加控制条 | ✅ |
| src/views/XiangqiView.vue | 样式区：.notation-controls / .nc-btn | ✅ |
| docs/system_design.md | 象棋引擎章节补一句复盘演示能力 | ✅ |

## 验收标准
- [x] npm run build 零错误
- [ ] 终局后「查看棋谱」：点条目棋盘回退该步 + from/to 高亮；◀▶ 逐手；▶ 自动播放三档速度；⏮ 回开局
- [ ] 对局中 controls-row「棋谱」：回放历史 → 关闭面板棋盘恢复现场（当前局面）
- [ ] AI 模式轮到 AI 时开棋谱 → AI 不走子；关闭后 AI 恢复走子
- [ ] 回放中 P 暂停 → 播放空转不前进；恢复后继续
- [ ] 回放中悔棋/提示/求和/走子全部不可用

## Review Checklist
- [ ] 正确性：positions 索引对齐（moves[i] ↔ positions[i+1]）、播放边界（末手停/空谱禁用）、AI 调度恢复、定时器清理
- [ ] 正确性：回放退出恢复现场（board=positions 末尾、lastMove、reviewMove=null）
- [ ] 规范：引擎五文件零改动；联机视图零改动；复用 reviewMove 判定不新增冗余状态
- [ ] build 零错误；noUnusedLocals 无残留

## 关键参考
- src/views/XiangqiView.vue：L286 reviewMove、L340-353 notationList/highlightPositions、L490 reviewMoveAt、L496 openNotation、L504 closeNotation、L567 handleTap、L721 undoMove（AI 清理样板）、L763 resetGame、L415 onUnmounted

## 实现细节（细模式专有）

### 新增状态（L286 附近）
```ts
const playSpeed = ref<800 | 500 | 250>(500)   // 播放速度三档
const playing = ref(false)                     // 播放中
let playTimer: ReturnType<typeof setInterval> | null = null
```

### 改造 reviewMoveAt（L490）
- 开头 stopPlayback()
- 追加：board.value = positions.value[index + 1]；lastMove.value = gameRecord.value.moves[index] ?? null；clearSelection()

### 新增回放函数
- goToStart：stopPlayback；reviewMove=null；board=positions[0]；lastMove=null
- stepBack：reviewMove===null return；index-1<0 走 goToStart；否则 reviewMoveAt(index-1)
- stepForward：reviewMove===null 走 reviewMoveAt(0)；否则 index+1>=moves.length return；否则 reviewMoveAt(index+1)
- togglePlay：取反 playing；开始：reviewMove===null 先 reviewMoveAt(0)，已在末手先 goToStart 再 reviewMoveAt(0)，setInterval(tick, playSpeed)；停止 clearInterval
- tick：paused.value 时空转；reviewMove+1>=moves.length 停；否则 reviewMoveAt(reviewMove+1)
- cycleSpeed：800→500→250→800；playing 时重启 interval
- stopPlayback：playing=false；clearInterval 置 null
- exitReview：stopPlayback；reviewMove=null；board=positions[positions.length-1]；lastMove=末手??null；clearSelection；clearHint；若 mode==='ai' && !gameOver && currentSide===aiSide → scheduleAIMove()

### 改造 openNotation（L496）
- 追加：aiSeq++; cancel(); if (aiTimer) { clearTimeout(aiTimer); aiTimer = null }; aiThinking.value = false

### 改造 closeNotation（L504）
- 追加 exitReview()（原 showNotation=false + 终局恢复 gameOverDialog 保留）

### handleTap（L567）
- 开头加 if (reviewMove.value !== null) return

### resetGame / onUnmounted
- resetGame 加 stopPlayback()；onUnmounted(dispose) 追加 stopPlayback()

### 模板（local + ai 两处同步）
- :interactive 追加 && reviewMove === null
- controls-row 加：<button class="ctrl-btn" :disabled="notationList.length === 0" @click="openNotation">棋谱</button>
- 悔棋 disabled 追加 || reviewMove !== null；local 求和 / ai 提示 disabled 各追加 || reviewMove !== null
- notation-panel 的 .notation-header 下方加：
```html
<div class="notation-controls">
  <button class="nc-btn" :disabled="reviewMove === null" @click="goToStart">⏮</button>
  <button class="nc-btn" :disabled="reviewMove === null" @click="stepBack">◀</button>
  <button class="nc-btn" :disabled="notationList.length === 0" @click="togglePlay">{{ playing ? '⏸' : '▶' }}</button>
  <button class="nc-btn" :disabled="reviewMove !== null && reviewMove >= notationList.length - 1" @click="stepForward">▶▶</button>
  <button class="nc-btn" @click="cycleSpeed">{{ playSpeed === 800 ? '慢' : playSpeed === 500 ? '中' : '快' }}</button>
</div>
```

### 样式
- .notation-controls / .nc-btn（对齐 .notation-item 霓虹风格，紧凑行高）

## 修复方案（review 阶段追加，粗模式可改为「执行调整」）
实施中自查修复：
1. togglePlay 先置 playing=true 再调 reviewMoveAt → reviewMoveAt 内 stopPlayback 把 playing 重置导致播放状态错乱；改为位置处理在 playing 置位之前
2. 空棋谱时 stepForward 按钮 disabled 漏 notationList.length === 0 → 点击 reviewMoveAt(0) 读 positions[1]=undefined；修复按钮条件 + reviewMoveAt 加越界防御

## 交接记录（每轮更新）
| 轮次 | 执行者 | 结果 | 遗留问题 |
|------|--------|------:---------|
| R1 | Codex | build 零错误；引擎零改动未跑回归测试（按用户惯例环境会卡死，跳过）；手动冒烟未做 | 冒烟清单 5 项待验证 |
