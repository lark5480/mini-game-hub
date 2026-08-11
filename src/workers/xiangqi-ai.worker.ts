/// <reference lib="webworker" />
// 象棋 AI 搜索 Worker：主线程零阻塞。
// 协议（消息 FIFO）：search { id, board, side, depth, timeLimitMs, historyKeys } → result { id, move }；
// cancel 置位引擎内取消标志（不用 terminate，避免丢 TT/killer/history 跨调用状态）。
import { findBestMove, cancelSearch } from '../engine/xiangqi/ai'

export {}

onmessage = (e: MessageEvent) => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelSearch()
    return
  }
  if (msg.type === 'search') {
    const { id, board, side, depth, timeLimitMs, historyKeys } = msg
    const move = findBestMove(board, side, depth, timeLimitMs, historyKeys)
    postMessage({ type: 'result', id, move })
  }
}
