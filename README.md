# 🎮 GameHub - 小游戏合集

![Vue](https://img.shields.io/badge/Vue-3.4+-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.4+-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5.1+-646CFF?style=flat-square&logo=vite&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

> 一个基于 Vue 3 + TypeScript + Vite 构建的经典小游戏合集项目，包含多款经典街机和益智游戏。

---

## ✨ 游戏列表

| 序号 | 游戏 | 描述 | 难度 |
|------|------|------|------|
| 1 | 📦 推箱子 | 经典仓库搬运工游戏 | ⭐⭐ |
| 2 | 🔗 连连看 | 经典消除配对游戏 | ⭐ |
| 3 | 🍎 接水果 | 眼疾手快接住掉落的水果 | ⭐ |
| 4 | 🐍 贪吃蛇 | 童年经典回忆 | ⭐ |
| 5 | 🎯 俄罗斯方块 | 经典益智游戏 | ⭐⭐⭐ |
| 6 | 🎱 弹球打砖块 | 经典街机游戏 | ⭐⭐ |
| 7 | 🔢 2048 | 数字合成挑战 | ⭐⭐ |
| 8 | 🔨 打地鼠 | 反应力大考验 | ⭐ |
| 9 | ⭕ 井字棋 | 经典对战 AI | ⭐ |

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18.0
- npm >= 7.0 或 pnpm >= 7.0

### 安装依赖

```bash
# 使用 npm
npm install

# 或使用 pnpm
pnpm install
```

### 开发模式

```bash
npm run dev
```

启动后访问 http://localhost:5173

### 生产构建

```bash
npm run build
```

构建产物将输出到 `dist/` 目录。

### 预览构建

```bash
npm run preview
```

---

## ✨ 体验特性

弹窗动画 / 触屏拖拽 / 键盘连发 / 音效反馈（23+ 预设）/ 震动反馈 / 失焦暂停 / 可访问性（focus-visible + reduced-motion）/ 排行榜容错（5s 超时 + 重试）

详细机制见 [docs/system_design.md](./docs/system_design.md)。

---

## 🛠️ 技术栈

- **框架**: [Vue 3](https://vuejs.org/) - 渐进式 JavaScript 框架
- **语言**: [TypeScript](https://www.typescriptlang.org/) - JavaScript 的超集
- **构建工具**: [Vite](https://vitejs.dev/) - 下一代前端构建工具
- **路由**: [Vue Router](https://router.vuejs.org/) - Vue.js 官方路由
- **状态管理**: [Pinia](https://pinia.vuejs.org/) - Vue 的现代状态管理库
- **样式**: 原生 CSS + CSS 变量

---

## 📁 项目结构

```
game-collection/
├── src/
│   ├── components/          # 公共组件
│   │   ├── GameLayout.vue         # 游戏布局组件
│   │   ├── GameDialog.vue         # 游戏对话框（带过渡动画）
│   │   ├── DirectionPad.vue       # 方向控制键盘
│   │   ├── LeaderboardOverlay.vue  # 排行榜提交弹窗（带过渡动画 + 重试按钮）
│   │   ├── LeaderboardStrip.vue   # 内嵌排行榜条
│   │   ├── GameToast.vue          # 成就解锁 Toast（带过渡动画 + safe-area）
│   │   ├── PauseOverlay.vue       # 暂停遮罩（带过渡动画）
│   │   ├── ResumePrompt.vue       # 继续/重开选择弹窗（带过渡动画）
│   │   └── ScoreFloat.vue         # 浮动分数动画（"+10" 等）
│   ├── composables/         # 组合式函数
│   │   ├── useGameKeyboard.ts  # 键盘输入处理（支持 repeat 长按连发 + isDown 查询）
│   │   ├── useGameLoop.ts      # 游戏循环管理（暂停停 rAF + dt clamp）
│   │   ├── useSound.ts         # 音效系统（Web Audio API，23+ 预设）
│   │   ├── useLeaderboard.ts   # 排行榜数据（Supabase，5s 超时 + 错误映射）
│   │   ├── useToast.ts         # Toast 通知管理
│   │   ├── useAutoPause.ts     # 失焦自动暂停
│   │   ├── useHaptics.ts       # 触觉反馈（移动端震动）
│   │   ├── useScoreFloats.ts   # 浮动分数堆叠管理
│   │   ├── useGameSave.ts      # 存档/读档/继续游戏
│   │   ├── useSwipe.ts         # 移动端滑动手势
│   │   └── usePause.ts         # 统一的暂停/恢复（P/Esc + 失焦 + ResumePrompt）
│   ├── router/              # 路由配置（从 GAMES 注册表循环生成）
│   │   └── index.ts
│   ├── lib/
│   │   ├── supabase.ts       # Supabase 客户端
│   │   └── games.ts          # 🎮 游戏注册表 — 单一数据源（新增游戏只改这里）
│   ├── stores/               # 状态管理
│   │   ├── game.ts            # 游戏本地分数管理（分数自动引用 defaultScoreKeys）
│   │   └── achievements.ts    # 成就系统管理（解锁时自动触发音效+震动）
│   ├── styles/              # 全局样式
│   │   ├── game-theme.css    # 主题变量 + 间距 token
│   │   └── animations.css    # 共享动画 keyframes（弹窗/路由/Toast）+ focus-visible + reduced-motion
│   ├── views/               # 游戏页面
│   │   ├── HomeView.vue      # 首页 - 游戏选择（从 GAMES 派生卡片列表）
│   │   ├── AchievementsView.vue # 成就展示页
│   │   ├── SokobanView.vue   # 推箱子
│   │   ├── LinkGameView.vue  # 连连看
│   │   ├── CatchFruitView.vue # 接水果
│   │   ├── SnakeView.vue     # 贪吃蛇
│   │   ├── TetrisView.vue    # 俄罗斯方块
│   │   ├── BreakoutView.vue  # 弹球打砖块（支持触摸拖拽挡板）
│   │   ├── Game2048View.vue  # 2048
│   │   ├── WhackAMoleView.vue # 打地鼠（已补震动反馈）
│   │   └── TicTacToeView.vue # 井字棋
│   ├── App.vue              # 根组件（页面路由过渡 + 全局动画样式引入）
│   └── main.ts              # 入口文件
├── public/                  # 静态资源
├── tests/                   # 测试文件（node test-xxx.cjs 直接跑）
├── docs/                    # 文档
│   ├── system_design.md     # 系统设计文档
│   ├── class-diagram.mermaid # 类图
│   └── sequence-diagram.mermaid # 时序图
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🎯 核心功能

### 📊 分数系统
- 每款游戏都有独立的分数记录
- 分数自动保存到浏览器的 LocalStorage
- 首页显示各游戏的最高分记录

### 🏆 全局排行榜（Supabase）
- 跨玩家积分排行榜，匿名昵称制，同昵称保留最高分
- 每款游戏内嵌实时排行榜条（Top 5），支持中途提交分数
- 架构（SQL / 核心文件 / 环境变量 / 昵称去重逻辑）见 [docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」

### 🎨 统一的游戏布局
- 所有游戏共享统一的布局组件（GameLayout）
- 包含标题栏、游戏区、控制区
- 支持返回首页、重新开始等操作

### ⌨️ 键盘支持
- 部分游戏支持键盘控制（方向键、WASD）
- 流畅的键盘响应

### 🔊 音效系统
- 基于 Web Audio API 的合成音效，23+ 预设，零加载
- 全局静音切换按钮（GameLayout 顶部栏），状态持久化到 localStorage
- 静音→开启时自动给一声短 click 确认
- 完整音效列表见 [docs/class-diagram.mermaid](./docs/class-diagram.mermaid) 的 `useSound` 类

### 🏅 成就系统
- 10 个可解锁成就 + 自动 `perfectionist` 元成就
- 解锁时顶部弹入 Toast 通知 + 音效 + 震动，进度保存到 localStorage
- 成就页面（`/achievements`）网格展示所有成就的解锁状态

---

## 📝 添加新游戏

新增游戏步骤（模板 + 流程 + 参考 SnakeView.vue）详见 [AGENTS.md](./AGENTS.md) 的「新增游戏 checklist」。

---

## 🚀 部署

Supabase 初始化（SQL + 环境变量）+ Netlify 配置 + 验证，详见 [docs/system_design.md](./docs/system_design.md) 的「部署与基础设施」。

---

## 📄 许可协议

[MIT License](LICENSE)

---

## 📬 联系方式

如有问题或建议，欢迎提交 Issue！
