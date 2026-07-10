<template>
  <div class="achievements-page">
    <div class="header">
      <button class="back-btn" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        返回
      </button>
      <h1>成就殿堂</h1>
      <p class="subtitle">解锁里程碑，展示你的荣耀</p>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: (store.progress.unlocked / store.progress.total * 100) + '%' }"></div>
      <span class="progress-text">{{ store.progress.unlocked }} / {{ store.progress.total }} 已解锁</span>
    </div>

    <div class="achievements-grid">
      <div
        v-for="ach in store.list"
        :key="ach.id"
        class="achievement-card"
        :class="{ unlocked: store.isUnlocked(ach.id), locked: !store.isUnlocked(ach.id) }"
      >
        <div class="ach-icon">
          <span v-if="store.isUnlocked(ach.id)">{{ ach.icon }}</span>
          <svg v-else width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div class="ach-info">
          <h3>{{ ach.name }}</h3>
          <p>{{ ach.desc }}</p>
        </div>
        <div class="ach-glow" v-if="store.isUnlocked(ach.id)"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAchievements } from '@/stores/achievements'

const router = useRouter()
const store = useAchievements()

function goBack() {
  router.replace('/')
}
</script>

<style scoped>
.achievements-page {
  min-height: 100vh;
  background: linear-gradient(180deg, #0D0D1A 0%, #1A1A2E 50%, #0D0D1A 100%);
  padding: 40px 20px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--game-btn-bg);
  border: 1px solid var(--game-btn-border);
  color: var(--game-text);
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #FFD700;
}

.header h1 {
  font-size: 3em;
  font-weight: 700;
  background: linear-gradient(135deg, #FFD700, #FF006E, #B967FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  filter: drop-shadow(0 0 20px rgba(255, 215, 0, 0.4));
}

.subtitle {
  color: #6B7280;
  margin-top: 10px;
  font-size: 1.1em;
}

.progress-bar {
  max-width: 500px;
  margin: 0 auto 40px;
  height: 36px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 18px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #FFD700, #FF006E);
  transition: width 0.6s ease;
}

.progress-text {
  position: relative;
  z-index: 1;
  color: #fff;
  font-weight: 600;
  font-size: 0.95em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

.achievements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}

.achievement-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.achievement-card.unlocked {
  background: rgba(255, 215, 0, 0.08);
  border: 1px solid rgba(255, 215, 0, 0.3);
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.12);
}

.achievement-card.locked {
  background: rgba(26, 26, 46, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.05);
  opacity: 0.6;
}

.ach-icon {
  font-size: 2.4em;
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.achievement-card.locked .ach-icon {
  color: #4B5563;
  font-size: 1.5em;
}

.ach-info h3 {
  color: #fff;
  font-size: 1.2em;
  font-weight: 600;
  margin-bottom: 4px;
}

.achievement-card.locked .ach-info h3 {
  color: #6B7280;
}

.ach-info p {
  color: #9CA3AF;
  font-size: 0.9em;
}

.achievement-card.locked .ach-info p {
  color: #4B5563;
}

.ach-glow {
  position: absolute;
  top: -50%;
  right: -30%;
  width: 80%;
  height: 200%;
  background: radial-gradient(ellipse, rgba(255, 215, 0, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

@media (max-width: 640px) {
  .header h1 {
    font-size: 2em;
  }

  .achievements-grid {
    grid-template-columns: 1fr;
    gap: 12px;
    padding: 0 10px;
  }

  .achievement-card {
    padding: 16px;
  }
}
</style>
