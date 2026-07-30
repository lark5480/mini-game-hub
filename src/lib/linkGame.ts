// 连连看 难度 / 关卡模式配置
// 纯逻辑、可单测；组件从本文件导入，避免配置散落。

export type LinkMode = 'classic' | 'campaign'
export type DiffKey = 'easy' | 'normal' | 'hard'

export interface DiffConfig {
  rows: number
  cols: number
  types: number
  /** 关卡模式 L4+ 的限时秒数；undefined 表示不限时 */
  timeLimit?: number
}

/** 三档难度（图标数受 12 个 emoji 上限约束） */
export const DIFFS: Record<DiffKey, DiffConfig> = {
  easy: { rows: 6, cols: 8, types: 12 },
  normal: { rows: 8, cols: 10, types: 10 },
  hard: { rows: 10, cols: 12, types: 12 },
}

export const DIFF_LABELS: Record<DiffKey, string> = {
  easy: '简单',
  normal: '普通',
  hard: '困难',
}

/**
 * 关卡 → 难度映射：
 *  L1 简单 → L2 普通 → L3 困难 → L4 起 困难 + 限时递减（每关 -15s，下限 60s）
 */
export function levelToDifficulty(level: number): DiffConfig & { diff: DiffKey } {
  if (level <= 1) return { diff: 'easy', ...DIFFS.easy }
  if (level === 2) return { diff: 'normal', ...DIFFS.normal }
  if (level === 3) return { diff: 'hard', ...DIFFS.hard }
  return { diff: 'hard', ...DIFFS.hard, timeLimit: Math.max(60, 150 - (level - 3) * 15) }
}
