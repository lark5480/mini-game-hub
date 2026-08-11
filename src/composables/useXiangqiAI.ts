// 象棋 AI 搜索调度器：封装 Worker 生命周期与请求/取消协议。
// - requestSearch：发起一次搜索（自动先 cancel 进行中的旧搜索，消息 FIFO 保证 cancel 先到）
// - cancel：置位引擎内取消标志（不 terminate，保留 TT/killer/history 跨调用状态）
// - dispose：组件卸载时释放 Worker
import type { Board, Side, Move } from '@/engine/xiangqi/types'

export interface SearchParams {
  board: Board
  side: Side
  depth: number
  timeLimitMs?: number
  historyKeys: bigint[]
}

// 棋盘转纯对象：Vue 响应式代理（Proxy）无法被结构化克隆，postMessage 前必须
// 深度拷贝为普通对象（worker 端只读棋盘，无需响应式）
function toPlainBoard(board: Board): Board {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)))
}

export function useXiangqiAI() {
  const worker = new Worker(new URL('../workers/xiangqi-ai.worker.ts', import.meta.url), { type: 'module' })
  let seq = 0
  const pending = new Map<number, (move: Move | null) => void>()

  worker.onmessage = (e: MessageEvent) => {
    const { id, move } = e.data
    const resolve = pending.get(id)
    if (resolve) {
      pending.delete(id)
      resolve(move)
    }
  }
  worker.onerror = () => {
    // Worker 异常：拒绝所有挂起请求，避免 Promise 悬挂
    for (const resolve of pending.values()) resolve(null)
    pending.clear()
  }

  function requestSearch(params: SearchParams): Promise<Move | null> {
    const id = ++seq
    worker.postMessage({ type: 'cancel' })
    return new Promise((resolve, reject) => {
      pending.set(id, resolve)
      try {
        // board 必须为纯对象（Proxy 无法克隆）；其余字段（side/depth/bigint[]）原生支持
        worker.postMessage({ type: 'search', id, ...params, board: toPlainBoard(params.board) })
      } catch (err) {
        pending.delete(id)
        reject(err)
      }
    })
  }

  function cancel(): void {
    worker.postMessage({ type: 'cancel' })
  }

  function dispose(): void {
    worker.terminate()
    for (const resolve of pending.values()) resolve(null)
    pending.clear()
  }

  return { requestSearch, cancel, dispose }
}
