/// <reference lib="webworker" />
// 象棋 AI 搜索 Worker：主线程零阻塞。
// 协议（消息 FIFO）：search { id, board, side, depth, timeLimitMs, historyKeys } → result { id, move }；
// cancel 置位引擎内取消标志（不用 terminate，避免丢 TT/killer/history 跨调用状态）。
// progress { depth, nodes, bestScore }：每层迭代完成后发送，主线程用于显示思考进度。
import { findBestMove, cancelSearch, setProgressCallback } from '../engine/xiangqi/ai'

export {}

// 搜索进度回调：每层迭代完成后向主线程发送进度消息
setProgressCallback((depth, nodes, bestScore) => {
  postMessage({ type: 'progress', depth, nodes, bestScore })
})

onmessage = (e: MessageEvent) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelSearch()
    return
  }
  if (msg.type === 'search') {
    const { id, board, side, depth, timeLimitMs, historyKeys, minDepth, earlyExit } = msg
    const move = findBestMove(board, side, depth, timeLimitMs, historyKeys, minDepth, earlyExit)
    postMessage({ type: 'result', id, move })
  }
}
