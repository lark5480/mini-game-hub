<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="state.visible" class="game-toast">
        <span class="toast-icon">{{ state.icon }}</span>
        <span class="toast-message">{{ state.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '@/composables/useToast'

const { state } = useToast()
</script>

<style scoped>
.game-toast {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 28px;
  background: rgba(13, 13, 26, 0.95);
  border: 1px solid rgba(255, 215, 0, 0.5);
  border-radius: 14px;
  box-shadow:
    0 0 30px rgba(255, 215, 0, 0.3),
    0 0 60px rgba(255, 215, 0, 0.1);
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.toast-icon {
  font-size: 1.8em;
  line-height: 1;
}

.toast-message {
  color: #FFD700;
  font-size: 1em;
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.toast-enter-active {
  animation: toast-in 0.4s ease-out;
}

.toast-leave-active {
  animation: toast-out 0.3s ease-in;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-30px) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  to {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.9);
  }
}
</style>
