<template>
  <div class="xiangqi-board-wrapper" ref="wrapperRef">
    <canvas
      ref="canvasRef"
      class="xiangqi-canvas"
      @click="handleClick"
      @touchstart.prevent="handleTouchStart"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Board, Position, Move, Side, ROWS, COLS, indexFromOffset, flipIndex } from '@/engine/xiangqi/types'

const props = withDefaults(defineProps<{
  board: Board
  selected: Position | null
  legalTargets: Position[]
  interactive: boolean
  lastMove: Move | null
  flipped?: boolean
  checkSide?: Side | null
  hint?: { from: Position; to: Position } | null
  highlight?: { from: Position; to: Position } | null
}>(), {
  flipped: false,
  checkSide: null,
  hint: null,
  highlight: null
})

const emit = defineEmits<{
  (e: 'tap', pos: Position): void
}>()

const wrapperRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

let dpr = 1
let cellSize = 0
let padding = 0
let canvasWidth = 0
let canvasHeight = 0

// 将军呼吸环：红色光环 opacity 循环（0.3→0.8），周期 1.5s
let checkPulseLastTime = 0

// 同一次点击 touchstart 后可能再派发合成 click，双触发会把「选子+走子」变成
// 「走子+重新选子/取消选择」→ 联机下表现为走子未生效/回合错乱；500ms 内去重
let lastTapAt = 0
function tapAllowed(): boolean {
  const now = Date.now()
  if (now - lastTapAt < 500) return false
  lastTapAt = now
  return true
}

// 视角翻转（联机黑方己方在下）：board 数组坐标 → 屏幕行列。
// 渲染层与命中层共用 flipIndex，保证翻转后仍点哪打哪。
function viewRow(row: number): number {
  return props.flipped ? flipIndex(row, ROWS) : row
}
function viewCol(col: number): number {
  return props.flipped ? flipIndex(col, COLS) : col
}

const BOARD_BG = '#f0d9b5'
const LINE_COLOR = '#8b4513'
const RIVER_COLOR = '#8b4513'
const RED_COLOR = '#c0392b'
const BLACK_COLOR = '#2c3e50'
const SELECT_RING = '#FFD700'
const TARGET_DOT = 'rgba(0, 200, 100, 0.5)'
const LAST_MOVE_HIGHLIGHT = 'rgba(255, 215, 0, 0.25)'
const HINT_FROM_RING = 'rgba(255, 165, 0, 0.8)'
const HINT_TO_MARKER = 'rgba(255, 165, 0, 0.6)'
const HIGHLIGHT_RING = 'rgba(0, 191, 255, 0.8)'

function calculateDimensions() {
  if (!wrapperRef.value) return
  const rect = wrapperRef.value.getBoundingClientRect()
  const maxW = rect.width
  cellSize = Math.floor(Math.min(maxW / 9, 64))
  padding = Math.floor(cellSize * 0.6)
  canvasWidth = cellSize * 8 + padding * 2
  canvasHeight = cellSize * 9 + padding * 2
}

function setupCanvas() {
  if (!canvasRef.value) return
  dpr = window.devicePixelRatio || 1
  canvasRef.value.width = canvasWidth * dpr
  canvasRef.value.height = canvasHeight * dpr
  canvasRef.value.style.width = canvasWidth + 'px'
  canvasRef.value.style.height = canvasHeight + 'px'
  const ctx = canvasRef.value.getContext('2d')!
  ctx.scale(dpr, dpr)
}

function getCellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: padding + col * cellSize,
    y: padding + row * cellSize
  }
}

