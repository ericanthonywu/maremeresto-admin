import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { adminApi, TOKEN_KEY } from '../api/client'
import { useAuth } from './AuthContext'
import { useNotifications } from './NotificationContext'
import type { Order } from '../types'

interface AdminWebSocketContextType {
  isConnected: boolean
  hasDropped: boolean
  subscribeToOrders: (onNewOrder: (order: Order) => void) => () => void
  subscribeToStatusUpdates: (onUpdate: (data: { order_id: string; status: string }) => void) => () => void
  reconnect: () => void
}

const AdminWebSocketContext = createContext<AdminWebSocketContextType | undefined>(undefined)

const BASE_RECONNECT_DELAY = 1000
const MAX_RECONNECT_DELAY = 20000
const PING_INTERVAL = 20000
const PONG_TIMEOUT = 25000

/**
 * Creates an un-throttled timer using an inline Web Worker.
 * Browsers aggressively throttle window.setInterval down to 1 minute or pause it entirely
 * in background/inactive tabs. Web Workers are exempt from tab throttling, ensuring
 * background tabs stay connected to WebSockets and receive order audio notifications.
 */
function createWorkerTicker(intervalMs: number, onTick: () => void): () => void {
  if (typeof Worker === 'undefined') {
    const timer = window.setInterval(onTick, intervalMs)
    return () => window.clearInterval(timer)
  }

  const code = `
    let timer = null;
    self.onmessage = function(e) {
      if (e.data === 'start') {
        clearInterval(timer);
        timer = setInterval(function() { postMessage('tick'); }, ${intervalMs});
      } else if (e.data === 'stop') {
        clearInterval(timer);
      }
    };
  `
  let blobUrl: string | null = null
  let worker: Worker | null = null
  try {
    const blob = new Blob([code], { type: 'application/javascript' })
    blobUrl = URL.createObjectURL(blob)
    worker = new Worker(blobUrl)
    worker.onmessage = () => {
      onTick()
    }
    worker.postMessage('start')
  } catch {
    const timer = window.setInterval(onTick, intervalMs)
    return () => window.clearInterval(timer)
  }

  return () => {
    try {
      worker?.postMessage('stop')
      worker?.terminate()
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    } catch {
      /* ignore */
    }
  }
}

