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

---

## 🚀 快速开始

### 前置要求

- Node.js >= 16.0
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
│   │   ├── GameDialog.vue         # 游戏对话框
│   │   ├── DirectionPad.vue       # 方向控制键盘
│   │   ├── LeaderboardOverlay.vue  # 排行榜提交弹窗
│   │   └── LeaderboardStrip.vue   # 内嵌排行榜条
│   ├── composables/         # 组合式函数
│   │   ├── useGameKeyboard.ts  # 键盘输入处理
│   │   ├── useGameLoop.ts      # 游戏循环管理
│   │   ├── useSound.ts         # 音效系统（Web Audio API）
│   │   └── useLeaderboard.ts   # 排行榜数据（Supabase）
│   ├── router/              # 路由配置
│   │   └── index.ts
│   ├── lib/
│   │   └── supabase.ts       # Supabase 客户端
│   ├── stores/               # 状态管理
│   │   └── game.ts            # 游戏本地分数管理
│   ├── styles/              # 全局样式
│   │   └── game-theme.css    # 游戏主题样式
│   ├── views/               # 游戏页面
│   │   ├── HomeView.vue      # 首页 - 游戏选择
│   │   ├── SokobanView.vue   # 推箱子
│   │   ├── LinkGameView.vue  # 连连看
│   │   ├── CatchFruitView.vue # 接水果
│   │   ├── SnakeView.vue     # 贪吃蛇
│   │   ├── TetrisView.vue    # 俄罗斯方块
│   │   ├── BreakoutView.vue  # 弹球打砖块
│   │   ├── Game2048View.vue  # 2048
│   │   └── WhackAMoleView.vue # 打地鼠
│   ├── App.vue              # 根组件
│   └── main.ts              # 入口文件
├── public/                  # 静态资源
├── tests/                   # 测试文件
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
- 基于 Supabase PostgreSQL 的跨玩家积分排行榜
- 匿名昵称制，无需注册登录
- 同昵称自动保留最高分
- 每款游戏内嵌实时排行榜条（Top 5）
- 游戏结束可一键提交分数、查看排行、再来一局
- 2048 和连连看支持中途提交分数

### 🎨 统一的游戏布局
- 所有游戏共享统一的布局组件（GameLayout）
- 包含标题栏、游戏区、控制区
- 支持返回首页、重新开始等操作

### ⌨️ 键盘支持
- 部分游戏支持键盘控制（方向键、WASD）
- 流畅的键盘响应

### 🔊 音效系统
- 基于 Web Audio API 的合成音效，无需加载音频文件
- 全局静音切换按钮（GameLayout 顶部栏），状态持久化到 localStorage
- 适配各游戏场景：碰撞、消除、收集、移动、胜负等事件

---

## 📝 添加新游戏

1. 在 `src/views/` 创建游戏视图文件（如 `YourGameView.vue`）
2. 在 `src/router/index.ts` 添加路由配置
3. 在 `src/stores/game.ts` 的 `defaultScores` 注册游戏名称
4. 在 `src/views/HomeView.vue` 添加游戏卡片（包含图标、标题、描述、颜色）
5. 在游戏视图中嵌入 `<LeaderboardStrip :game="'xxx'" />`
6. 在 GameDialog 结束回调中调用 `openLeaderboard` 弹出排行榜提交

参考现有游戏的实现方式。

---

## 🚀 部署到 Netlify

### 前置条件
- Supabase 项目已创建，SQL 已执行（见下方）
- `.env` 已配置（本地开发用，不提交到 git）

### 1. Supabase 初始化

在 Supabase Dashboard → SQL Editor 执行：

```sql
create table leaderboard (
  id bigint generated always as identity primary key,
  game text not null,
  nickname text not null,
  score integer not null,
  created_at timestamptz default now()
);
create index idx_leaderboard_game_score on leaderboard (game, score desc);
alter table leaderboard enable row level security;
create policy "anon select" on leaderboard for select to anon using (true);
create policy "anon insert" on leaderboard for insert to anon with check (true);
create policy "anon update" on leaderboard for update to anon using (true) with check (true);
```

### 2. Netlify 配置

1. 推送代码到 GitHub
2. Netlify 导入 GitHub 仓库
3. **Site settings → Environment variables** 添加：
   - `VITE_SUPABASE_URL` = 你的 Supabase 项目 URL
   - `VITE_SUPABASE_ANON_KEY` = Publishable key（不是 Secret key）
4. Deploy settings 保持默认：
   - Build command: `npm run build`
   - Publish directory: `dist`
5. 触发部署

### 3. 验证

- 访问部署 URL，打开任一游戏
- 游戏结束 → 提交分数 → 应看到排行榜
- 排行榜条自动显示最新数据

---

## 📄 许可协议

[MIT License](LICENSE)

---

## 📬 联系方式

如有问题或建议，欢迎提交 Issue！
