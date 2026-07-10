import { ref, readonly } from 'vue'

const STORAGE_KEY = 'game-collection-sound-muted'

let initialMuted = false
try { initialMuted = localStorage.getItem(STORAGE_KEY) === 'true' } catch {}
const muted = ref(initialMuted)

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function createVoice(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  delay: number,
  sweepTo?: number,
) {
  if (muted.value) return
  const ac = getCtx()
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = type
  const t = ac.currentTime + delay

  if (sweepTo !== undefined) {
    osc.frequency.setValueAtTime(freq, t)
    osc.frequency.exponentialRampToValueAtTime(sweepTo, t + dur)
  } else {
    osc.frequency.value = freq
  }

  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.start(t)
  osc.stop(t + dur)

  osc.onended = () => {
    osc.disconnect()
    gain.disconnect()
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0) {
  createVoice(freq, dur, type, vol, delay)
}

function sweep(f1: number, f2: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  createVoice(f1, dur, type, vol, 0, f2)
}

function click() {
  tone(800, 0.06, 'square', 0.08)
}

function move() {
  tone(440, 0.05, 'square', 0.06)
}

function push() {
  tone(220, 0.1, 'triangle', 0.1)
}

function place() {
  tone(523, 0.12, 'sine', 0.12)
  tone(659, 0.12, 'sine', 0.1, 0.08)
}

function select() {
  tone(600, 0.06, 'sine', 0.08)
}

function match() {
  tone(523, 0.1, 'sine', 0.12)
  tone(659, 0.1, 'sine', 0.1, 0.08)
  tone(784, 0.15, 'sine', 0.08, 0.16)
}

function eat() {
  sweep(400, 800, 0.1, 'sine', 0.1)
}

function crash() {
  sweep(400, 100, 0.3, 'sawtooth', 0.12)
}

function drop() {
  tone(150, 0.08, 'triangle', 0.1)
}

function rotate() {
  tone(600, 0.04, 'triangle', 0.06)
}

function clear(lines: number) {
  const base = 400
  for (let i = 0; i < lines; i++) {
    tone(base + i * 100, 0.15, 'sine', 0.12, i * 0.08)
  }
  if (lines === 4) {
    tone(1000, 0.3, 'sine', 0.15, 0.35)
  }
}

function bounce() {
  tone(500, 0.03, 'square', 0.05)
}

function brick() {
  sweep(800, 1200, 0.08, 'square', 0.08)
}

function loseLife() {
  sweep(400, 200, 0.2, 'sine', 0.1)
}

function merge(level: number) {
  const freq = 300 + Math.floor(Math.log2(Math.max(level, 2))) * 50
  tone(freq, 0.1, 'sine', 0.1)
  tone(freq * 1.5, 0.08, 'sine', 0.08, 0.05)
}

function hit() {
  tone(800, 0.05, 'square', 0.12)
  tone(1200, 0.03, 'square', 0.08, 0.03)
}

function miss() {
  tone(200, 0.1, 'triangle', 0.06)
}

function collect() {
  tone(600, 0.06, 'sine', 0.1)
  tone(900, 0.06, 'sine', 0.08, 0.04)
}

function win() {
  ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'sine', 0.12, i * 0.12))
}

function gameOver() {
  ;[400, 350, 300, 200].forEach((f, i) => tone(f, 0.2, 'sine', 0.1, i * 0.15))
}

function pause() {
  tone(600, 0.06, 'triangle', 0.06)
  tone(400, 0.06, 'triangle', 0.05, 0.06)
}

function resume() {
  tone(400, 0.06, 'triangle', 0.06)
  tone(600, 0.06, 'triangle', 0.05, 0.06)
}

function unlock() {
  ;[659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'sine', 0.12, i * 0.1))
}

function toggleMute() {
  muted.value = !muted.value
  try { localStorage.setItem(STORAGE_KEY, String(muted.value)) } catch {}
  // 解锁静音后给一个短暂确认音
  if (!muted.value) click()
}

export function useSound() {
  return {
    muted: readonly(muted),
    toggleMute,
    click,
    move,
    push,
    place,
    select,
    match,
    eat,
    crash,
    drop,
    rotate,
    clear,
    bounce,
    brick,
    loseLife,
    merge,
    hit,
    miss,
    collect,
    win,
    gameOver,
    pause,
    resume,
    unlock,
  }
}
