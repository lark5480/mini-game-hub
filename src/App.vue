<template>
  <div id="app">
    <div class="scanlines" aria-hidden="true"></div>
    <router-view v-slot="{ Component }">
      <Transition name="page-fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </router-view>
    <GameToast />
  </div>
</template>

<script setup lang="ts">
import GameToast from '@/components/GameToast.vue'
import '@/styles/animations.css'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  /* 回退 100vh，再覆盖为动态视口高度，避免移动端地址栏导致的布局跳动 */
  min-height: 100vh;
  min-height: 100dvh;
  font-family: 'Fredoka', 'Nunito', 'Microsoft YaHei', sans-serif;
  background: #0D0D1A;
  color: #E0E0FF;
}

body {
  /* 禁止移动端下拉刷新 / 橡皮筋滚动干扰游戏操作 */
  overscroll-behavior-y: none;
}

button {
  cursor: pointer;
  font-family: inherit;
  /* 去除移动端 300ms 点击延迟，避免双击缩放 */
  touch-action: manipulation;
}

::selection {
  background: #FF006E;
  color: #fff;
}

::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1A1A2E;
}

::-webkit-scrollbar-thumb {
  background: #5D34D0;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #818CF8;
}

.scanlines {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.1) 0px,
    rgba(0, 0, 0, 0.1) 1px,
    transparent 1px,
    transparent 2px
  );
  pointer-events: none;
  z-index: 100;
}

.page-fade-enter-active {
  animation: page-fade-in 0.25s ease-out;
}

.page-fade-leave-active {
  animation: page-fade-out 0.15s ease-in;
}
</style>
