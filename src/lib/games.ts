/**
 * 小游戏注册表 —— 单一数据源（Single Source of Truth）
 * 新增游戏只改这一个文件，路由 / Store / 首页卡片自动生效
 */

export interface GameMeta {
  /** 路由路径片段 + store key（如 'snake'） */
  name: string
  /** 显示标题（中文） */
  title: string
  /** 简短描述 */
  desc: string
  /** 霓虹主题色 */
  color: string
  /** 路由 path（如 '/snake'） */
  path: string
}

export const GAMES: GameMeta[] = [
  { name: 'sokoban',       title: '推箱子',     desc: '经典仓库搬运工',     color: '#00FFFF', path: '/sokoban' },
  { name: 'link',          title: '连连看',     desc: '消除配对乐趣',       color: '#FF006E', path: '/link' },
  { name: 'catch-fruit',   title: '接水果',     desc: '眼疾手快',           color: '#05FFA1', path: '/catch-fruit' },
  { name: 'snake',         title: '贪吃蛇',     desc: '童年经典回忆',       color: '#B967FF', path: '/snake' },
  { name: 'tetris',        title: '俄罗斯方块', desc: '经典益智游戏',       color: '#00FFFF', path: '/tetris' },
  { name: 'breakout',      title: '弹球打砖块', desc: '经典街机游戏',       color: '#FF6B6B', path: '/breakout' },
  { name: '2048',          title: '2048',       desc: '数字合成挑战',       color: '#FFD700', path: '/2048' },
  { name: 'whackamole',    title: '打地鼠',     desc: '反应力大考验',       color: '#FF6B6B', path: '/whackamole' },
  { name: 'tic-tac-toe',   title: '井字棋',     desc: '经典对战 AI',        color: '#FF006E', path: '/tic-tac-toe' },
]

/** 默认空分数字段（store 初始化） */
export function defaultScoreKeys(): string[] {
  return GAMES.map(g => g.name)
}
