<template>
  <Transition name="dialog">
    <div v-if="visible" class="dialog-overlay" @click.self="$emit('update:visible', false)">
      <div class="dialog">
        <!-- 新记录徽章 -->
        <div v-if="newRecord" class="new-record-badge">🎉 新记录！</div>

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

        <!-- 成就接近提示 -->
        <p v-if="achievementHint" class="achievement-hint">{{ achievementHint }}</p>

        <!-- 本局亮点统计 -->
        <p v-if="stats && stats.length" class="game-stats">
          <template v-for="(s, i) in stats" :key="i">{{ i > 0 ? ' · ' : '' }}{{ s.label }} {{ s.value }}</template>
        </p>

        <slot name="action">
          <button v-if="actionText" @click="$emit('action')">{{ actionText }}</button>
        </slot>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  accentColor?: string
  icon?: 'success' | 'fail' | 'info'
  title?: string
  message?: string
  actionText?: string
  /** 是否打破个人最佳：显示金色“新记录”徽章 */
  newRecord?: boolean
  /** 成就接近提示文案（如“还差 50 分解锁蛇王”） */
  achievementHint?: string | null
  /** 本局亮点统计（可选） */
  stats?: { label: string; value: string }[]
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
  padding: max(24px, env(safe-area-inset-top) + 16px) 20px max(24px, env(safe-area-inset-bottom) + 16px);
}

.dialog-enter-active {
  animation: overlay-in 0.2s ease-out;
}
.dialog-enter-active .dialog {
  animation: dialog-in 0.25s ease-out;
}
.dialog-leave-active {
  animation: overlay-out 0.18s ease-in;
}
.dialog-leave-active .dialog {
  animation: dialog-out 0.18s ease-in;
}

.dialog {
  background: linear-gradient(135deg, #1A1A2E, #0D0D1A);
  border: 1px solid color-mix(in srgb, var(--game-accent, #00FFFF) 30%, transparent);
  padding: clamp(28px, 7vw, 40px) clamp(22px, 6vw, 50px);
  max-width: calc(100vw - 40px);
  width: auto;
  box-sizing: border-box;
  border-radius: 20px;
  text-align: center;
  box-shadow: 0 0 50px color-mix(in srgb, var(--game-accent, #00FFFF) 20%, transparent);
  position: relative;
}

.new-record-badge {
  position: absolute;
  top: -14px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #0D0D1A;
  font-size: 0.85em;
  font-weight: 700;
  padding: 4px 16px;
  border-radius: 20px;
  box-shadow: 0 2px 12px rgba(255, 215, 0, 0.4);
  white-space: nowrap;
  animation: badge-pop 0.3s ease-out;
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

.achievement-hint {
  color: #FFD700 !important;
  font-size: 0.9em;
  margin-top: -15px;
  margin-bottom: 20px;
  opacity: 0.9;
}

.game-stats {
  color: var(--game-text-info, #818CF8);
  font-size: 0.85em;
  margin-top: -15px;
  margin-bottom: 20px;
  opacity: 0.85;
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
