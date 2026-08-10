# PITFALLS.md — P0/P1 根因记忆库

> BACKLOG 只留 P3，P0/P1 修完即消失——本文件记录**根因签名**。开工时按技术栈指纹召回；P0/P1 修复后必须登记根因签名。条目不删除。

## P-001 CSS 块未闭合 / 悬空属性

- 指纹：手写编辑 Vue SFC `<style>` 或原生 CSS
- 症状：缺 `}` 导致样式整体或部分失效；vite 对 CSS 语法宽容，build 可能不报错
- 修法：编辑后逐对核对花括号；build 通过之外再目视确认样式生效
- 来源：`cb8f175`（.start-btn:hover 缺闭合 brace）

## P-002 局部 @keyframes 不进共享 animations.css

- 指纹：Vue 组件新增动画
- 症状：keyframes 定义在组件 `<style>` 内，违反「动画 keyframes 统一放 src/styles/animations.css」
- 修法：keyframes 一律放 animations.css，组件内只写 animation 引用
- 来源：竞速 review P1（`93b1290` 收敛 countPop）

## P-003 计划文件越权勾选

- 指纹：Codex 更新任务文件勾选状态
- 症状：勾了 Review Checklist（归 Claude）甚至 TEMPLATE 区占位符
- 修法：勾选仅限「文件级修改点 / 验收标准」+ 追加交接记录轮次；其余区域禁动
- 来源：BACKLOG 消化任务 review（`984f090` 修复）

## P-004 联机模式本地重置不广播

- 指纹：联机对局中存在「重置 / 重开 / 重启」类入口
- 症状：本端本地重置，对端不知情 → 双端失同步，重置端可能永不结算
- 修法：凡是改变对局共享状态的动作，要么走房间广播 + 确认，要么直接隐藏该入口
- 来源：竞速 P0（`25673e7` 修复，竞速模式隐藏重启按钮）

## P-005 递归 setTimeout 链无取消 / 无卸载清理

- 指纹：倒计时、延迟状态机等递归计时逻辑
- 症状：重置或离开页面后残余计时器继续跑，把界面重新拉回对局
- 修法：保存 timer id，reset 与 onUnmounted 双路清理并复位状态
- 来源：竞速 P1（`25673e7` 修复 runCountdown）

## P-006 通用 composable 硬编码游戏专有配置

- 指纹：新建「通用」composable 且内部调用 useRealtimeRoom / 传 meta
- 症状：meta 里写死具体游戏名（如 `whackamole-race`），复用即失真
- 修法：游戏专有配置一律入参化，composable 给默认值
- 来源：竞速 P2（`25673e7` game 标签入参化）

## P-007 tsc 编译产物混入 src 目录被 Vite 优先解析

- 指纹：执行 tsc 编译（引擎测试机制）时命令行 glob 传文件 / 覆盖 outDir/rootDir 参数失效
- 症状：`Uncaught SyntaxError: The requested module '.../types.js' doesn't provide an export named: 'COLS'`——`.js` 扩展名解析优先级高于 `.ts`，CJS 产物（`exports.COLS = 9`）被当 ESM 加载导致命名导出缺失；git status 出现 `?? src/**/*.js`
- 修法：编译产物一律输出到 gitignored 目录（如 tests/.tmp-xiangqi）；tsc 用固定 tsconfig 的 outDir，不用 glob 传文件、不依赖命令行覆盖 outDir/rootDir；出现该报错先查 src 下是否 .js/.ts 并存，删除污染 .js 后硬刷新
- 来源：2026-08-10-xiangqi-ai-strength-boost（用户实测 COLS 报错，误将 4 个 CJS 产物生成进 src/engine/xiangqi/）