function drawBoard(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BOARD_BG
  ctx.fillRect(0, 0, canvasWidth, canvasHeight)

  ctx.strokeStyle = LINE_COLOR
  ctx.lineWidth = 1.5

  // Horizontal lines (10 rows)
  for (let r = 0; r < ROWS; r++) {
    const y = padding + r * cellSize
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(padding + 8 * cellSize, y)
    ctx.stroke()
  }

  // Vertical lines (9 cols) - split by river
  for (let c = 0; c < COLS; c++) {
    const x = padding + c * cellSize
    if (c === 0 || c === 8) {
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, padding + 9 * cellSize)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.moveTo(x, padding)
      ctx.lineTo(x, padding + 4 * cellSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x, padding + 5 * cellSize)
      ctx.lineTo(x, padding + 9 * cellSize)
      ctx.stroke()
    }
  }

  // Palace diagonals (top)
  ctx.beginPath()
  ctx.moveTo(padding + 3 * cellSize, padding)
  ctx.lineTo(padding + 5 * cellSize, padding + 2 * cellSize)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(padding + 5 * cellSize, padding)
  ctx.lineTo(padding + 3 * cellSize, padding + 2 * cellSize)
  ctx.stroke()

  // Palace diagonals (bottom)
  ctx.beginPath()
  ctx.moveTo(padding + 3 * cellSize, padding + 7 * cellSize)
  ctx.lineTo(padding + 5 * cellSize, padding + 9 * cellSize)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(padding + 5 * cellSize, padding + 7 * cellSize)
  ctx.lineTo(padding + 3 * cellSize, padding + 9 * cellSize)
  ctx.stroke()

  // River text
  // 翻转时交换左右位置（模拟 180° 旋转），字形保持正立可读
  const riverLeft = props.flipped ? '汉 界' : '楚 河'
  const riverRight = props.flipped ? '楚 河' : '汉 界'
  ctx.fillStyle = RIVER_COLOR
  ctx.font = 'bold ' + Math.floor(cellSize * 0.45) + 'px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const riverY = padding + 4.5 * cellSize
  ctx.fillText(riverLeft, padding + 2 * cellSize, riverY)
  ctx.fillText(riverRight, padding + 6 * cellSize, riverY)

  // Position markers
  const markerPositions: [number, number][] = [
    [2, 1], [2, 7], [7, 1], [7, 7],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  ]
  const markerSize = Math.floor(cellSize * 0.12)
  ctx.lineWidth = 1
  for (const [r, c] of markerPositions) {
    const { x, y } = getCellCenter(r, c)
    const offset = markerSize + 2
    if (c > 0) {
      ctx.beginPath()
      ctx.moveTo(x - offset - markerSize, y - offset)
      ctx.lineTo(x - offset, y - offset)
      ctx.lineTo(x - offset, y - offset - markerSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x - offset - markerSize, y + offset)
      ctx.lineTo(x - offset, y + offset)
      ctx.lineTo(x - offset, y + offset + markerSize)
      ctx.stroke()
    }
    if (c < 8) {
      ctx.beginPath()
      ctx.moveTo(x + offset + markerSize, y - offset)
      ctx.lineTo(x + offset, y - offset)
      ctx.lineTo(x + offset, y - offset - markerSize)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(x + offset + markerSize, y + offset)
      ctx.lineTo(x + offset, y + offset)
      ctx.lineTo(x + offset, y + offset + markerSize)
      ctx.stroke()
    }
  }
}

