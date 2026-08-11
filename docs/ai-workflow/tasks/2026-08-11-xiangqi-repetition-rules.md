# 2026-08-11-xiangqi-repetition-rules — 重复局面裁决补强（杀 + 长周期）

- 任务模式：macro（粗模式）
- 创建：2026-08-11
- 对应计划：`xiangqi-repetition-rules_4c4e7560.md`
- BACKLOG 来源：#10（不识别杀）、#11（不判长周期循环）

## 背景

`checkRepetitionViolation` 仅覆盖周期 4 的长将/长捉/一将一捉；「杀」按闲处理（一将一杀误判和）、周期 >4 的长循环不触发。本期补强：新增「杀」分类 + 周期扫描泛化 4..32。

关键决策（详见计划）：
- 杀判定 = 1 层搜索（对方所有应着后我方都有将死/困毙着法），仅重复触发时执行（低频路径）
- 周期扫描 P ∈ {4, 6, ..., 32}，P=4 行为与现状一致
- 优先级简化边界：将 > 杀 > 捉 的混合优先级不在本期范围（双方混合双打判和）
- AI 历史窗口联动：`recentHistoryKeys` 8 → 32 半步

## 文件级修改点

| 文件 | 改动 | 完成 |
|------|------|------|
| `src/engine/xiangqi/rules.ts` | 新增 `isMateThreat`（1 层杀判定）；`RepetitionVerdict.reason` 扩展 `perpetual_mate`；`checkRepetitionViolation` 周期泛化（MAX_PERIOD=32）+ StrikeClass 四分类（check/mate/chase/idle）+ 判罚扩展；文件头注释同步 | ✅ |
| `src/views/XiangqiView.vue` | 长杀文案两处（Toast + 结算弹窗）+ `violationReason` ref 类型扩展；`recentHistoryKeys` 窗口 8→32 半步 | ✅ |
| `tests/test-xiangqi.cjs` | Suite 28 扩展 28.9-28.14（一将一杀/纯长杀/长杀vs长捉/周期8长捉/周期8双方闲/周期8长将） | ⛔ 用户指示跳过（构造验证脚本在受限环境卡死） |

## 验收标准

1. `node tests/test-xiangqi.cjs` 全通过 —— **部分完成**：r1/r2 落地后跑过 413/413 回归通过；新增 6 断言未添加（用户指示跳过，见上表）
2. `npm run build`（vue-tsc + vite）零错误 —— ✅ 已通过（顺带修复 build 拦截的 `violationReason` 类型遗漏）
3. 浏览器冒烟 —— ⛔ 跳过（非阻塞项，用户指示）
4. 文档收尾：任务文件 + state.json + BACKLOG #10/#11 —— ✅ 本文件 + BACKLOG 更新；state.json 复位（当时已是 idle 态）

## Review Checklist（Claude 用）

- [ ] 正确性：周期扫描从 4 起取最小成立周期，28.6（着法不同不判）/28.7（半步不足不判）语义保持
- [ ] 正确性：isMateThreat 严格定义（对方所有应着后都有杀着），`oppMoves.length === 0` 时不算杀
- [ ] 正确性：长将优先逻辑保持（一方全将另一方非全将 → 全将方负）
- [ ] 规范：无新建 composable/组件，改动仅在 rules.ts + 视图层
- [ ] 边界：简化优先级在代码注释与 BACKLOG #10 显式留痕

## 交接记录

### R1（2026-08-11，Claude 执行）

- 状态：实施完成，build 零错误，413/413 回归通过（断言添加前）
- 遗留：
  1. Suite 28.9-28.14 未添加（用户指示跳过，构造验证脚本在受限环境卡死）——后续若补，构造时须棋规合法（走子不送将），建议数据驱动迭代验证
  2. 浏览器冒烟未做（非阻塞）
- 待办：确认后提交（feat 前缀）
