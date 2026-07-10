<template>
  <div id="app">
    <div class="scanlines"></div>
    <router-view />
    <GameToast />
  </div>
</template>

<script setup lang="ts">
import GameToast from '@/components/GameToast.vue'
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap');

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  min-height: 100vh;
  font-family: 'Fredoka', 'Nunito', 'Microsoft YaHei', sans-serif;
  background: #0D0D1A;
  color: #E0E0FF;
}

button {
  cursor: pointer;
  font-family: inherit;
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
</style>
