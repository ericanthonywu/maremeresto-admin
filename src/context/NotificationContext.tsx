import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Order } from '../types'

const SOUND_PREF_KEY = 'olga_admin_sound_enabled'
const BASE_TITLE = 'Mareme Resto Admin'

export interface NewOrderNotice {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  grandTotal: number
  branchName?: string
  orderType: Order['order_type']
  receivedAt: number
}

export type DesktopPermission = 'default' | 'granted' | 'denied' | 'unsupported'

interface NotificationContextType {
  /** Unread new-order notices, newest first. */
  notices: NewOrderNotice[]
  unreadCount: number
  /** Pushed by the websocket layer when a new order arrives. */
  notifyNewOrder: (order: Order) => void
  dismiss: (id: string) => void
  dismissAll: () => void
  setUnreadCount: (n: number) => void

  soundEnabled: boolean
  toggleSound: () => void
  desktopPermission: DesktopPermission
  requestDesktopPermission: () => Promise<void>
  /** Plays the alert once, so the operator can confirm they will hear it. */
  testAlert: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

/**
 * Synthesises a two-tone chime with the Web Audio API. An audio file would be
 * another asset to ship and cache; this needs no network and cannot 404.
 */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null)

  const play = useCallback(() => {
    try {
      type AudioCtor = typeof AudioContext
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (!Ctor) return

      // Reuse one context: browsers cap how many a page may create.
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new Ctor()
      }
      const ctx = ctxRef.current
      // Autoplay policy suspends the context until a user gesture occurs.
      if (ctx.state === 'suspended') void ctx.resume()

      const now = ctx.currentTime
      // Two ascending notes, a perfect fifth apart.
      for (const [index, frequency] of [880, 1320].entries()) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.value = frequency

        const start = now + index * 0.18
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.28, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32)

        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.34)
      }
    } catch {
      // Audio is a convenience; never let it break order handling.
    }
  }, [])

  return play
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notices, setNotices] = useState<NewOrderNotice[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_PREF_KEY) !== '0'
  )
  const [desktopPermission, setDesktopPermission] = useState<DesktopPermission>(() => {
    if (typeof Notification === 'undefined') return 'unsupported'
    return Notification.permission as DesktopPermission
  })

  const playChime = useChime()
  // Guards against the same order being announced twice, which happens when
  // the socket reconnects and the branch room replays.
  const seenOrderIds = useRef<Set<string>>(new Set())

  const notifyNewOrder = useCallback(
    (order: Order) => {
      if (!order?.id || seenOrderIds.current.has(order.id)) return
      seenOrderIds.current.add(order.id)

      const notice: NewOrderNotice = {
        id: `${order.id}-${Date.now()}`,
        orderId: order.id,
        orderNumber: order.order_number,
        customerName: order.customer_name,
        grandTotal: order.grand_total,
        branchName: order.branch?.name,
        orderType: order.order_type,
        receivedAt: Date.now(),
      }

      // Keep a bounded queue so a busy evening cannot grow it without limit.
      setNotices((prev) => [notice, ...prev].slice(0, 30))
      setUnreadCount((n) => n + 1)

      if (soundEnabled) playChime()

      // A desktop notification reaches staff even when the tab is in the
      // background — the previous 5-second in-page toast on one page did not.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const notification = new Notification('Pesanan baru masuk', {
            body: `${order.order_number} · ${order.customer_name} · ${new Intl.NumberFormat('id-ID', {
              style: 'currency',
              currency: 'IDR',
              maximumFractionDigits: 0,
            }).format(order.grand_total)}`,
            // The tag replaces any previous notification for the same order
            // rather than stacking duplicates.
            tag: `order-${order.id}`,
            icon: '/favicon.svg',
            requireInteraction: true,
          })
          notification.onclick = () => {
            window.focus()
            window.location.assign(`/orders?highlight=${order.id}`)
          }
        } catch {
          // Some browsers throw when constructing notifications outside a
          // service worker; the in-app queue still shows the order.
        }
      }
    },
    [soundEnabled, playChime]
  )

  // Reflect the backlog in the tab title so a minimised window still shows it.
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE
  }, [unreadCount])

  const dismiss = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => setNotices([]), [])

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev
      localStorage.setItem(SOUND_PREF_KEY, next ? '1' : '0')
      // Confirm audibly that sound is now on.
      if (next) playChime()
      return next
    })
  }, [playChime])

  const requestDesktopPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setDesktopPermission('unsupported')
      return
    }
    try {
      const result = await Notification.requestPermission()
      setDesktopPermission(result as DesktopPermission)
    } catch {
      setDesktopPermission('denied')
    }
  }, [])

  const testAlert = useCallback(() => {
    playChime()
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('Notifikasi aktif', {
          body: 'Anda akan menerima pemberitahuan seperti ini saat pesanan baru masuk.',
          tag: 'olga-test',
          icon: '/favicon.svg',
        })
      } catch {
        /* ignore */
      }
    }
  }, [playChime])

  const value = useMemo(
    () => ({
      notices,
      unreadCount,
      notifyNewOrder,
      dismiss,
      dismissAll,
      setUnreadCount,
      soundEnabled,
      toggleSound,
      desktopPermission,
      requestDesktopPermission,
      testAlert,
    }),
    [
      notices, unreadCount, notifyNewOrder, dismiss, dismissAll,
      soundEnabled, toggleSound, desktopPermission, requestDesktopPermission, testAlert,
    ]
  )

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => {
  const ctx = useContext(NotificationContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationProvider')
  return ctx
}
