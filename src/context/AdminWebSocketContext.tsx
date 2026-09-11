import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

interface AdminWebSocketContextType {
  isConnected: boolean
  subscribeToOrders: (onNewOrder: (order: any) => void) => () => void
  subscribeToStatusUpdates: (onUpdate: (data: any) => void) => () => void
}

const AdminWebSocketContext = createContext<AdminWebSocketContextType | undefined>(undefined)

export const AdminWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const [isConnected, setIsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const orderListenersRef = useRef<Set<(order: any) => void>>(new Set())
  const statusListenersRef = useRef<Set<(data: any) => void>>(new Set())
  const reconnectTimeoutRef = useRef<any>(null)

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.port === '5174' ? 'localhost:8080' : window.location.host
    const roomParam = user?.branch_id ? `?room=branch:${user.branch_id}` : '?room=all'
    const url = `${protocol}//${host}/api/v1/ws${roomParam}`

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        console.log('✓ Admin WebSocket live connection established')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.event === 'new_order') {
            orderListenersRef.current.forEach((cb) => cb(msg.payload))
          } else if (msg.event === 'status_updated') {
            statusListenersRef.current.forEach((cb) => cb(msg.payload))
          }
        } catch (e) {
          console.warn('WS message parse error', e)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        console.warn('Admin WebSocket disconnected. Reconnecting in 3s...')
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch (err) {
      console.error('Failed to create admin WS', err)
      setIsConnected(false)
    }
  }, [user?.branch_id])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimeoutRef.current)
      if (wsRef.current) wsRef.current.close()
    }
  }, [connect])

  const subscribeToOrders = useCallback((onNewOrder: (order: any) => void) => {
    orderListenersRef.current.add(onNewOrder)
    return () => {
      orderListenersRef.current.delete(onNewOrder)
    }
  }, [])

  const subscribeToStatusUpdates = useCallback((onUpdate: (data: any) => void) => {
    statusListenersRef.current.add(onUpdate)
    return () => {
      statusListenersRef.current.delete(onUpdate)
    }
  }, [])

  return (
    <AdminWebSocketContext.Provider
      value={{
        isConnected,
        subscribeToOrders,
        subscribeToStatusUpdates,
      }}
    >
      {/* Alert banner if disconnected prompting refresh */}
      {!isConnected && (
        <div className="fixed top-0 inset-x-0 z-50 bg-red-600 text-white px-4 py-3 text-xs sm:text-sm font-bold flex items-center justify-between shadow-2xl animate-pulse">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-amber-300 text-base"></i>
              PERINGATAN: Koneksi real-time pesanan terputus! Anda mungkin tidak menerima notifikasi pesanan masuk.
            </span>
            <button
              onClick={() => window.location.reload()}
              className="px-3 py-1 bg-white text-red-700 font-extrabold rounded-lg hover:bg-stone-100 active:scale-95 transition-all text-xs shrink-0 shadow"
            >
              <i className="fa-solid fa-arrows-rotate mr-1"></i> Muat Ulang Halaman
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
