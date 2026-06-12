<template>
  <div v-if="visible" class="dialog-overlay" @click.self="$emit('update:visible', false)">
    <div class="dialog">
      <div class="dialog-icon">
        <slot name="icon">
          <!-- 预设图标 -->
          <svg v-if="icon === 'success'" width="48" height="48" viewBox="0 0 24 24" fill="none" :stroke="accentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
          <svg v-else-if="icon === 'fail'" width="48" height="48" viewBox="0 0 24 24" fill="none" :stroke="accentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
          </svg>
          <svg v-else-if="icon === 'info'" width="48" height="48" viewBox="0 0 24 24" fill="none" :stroke="accentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
          </svg>
        </slot>
      </div>
      <slot>
        <h3>{{ title }}</h3>
        <p v-if="message">{{ message }}</p>
      </slot>
      <slot name="action">
        <button v-if="actionText" @click="$emit('action')">{{ actionText }}</button>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  accentColor?: string
  icon?: 'success' | 'fail' | 'info'
  title?: string
  message?: string
  actionText?: string
}>()

defineEmits<{
  'update:visible': [value: boolean]
  action: []
}>()
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid color-mix(in srgb, var(--game-accent, #00FFFF) 30%, transparent);
  padding: 40px 50px;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 0 50px color-mix(in srgb, var(--game-accent, #00FFFF) 20%, transparent);
}

.dialog-icon {
  margin-bottom: 15px;
}

.dialog h3 {
  font-size: 1.8em;
  color: #fff;
  margin-bottom: 10px;
}

.dialog p {
  color: var(--game-text-info);
  margin-bottom: 25px;
}

.dialog button {
  background: linear-gradient(135deg, var(--game-accent, #00FFFF), var(--game-text-info, #818CF8));
  color: var(--game-bg-dark, #0D0D1A);
  border: none;
  padding: 12px 35px;
  font-size: 1.1em;
  font-weight: 600;
  border-radius: 25px;
  cursor: pointer;
  transition: all 0.2s;
}

.dialog button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 20px color-mix(in srgb, var(--game-accent, #00FFFF) 40%, transparent);
}
</style>
