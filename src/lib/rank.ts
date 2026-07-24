/** 排行榜名次标签：前三名显示奖牌 emoji，其余显示数字 */
export function rankLabel(idx: number): string {
  return ['🥇', '🥈', '🥉'][idx] ?? `${idx + 1}`
}
