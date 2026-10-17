import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Order } from '../types'
import { safeAssign } from '../utils/navigation'

const SOUND_PREF_KEY = 'olga_admin_sound_enabled'
const BASE_TITLE = 'Mareme Group Admin'

export interface NewOrderNotice {
  id: string
  orderId: string
  orderNumber: string
  customerName: string
  grandTotal: number
  branchName?: string
  orderType: Order['order_type']
  scheduledAt?: string
  receivedAt: number
}

export type DesktopPermission = 'default' | 'granted' | 'denied' | 'unsupported'

interface NotificationContextType {
  /** Unread new-order notices, newest first. */
  notices: NewOrderNotice[]
  unreadCount: number
  /** Pushed by the websocket layer when a new order arrives. */
  notifyNewOrder: (order: Order) => void
  /** Marks existing order IDs as seen on boot so only genuinely new orders trigger a popup. */
  seedSeenOrders: (ids: string[]) => void
  hasSeenOrder: (id: string) => boolean
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
 * Plays a spoken voice announcement ("Ada orderan baru") paired with a synthesized chime.
 * Uses a dedicated audio file (/sounds/ada-orderan-baru.mp3) with SpeechSynthesis and Web Audio API fallbacks.
 */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const activeUtterancesRef = useRef<Set<SpeechSynthesisUtterance>>(new Set())

  // Pre-load audio file
  useEffect(() => {
    try {
      const audio = new Audio('/sounds/ada-orderan-baru.mp3')
      audio.preload = 'auto'
      audio.volume = 1.0
      audioRef.current = audio
    } catch {
      // Audio element not supported
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
  }, [])

  // Auto-unlock audio and speech on first user gesture completely silently
  useEffect(() => {
    const unlock = () => {
      // Remove listeners immediately so it executes only once and never again
      window.removeEventListener('click', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)

      type AudioCtor = typeof AudioContext
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (Ctor && (!ctxRef.current || ctxRef.current.state === 'closed')) {
        try {
          ctxRef.current = new Ctor()
        } catch {
          /* ignore */
        }
      }
      if (ctxRef.current && ctxRef.current.state === 'suspended') {
        ctxRef.current.resume().catch(() => {})
      }

      // Unlock HTML5 Audio via a 100% silent dummy sound (0.01s base64 WAV)
      // This grants browser media playback permission for background tabs
      // without ever playing any split-second fragment of the real voice file!
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
        silentAudio.volume = 0
        void silentAudio.play().catch(() => {})
      } catch {
        /* ignore */
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume()
        }
        window.speechSynthesis.getVoices()
      }
    }

    window.addEventListener('click', unlock, { passive: true })
    window.addEventListener('touchstart', unlock, { passive: true })
    window.addEventListener('keydown', unlock, { passive: true })
    window.addEventListener('pointerdown', unlock, { passive: true })
    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('touchstart', unlock)
      window.removeEventListener('keydown', unlock)
      window.removeEventListener('pointerdown', unlock)
    }
  }, [])

  const playVoiceFallback = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }

      const utterance = new SpeechSynthesisUtterance('Ada orderan baru')
      activeUtterancesRef.current.add(utterance)

      const cleanup = () => {
        activeUtterancesRef.current.delete(utterance)
      }
      utterance.onend = cleanup
      utterance.onerror = cleanup

      const voices = window.speechSynthesis.getVoices()
      const idVoice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith('id'))
      if (idVoice) {
        utterance.voice = idVoice
        utterance.lang = idVoice.lang
      } else {
        utterance.lang = 'id-ID'
      }

      utterance.volume = 1.0
      utterance.rate = 1.0
      utterance.pitch = 1.0

      window.speechSynthesis.speak(utterance)
    } catch {
      // SpeechSynthesis is a fallback
    }
  }, [])

  const play = useCallback(() => {
    // 1. Play natural recorded voice ("Ada orderan baru")
    let voicePlayed = false
    if (audioRef.current) {
      try {
        audioRef.current.currentTime = 0
        const promise = audioRef.current.play()
        if (promise) {
          promise
            .then(() => {
              voicePlayed = true
            })
            .catch(() => {
              if (!voicePlayed) playVoiceFallback()
            })
        } else {
          voicePlayed = true
        }
      } catch {
        playVoiceFallback()
      }
    } else {
      playVoiceFallback()
    }

    // 2. Play two-tone Web Audio chime as auditory alert
    try {
      type AudioCtor = typeof AudioContext
      const Ctor: AudioCtor | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
      if (!Ctor) return

      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new Ctor()
      }
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') void ctx.resume()

      const now = ctx.currentTime
      for (const [index, frequency] of [880, 1320].entries()) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()

        osc.type = 'sine'
        osc.frequency.value = frequency

        const start = now + index * 0.18
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.8, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32)

        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.34)
      }
    } catch {
      // Audio is a convenience; never let it break order handling.
    }
  }, [playVoiceFallback])

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

  // Tab title alert flashing when order arrives while browser tab is hidden/unfocused
  const flashTimerRef = useRef<number | undefined>(undefined)
  const isFlashingRef = useRef(false)

  const stopFlashing = useCallback(() => {
    window.clearInterval(flashTimerRef.current)
    flashTimerRef.current = undefined
    isFlashingRef.current = false
    document.title = unreadCount > 0 ? `(${unreadCount}) ${BASE_TITLE}` : BASE_TITLE
  }, [unreadCount])

  const flashTitleForOrder = useCallback((orderNumber: string) => {
    if (typeof document === 'undefined' || !document.hidden) return
    window.clearInterval(flashTimerRef.current)
    isFlashingRef.current = true
    let toggle = false
    flashTimerRef.current = window.setInterval(() => {
      if (!document.hidden) {
        stopFlashing()
        return
      }
      toggle = !toggle
      document.title = toggle
        ? `🔔 ADA PESANAN BARU! (${orderNumber})`
        : `(${unreadCount + 1}) ${BASE_TITLE}`
    }, 1000)
  }, [unreadCount, stopFlashing])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden && isFlashingRef.current) {
        stopFlashing()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.clearInterval(flashTimerRef.current)
    }
  }, [stopFlashing])

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
        scheduledAt: order.scheduled_at,
        receivedAt: Date.now(),
      }

      // Keep a bounded queue so a busy evening cannot grow it without limit.
      setNotices((prev) => [notice, ...prev].slice(0, 30))
      setUnreadCount((n) => n + 1)

      if (soundEnabled) playChime()
      flashTitleForOrder(order.order_number)

      // A desktop notification reaches staff even when the tab is in the
      // background — the previous 5-second in-page toast on one page did not.
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const notification = new Notification('Ada orderan baru masuk!', {
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
            silent: false,
          })
          notification.onclick = () => {
            window.focus()
            safeAssign(`/orders?highlight=${encodeURIComponent(order.id)}`)
          }
        } catch {
          // Some browsers throw when constructing notifications outside a
          // service worker; the in-app queue still shows the order.
        }
      }
    },
    [soundEnabled, playChime, flashTitleForOrder]
  )

  const seedSeenOrders = useCallback((ids: string[]) => {
    ids.forEach((id) => {
      if (id) seenOrderIds.current.add(id)
    })
  }, [])

  const hasSeenOrder = useCallback((id: string) => {
    return seenOrderIds.current.has(id)
  }, [])

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
      seedSeenOrders,
      hasSeenOrder,
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
      notices, unreadCount, notifyNewOrder, seedSeenOrders, hasSeenOrder, dismiss, dismissAll,
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