function drawPiece(ctx: CanvasRenderingContext2D, row: number, col: number, type: string, side: string, isSelected: boolean) {
  const { x, y } = getCellCenter(row, col)
  const radius = cellSize * 0.42

  if (isSelected) {
    ctx.beginPath()
    ctx.arc(x, y, radius + 4, 0, Math.PI * 2)
    ctx.strokeStyle = SELECT_RING
    ctx.lineWidth = 3
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#fdf6e3'
  ctx.fill()
  ctx.strokeStyle = side === 'red' ? RED_COLOR : BLACK_COLOR
  ctx.lineWidth = 2.5
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(x, y, radius - 5, 0, Math.PI * 2)
  ctx.strokeStyle = side === 'red' ? RED_COLOR : BLACK_COLOR
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = side === 'red' ? RED_COLOR : BLACK_COLOR
  ctx.font = 'bold ' + Math.floor(radius * 0.8) + 'px serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const label = getPieceLabel(type, side)
  ctx.fillText(label, x, y + 1)
}

function getPieceLabel(type: string, side: string): string {
  const redLabels: Record<string, string> = {
    king: '帥', advisor: '仕', elephant: '相', horse: '馬',
    rook: '車', cannon: '炮', pawn: '兵'
  }
  const blackLabels: Record<string, string> = {
    king: '將', advisor: '士', elephant: '象', horse: '馬',
    rook: '車', cannon: '炮', pawn: '卒'
  }
  return side === 'red' ? redLabels[type] : blackLabels[type]
}

function drawCheckPulse(ctx: CanvasRenderingContext2D, timestamp: number) {
  if (!props.checkSide) return

  if (checkPulseLastTime === 0) checkPulseLastTime = timestamp
  const elapsed = timestamp - checkPulseLastTime
  const phase = (elapsed % 1500) / 1500
  checkPulseLastTime = timestamp

  const opacity = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2 - Math.PI / 2))

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = props.board[r][c]
      if (piece && piece.type === 'king' && piece.side === props.checkSide) {
        const { x, y } = getCellCenter(viewRow(r), viewCol(c))
        const radius = cellSize * 0.48
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 50, 50, ${opacity})`
        ctx.lineWidth = 4
        ctx.stroke()
      }
    }
  }
}

function drawHighlights(ctx: CanvasRenderingContext2D) {
  if (props.lastMove) {
    for (const pos of [props.lastMove.from, props.lastMove.to]) {
      const { x, y } = getCellCenter(viewRow(pos.row), viewCol(pos.col))
      ctx.fillStyle = LAST_MOVE_HIGHLIGHT
      ctx.fillRect(x - cellSize / 2, y - cellSize / 2, cellSize, cellSize)
    }
  }

  for (const pos of props.legalTargets) {
    const { x, y } = getCellCenter(viewRow(pos.row), viewCol(pos.col))
    const target = props.board[pos.row][pos.col]
    if (target) {
      ctx.beginPath()
      ctx.arc(x, y, cellSize * 0.44, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(200, 50, 50, 0.7)'
      ctx.lineWidth = 3
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, cellSize * 0.15, 0, Math.PI * 2)
      ctx.fillStyle = TARGET_DOT
      ctx.fill()
    }
  }
}

function drawHint(ctx: CanvasRenderingContext2D) {
  if (!props.hint) return
  const hint = props.hint

  const fromCenter = getCellCenter(viewRow(hint.from.row), viewCol(hint.from.col))
  ctx.beginPath()
  ctx.arc(fromCenter.x, fromCenter.y, cellSize * 0.44, 0, Math.PI * 2)
  ctx.strokeStyle = HINT_FROM_RING
  ctx.lineWidth = 3
  ctx.stroke()

  const toCenter = getCellCenter(viewRow(hint.to.row), viewCol(hint.to.col))
  ctx.beginPath()
  ctx.arc(toCenter.x, toCenter.y, cellSize * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = HINT_TO_MARKER
  ctx.fill()
}


function drawHighlight(ctx: CanvasRenderingContext2D) {
  if (!props.highlight) return
  const hl = props.highlight

  for (const pos of [hl.from, hl.to]) {
    const center = getCellCenter(viewRow(pos.row), viewCol(pos.col))
    ctx.beginPath()
    ctx.arc(center.x, center.y, cellSize * 0.44, 0, Math.PI * 2)
    ctx.strokeStyle = HIGHLIGHT_RING
    ctx.lineWidth = 3
    ctx.stroke()
  }
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvasWidth, canvasHeight)
  drawBoard(ctx)
  drawHighlights(ctx)
  drawHint(ctx)
  drawHighlight(ctx)
  drawCheckPulse(ctx, performance.now())

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = props.board[r][c]
      if (!piece) continue
      const isSelected = props.selected?.row === r && props.selected?.col === c
      drawPiece(ctx, viewRow(r), viewCol(c), piece.type, piece.side, isSelected)
    }
  }
}

function getPositionFromEvent(e: MouseEvent | TouchEvent): Position | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  // 坐标基准必须取 canvas 自身（渲染层），不能取外层 wrapper/
  // 容器：外层含回合指示条/按钮等额外内容会导致纵向系统性偏移。
  // rect 含 CSS transform 后的视觉位置，与绘制坐标系一致。
  const rect = canvas.getBoundingClientRect()
  // CSS 显示尺寸可能与 canvasWidth/Height 有取整差异，用 rect 实际宽高换算，
  // 保证渲染层与命中层尺寸一致
  const scaleX = canvasWidth > 0 ? rect.width / canvasWidth : 1
  const scaleY = canvasHeight > 0 ? rect.height / canvasHeight : 1
  let clientX: number, clientY: number
  if ('touches' in e) {
    clientX = e.touches[0].clientX
    clientY = e.touches[0].clientY
  } else {
    clientX = e.clientX
    clientY = e.clientY
  }
  const x = (clientX - rect.left) / scaleX
  const y = (clientY - rect.top) / scaleY
  // 命中区以交叉点为中心（±半格）；floor 会整体偏移半格导致「点棋子下方才选中」
  // indexFromOffset 得到的是屏幕行列；翻转时再映射回 board 数组坐标，
  // 与渲染层 viewRow/viewCol 同一套 flipIndex，保证点哪打哪
  const vcol = indexFromOffset(x, padding, cellSize, COLS)
  const vrow = indexFromOffset(y, padding, cellSize, ROWS)
  if (vrow === null || vcol === null) return null
  const row = props.flipped ? flipIndex(vrow, ROWS) : vrow
  const col = props.flipped ? flipIndex(vcol, COLS) : vcol
  return { row, col }
}

function handleClick(e: MouseEvent) {
  if (!props.interactive) return
  if (!tapAllowed()) return
  const pos = getPositionFromEvent(e)
  if (pos) emit('tap', pos)
}

function handleTouchStart(e: TouchEvent) {
  if (!props.interactive) return
  if (!tapAllowed()) return
  const pos = getPositionFromEvent(e)
  if (pos) emit('tap', pos)
}

function handleResize() {
  calculateDimensions()
  setupCanvas()
  render()
}

onMounted(() => {
  calculateDimensions()
  setupCanvas()
  render()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

watch(() => [props.board, props.selected, props.legalTargets, props.lastMove, props.flipped, props.hint, props.highlight], () => {
  nextTick(render)
}, { deep: true })
</script>

<style scoped>
.xiangqi-board-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 580px;
  margin: 0 auto;
}

.xiangqi-canvas {
  display: block;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  cursor: pointer;
  touch-action: manipulation;
}

@media (max-width: 640px) {
  .xiangqi-board-wrapper {
    max-width: 95vw;
  }
}
</style>