export const AdminWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, activeBranchId, isOwner } = useAuth()
  const { notifyNewOrder, seedSeenOrders, hasSeenOrder, setUnreadCount } = useNotifications()

  const [isConnected, setIsConnected] = useState(false)
  const [hasDropped, setHasDropped] = useState(false)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | undefined>(undefined)
  const stopHeartbeatTickerRef = useRef<(() => void) | undefined>(undefined)
  const pongTimeoutRef = useRef<number | undefined>(undefined)
  const attemptRef = useRef(0)
  const closedByUsRef = useRef(false)
  const connectRef = useRef<() => void>(() => {})

  const orderListenersRef = useRef<Set<(order: Order) => void>>(new Set())
  const statusListenersRef = useRef<Set<(data: { order_id: string; status: string }) => void>>(new Set())

  // The owner's socket stays joined to the network-wide 'owner' room even
  // while switching outlets (the room name itself doesn't change), so the
  // message handler below reads this ref rather than closing over a stale
  // activeBranchId from whenever the socket was last (re)connected.
  const scopeRef = useRef({ isOwner, activeBranchId })
  useEffect(() => {
    scopeRef.current = { isOwner, activeBranchId }
  }, [isOwner, activeBranchId])

  // The owner watches the whole network; a branch admin watches only their own
  // outlet. The server enforces this too — joining another branch's room is
  // rejected — so the room here is a request, not a grant.
  const room = useMemo(() => {
    if (!user) return null
    if (isOwner) return 'owner'
    return activeBranchId ? `branch:${activeBranchId}` : null
  }, [user, isOwner, activeBranchId])

  const stopHeartbeat = useCallback(() => {
    stopHeartbeatTickerRef.current?.()
    stopHeartbeatTickerRef.current = undefined
    window.clearTimeout(pongTimeoutRef.current)
    pongTimeoutRef.current = undefined
  }, [])

  const scheduleReconnect = useCallback(() => {
    window.clearTimeout(reconnectTimerRef.current)
    stopHeartbeat()
    const attempt = attemptRef.current++
    const delay = Math.min(BASE_RECONNECT_DELAY * 2 ** attempt, MAX_RECONNECT_DELAY)
    reconnectTimerRef.current = window.setTimeout(
      () => connectRef.current(),
      delay + Math.random() * 0.3 * delay
    )
  }, [stopHeartbeat])

  const startHeartbeat = useCallback(
    (ws: WebSocket) => {
      stopHeartbeat()
      stopHeartbeatTickerRef.current = createWorkerTicker(PING_INTERVAL, () => {
        if (wsRef.current !== ws || ws.readyState !== WebSocket.OPEN) return

        try {
          ws.send(JSON.stringify({ action: 'ping', event: 'ping' }))
        } catch {
          ws.close()
          return
        }

        window.clearTimeout(pongTimeoutRef.current)
        pongTimeoutRef.current = window.setTimeout(() => {
          if (wsRef.current === ws) {
            console.warn('Admin websocket heartbeat timeout, closing socket')
            ws.close()
          }
        }, PONG_TIMEOUT)
      })
    },
    [stopHeartbeat]
  )

  const connect = useCallback(() => {
    if (!room) return
    window.clearTimeout(reconnectTimerRef.current)
    const existing = wsRef.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      return
    }

    if (!user) return

    closedByUsRef.current = false

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // Uses the page's own host, so the admin portal works from any device on
    // the network instead of only on the developer's machine.
    const url = new URL(`${protocol}//${window.location.host}/api/v1/ws`)
    url.searchParams.set('room', room)
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      url.searchParams.set('token', token)
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(url.toString())
    } catch {
      scheduleReconnect()
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      if (wsRef.current !== ws) return
      setIsConnected(true)
      attemptRef.current = 0
      startHeartbeat(ws)
    }

    ws.onmessage = (event) => {
      if (wsRef.current !== ws) return

      window.clearTimeout(pongTimeoutRef.current)

      let msg: { event?: string; payload?: unknown }
      try {
        msg = JSON.parse(event.data)
      } catch {
        return
      }

      switch (msg.event) {
        case 'pong':
          break
        case 'new_order': {
          const order = msg.payload as Order
          // The owner's room carries every outlet's orders, so the badge/sound/
          // toast only fire for the outlet currently in view — otherwise the
          // count and alerts stayed the same no matter which outlet was
          // selected, which read as broken rather than "network-wide".
          const { isOwner: ownerNow, activeBranchId: branchNow } = scopeRef.current
          const inScope = !ownerNow || !branchNow || order.branch_id === branchNow
          if (inScope) {
            notifyNewOrder(order)
          }
          // Listeners (e.g. the Pesanan list) still hear about every order in
          // scope of their own request; an out-of-scope order here is a cheap
          // no-op refresh since their own query already excludes it.
          orderListenersRef.current.forEach((cb) => {
            try {
              cb(order)
            } catch {
              /* keep the other listeners running */
            }
          })
          break
        }
        case 'order_paid': {
          const order = msg.payload as Order
          const { isOwner: ownerNow, activeBranchId: branchNow } = scopeRef.current
          const inScope = !ownerNow || !branchNow || order.branch_id === branchNow
          if (inScope) {
            notifyNewOrder(order)
          }
          orderListenersRef.current.forEach((cb) => {
            try {
              cb(order)
            } catch {
              /* ignore */
            }
          })
          break
        }
        case 'status_updated': {
          const data = msg.payload as { order_id: string; status: string }
          statusListenersRef.current.forEach((cb) => {
            try {
              cb(data)
            } catch {
              /* ignore */
            }
          })
          break
        }
        case 'error':
          console.warn('Admin websocket rejected a subscription', msg.payload)
          break
      }
    }

    ws.onclose = () => {
      if (wsRef.current !== ws) return
      stopHeartbeat()
      setIsConnected(false)
      if (!closedByUsRef.current) {
        setHasDropped(true)
        scheduleReconnect()
      }
    }

    ws.onerror = () => {
      if (wsRef.current !== ws) return
      ws.close()
    }
  }, [room, user, notifyNewOrder, scheduleReconnect, startHeartbeat, stopHeartbeat])

  useEffect(() => {
    connectRef.current = connect
  }, [connect])

  useEffect(() => {
    if (!room) return

    // Rebuild the socket when the watched room changes (the owner switching
    // outlets), so events are never delivered for the wrong outlet.
    closedByUsRef.current = true
    stopHeartbeat()
    wsRef.current?.close()
    wsRef.current = null
    closedByUsRef.current = false
    attemptRef.current = 0
    connect()

    const onWake = () => {
      if (document.visibilityState === 'visible' && wsRef.current?.readyState !== WebSocket.OPEN) {
        attemptRef.current = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)

    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
      window.clearTimeout(reconnectTimerRef.current)
      stopHeartbeat()
      closedByUsRef.current = true
      wsRef.current?.close()
    }
  }, [room, connect, stopHeartbeat])

  // Fallback polling ensures new orders are still announced and added in real
  // time even if a WebSocket frame is dropped during a network handoff.
  const seededScopeRef = useRef<string | null>(null)
  useEffect(() => {
    if (!user) return
    if (!activeBranchId && !isOwner) return
    const scopeKey = `${user.id}:${isOwner ? (activeBranchId ?? 'all') : (activeBranchId ?? '')}`
    let cancelled = false

    const pollRecentOrders = async () => {
      try {
        const res = await adminApi.getOrders({
          branch_id: isOwner ? (activeBranchId ?? undefined) : undefined,
          limit: 25,
        })
        if (cancelled) return
        setUnreadCount(res.unread)
        if (seededScopeRef.current !== scopeKey) {
          seedSeenOrders(res.orders.map((o) => o.id))
          seededScopeRef.current = scopeKey
          return
        }
        const unseen = res.orders.filter((o) => !hasSeenOrder(o.id)).reverse()
        for (const order of unseen) {
          notifyNewOrder(order)
          orderListenersRef.current.forEach((cb) => {
            try {
              cb(order)
            } catch {
              /* ignore */
            }
          })
        }
      } catch {
        /* ignore transient errors */
      }
    }

    void pollRecentOrders()
    const stopPollingTicker = createWorkerTicker(8000, () => {
      // In background tabs, if the socket was dropped, auto-reconnect immediately
      if (
        wsRef.current &&
        wsRef.current.readyState !== WebSocket.OPEN &&
        wsRef.current.readyState !== WebSocket.CONNECTING &&
        !closedByUsRef.current
      ) {
        connectRef.current()
      }
      void pollRecentOrders()
    })
    return () => {
      cancelled = true
      stopPollingTicker()
    }
  }, [user, isOwner, activeBranchId, notifyNewOrder, seedSeenOrders, hasSeenOrder, setUnreadCount])

  const subscribeToOrders = useCallback((onNewOrder: (order: Order) => void) => {
    orderListenersRef.current.add(onNewOrder)
    return () => {
      orderListenersRef.current.delete(onNewOrder)
    }
  }, [])

  const subscribeToStatusUpdates = useCallback(
    (onUpdate: (data: { order_id: string; status: string }) => void) => {
      statusListenersRef.current.add(onUpdate)
      return () => {
        statusListenersRef.current.delete(onUpdate)
      }
    },
    []
  )

  const value = useMemo(
    () => ({
      isConnected,
      hasDropped,
      subscribeToOrders,
      subscribeToStatusUpdates,
      reconnect: () => {
        attemptRef.current = 0
        connect()
      },
    }),
    [isConnected, hasDropped, subscribeToOrders, subscribeToStatusUpdates, connect]
  )

  return (
    <AdminWebSocketContext.Provider value={value}>
      {/* Staff must know when they have stopped receiving orders. The warning
          appears only after an actual drop, not on the first paint. */}
      {!isConnected && hasDropped && (
        <div className="fixed top-0 inset-x-0 z-[60] bg-red-600 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-2xl">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-300" aria-hidden="true"></i>
              Koneksi pesanan real-time terputus — Anda mungkin tidak menerima notifikasi pesanan baru.
            </span>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white text-red-700 font-extrabold rounded-lg hover:bg-stone-100 active:scale-95 transition-all text-xs shrink-0 shadow"
            >
              <i className="fa-solid fa-arrows-rotate mr-1" aria-hidden="true"></i> Muat ulang
            </button>
          </div>
        </div>
      )}
      {children}
    </AdminWebSocketContext.Provider>
  )
}

export const useAdminWebSocket = () => {
  const context = useContext(AdminWebSocketContext)
  if (!context) throw new Error('useAdminWebSocket must be used within an AdminWebSocketProvider')
  return context
}
