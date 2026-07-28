// 在线联机房间：基于 Supabase Realtime 的广播 + 在线状态（presence）。
// 设计要点：
//  - 不需要任何数据库表，纯 broadcast 同步，部署形态（纯静态 + Supabase）不变。
//  - 用 presence key = myId（每次挂载生成的随机 UUID）做确定性角色分配：
//    在线成员 id 排序后，第一个 = X（先手），第二个 = O（后手）。两端算出同一顺序 → 角色一致，无竞态。
//  - 所有游戏消息走同一个 broadcast 事件 'msg'，payload = { type, data }，由 on(type, cb) 路由。
//  - supabase 为 null（未配置 .env）时整体降级为 no-op，状态置 'no-supabase'，视图据此提示。
import { ref, onUnmounted, type Ref } from 'vue'
import { supabase } from '@/lib/supabase'

export type RoomStatus = 'idle' | 'connecting' | 'connected' | 'no-supabase' | 'error'

export interface RoomApi {
  status: Ref<RoomStatus>
  peerCount: Ref<number>
  peerIds: Ref<string[]>
  myId: string
  send: (type: string, data: unknown) => void
  on: (type: string, handler: (data: any, from?: string) => void) => () => void
  onPresenceSync: (cb: (ids: string[]) => void) => void
  track: (meta: Record<string, unknown>) => void
  leave: () => void
}

function noopRoom(myId: string): RoomApi {
  return {
    status: ref<RoomStatus>('no-supabase'),
    peerCount: ref(0),
    peerIds: ref<string[]>([]),
    myId,
    send: () => {},
    on: () => () => {},
    onPresenceSync: () => {},
    track: () => {},
    leave: () => {},
  }
}

// 稳定的本机身份：写入 localStorage，刷新页面后保持不变 → 角色(X/O)不因刷新而翻转。
function getStableId(): string {
  const KEY = 'ttt2p_uid'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2)}`
  }
}

export function useRealtimeRoom(roomCode: string, meta: Record<string, unknown> = {}): RoomApi {
  const myId = getStableId()

  // 未配置 Supabase：降级，视图应提示如何开启联机。
  if (!supabase) return noopRoom(myId)

  const status = ref<RoomStatus>('connecting')
  const peerIds = ref<string[]>([])
  const peerCount = ref(0)

  const handlers = new Map<string, Set<(data: any, from?: string) => void>>()
  const presenceCallbacks: ((ids: string[]) => void)[] = []

  const channel = supabase.channel(`room:${roomCode}`, {
    config: {
      broadcast: { self: false },
      presence: { key: myId },
    },
  })

  channel.on('broadcast', { event: 'msg' }, (payload: any) => {
    const type = payload?.payload?.type
    const from = payload?.payload?.from as string | undefined
    const set = handlers.get(type)
    if (set) set.forEach(h => h(payload?.payload?.data, from))
  })

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState()
    const ids = Object.keys(state).sort()
    peerIds.value = ids
    peerCount.value = ids.length
    presenceCallbacks.forEach(cb => cb(ids))
  })

  channel.subscribe(async (s: string) => {
    if (s === 'SUBSCRIBED') {
      status.value = 'connected'
      await channel.track({ id: myId, ...meta })
    } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
      status.value = 'error'
    }
  })

  function send(type: string, data: unknown) {
    channel.send({ type: 'broadcast', event: 'msg', payload: { type, from: myId, data } })
  }

  function on(type: string, handler: (data: any) => void) {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type)!.add(handler)
    return () => { handlers.get(type)?.delete(handler) }
  }

  function onPresenceSync(cb: (ids: string[]) => void) {
    presenceCallbacks.push(cb)
    cb(peerIds.value)
  }

  function track(m: Record<string, unknown>) {
    channel.track({ id: myId, ...m })
  }

  function leave() {
    if (supabase) supabase.removeChannel(channel)
  }

  onUnmounted(() => leave())

  return { status, peerCount, peerIds, myId, send, on, onPresenceSync, track, leave }
}
