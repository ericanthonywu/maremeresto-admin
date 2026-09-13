import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NotificationProvider, useNotifications } from './NotificationContext'
import type { Order, Branch } from '../types'

describe('NotificationContext & NotificationProvider', () => {
  let mockAudioContextInstance: any
  let createdNotifications: any[]

  beforeEach(() => {
    localStorage.clear()
    document.title = 'Mareme Group Admin'
    createdNotifications = []

    mockAudioContextInstance = {
      state: 'suspended',
      currentTime: 0,
      destination: {},
      resume: vi.fn(function (this: any) {
        this.state = 'running'
        return Promise.resolve()
      }),
      createOscillator: vi.fn().mockReturnValue({
        type: 'sine',
        frequency: { value: 0 },
        connect: vi.fn().mockReturnThis(),
        start: vi.fn(),
        stop: vi.fn(),
      }),
      createGain: vi.fn().mockReturnValue({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn().mockReturnThis(),
      }),
    }

    const MockAudioContext = vi.fn().mockImplementation(function () {
      return mockAudioContextInstance
    })
    vi.stubGlobal('AudioContext', MockAudioContext)

    function MockNotification(this: any, title: string, options: any) {
      this.title = title
      Object.assign(this, options)
      this.onclick = null
      createdNotifications.push(this)
    }
    MockNotification.permission = 'granted'
    MockNotification.requestPermission = vi.fn().mockResolvedValue('granted')

    vi.stubGlobal('Notification', MockNotification)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('throws an error when useNotifications is used outside NotificationProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useNotifications())).toThrow(
      'useNotifications must be used within a NotificationProvider'
    )
    consoleError.mockRestore()
  })

  it('initializes with default state when localStorage has no sound preference', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    expect(result.current.notices).toEqual([])
    expect(result.current.unreadCount).toBe(0)
    expect(result.current.soundEnabled).toBe(true)
    expect(result.current.desktopPermission).toBe('granted')
  })

  it('initializes soundEnabled as false if localStorage has olga_admin_sound_enabled set to "0"', () => {
    localStorage.setItem('olga_admin_sound_enabled', '0')
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    expect(result.current.soundEnabled).toBe(false)
  })

  it('updates document title when unreadCount changes', () => {
    const { result } = renderHook(() => useNotifications(), {
      wrapper: NotificationProvider,
    })

    expect(document.title).toBe('Mareme Group Admin')

    act(() => {
      result.current.setUnreadCount(3)
    })
    expect(document.title).toBe('(3) Mareme Group Admin')

    act(() => {
      result.current.setUnreadCount(0)
    })
    expect(document.title).toBe('Mareme Group Admin')
  })

  describe('AudioContext logic (useChime)', () => {
    it('creates AudioContext and plays chime when audio is triggered', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })

      expect(window.AudioContext).toHaveBeenCalledTimes(1)
      expect(mockAudioContextInstance.resume).toHaveBeenCalled()
      expect(mockAudioContextInstance.createOscillator).toHaveBeenCalledTimes(2)
      expect(mockAudioContextInstance.createGain).toHaveBeenCalledTimes(2)
    })

    it('reuses existing AudioContext instance on subsequent chime plays', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })
      act(() => {
        result.current.testAlert()
      })

      expect(window.AudioContext).toHaveBeenCalledTimes(1)
    })

    it('re-creates AudioContext if previous instance state is closed', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })

      mockAudioContextInstance.state = 'closed'

      act(() => {
        result.current.testAlert()
      })

      expect(window.AudioContext).toHaveBeenCalledTimes(2)
    })

    it('falls back to webkitAudioContext if AudioContext is missing', () => {
      delete (window as any).AudioContext
      const MockWebkitAudioContext = vi.fn().mockImplementation(function () {
        return mockAudioContextInstance
      })
      ;(window as any).webkitAudioContext = MockWebkitAudioContext

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })

      expect(MockWebkitAudioContext).toHaveBeenCalledTimes(1)
    })

    it('handles AudioContext errors gracefully without breaking app state', () => {
      const MockAudioContext = vi.fn().mockImplementation(function () {
        throw new Error('AudioContext error')
      })
      vi.stubGlobal('AudioContext', MockAudioContext)

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      expect(() => {
        act(() => {
          result.current.testAlert()
        })
      }).not.toThrow()
    })
  })

  describe('notifyNewOrder', () => {
    const mockOrder: Order = {
      id: 'order-123',
      order_number: 'ORD-001',
      branch_id: 'b1',
      branch: { id: 'b1', name: 'Central Branch', is_open: true } as Branch,
      order_type: 'delivery',
      status: 'pending',
      customer_name: 'Jane Doe',
      customer_phone: '08123456789',
      delivery_distance_km: 1.5,
      subtotal: 50000,
      delivery_fee: 5000,
      service_fee: 1000,
      discount: 0,
      grand_total: 56000,
      version: 1,
      created_at: new Date().toISOString(),
      items: [],
    }

    it('adds a notice, increments unreadCount, plays chime, and triggers desktop notification', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder)
      })

      expect(result.current.unreadCount).toBe(1)
      expect(result.current.notices).toHaveLength(1)
      expect(result.current.notices[0]).toMatchObject({
        orderId: 'order-123',
        orderNumber: 'ORD-001',
        customerName: 'Jane Doe',
        grandTotal: 56000,
        branchName: 'Central Branch',
        orderType: 'delivery',
      })
      expect(window.AudioContext).toHaveBeenCalledTimes(1)
      expect(createdNotifications).toHaveLength(1)
      expect(createdNotifications[0].title).toBe('Pesanan baru masuk')
      expect(createdNotifications[0].tag).toBe('order-order-123')
    })

    it('handles notification onclick event correctly', () => {
      const focusSpy = vi.spyOn(window, 'focus').mockImplementation(() => {})
      const assignMock = vi.fn()
      const originalLocation = window.location
      // Use Object.defineProperty to bypass Location type restrictions during test
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, assign: assignMock },
      })

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder)
      })

      const notificationInstance = createdNotifications[0]
      expect(typeof notificationInstance.onclick).toBe('function')

      notificationInstance.onclick()

      expect(focusSpy).toHaveBeenCalled()
      expect(assignMock).toHaveBeenCalledWith('/orders?highlight=order-123')

      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      })
    })

    it('ignores duplicate order notifications with the same order id', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder)
        result.current.notifyNewOrder(mockOrder)
      })

      expect(result.current.unreadCount).toBe(1)
      expect(result.current.notices).toHaveLength(1)
    })

    it('ignores empty/invalid orders', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(null as any)
        result.current.notifyNewOrder({} as any)
      })

      expect(result.current.unreadCount).toBe(0)
      expect(result.current.notices).toHaveLength(0)
    })

    it('limits notice queue to maximum 30 notices', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        for (let i = 0; i < 35; i++) {
          result.current.notifyNewOrder({
            ...mockOrder,
            id: `order-${i}`,
            order_number: `ORD-${i}`,
          })
        }
      })

      expect(result.current.notices).toHaveLength(30)
      expect(result.current.unreadCount).toBe(35)
      expect(result.current.notices[0].orderId).toBe('order-34')
    })

    it('does not play chime when soundEnabled is false', () => {
      localStorage.setItem('olga_admin_sound_enabled', '0')
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder)
      })

      expect(window.AudioContext).not.toHaveBeenCalled()
    })

    it('handles desktop Notification constructor error gracefully', () => {
      function FailingNotification() {
        throw new Error('Notification constructor blocked')
      }
      FailingNotification.permission = 'granted'
      vi.stubGlobal('Notification', FailingNotification)

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      expect(() => {
        act(() => {
          result.current.notifyNewOrder(mockOrder)
        })
      }).not.toThrow()

      expect(result.current.notices).toHaveLength(1)
    })
  })

  describe('dismiss & dismissAll', () => {
    const mockOrder1: Order = {
      id: 'order-1',
      order_number: 'ORD-1',
      branch_id: 'b1',
      customer_name: 'Customer 1',
      customer_phone: '08123',
      delivery_distance_km: 1,
      subtotal: 10000,
      delivery_fee: 0,
      service_fee: 0,
      discount: 0,
      grand_total: 10000,
      version: 1,
      order_type: 'pickup',
      status: 'pending',
      created_at: new Date().toISOString(),
      items: [],
    }

    const mockOrder2: Order = {
      id: 'order-2',
      order_number: 'ORD-2',
      branch_id: 'b1',
      customer_name: 'Customer 2',
      customer_phone: '08123',
      delivery_distance_km: 2,
      subtotal: 20000,
      delivery_fee: 0,
      service_fee: 0,
      discount: 0,
      grand_total: 20000,
      version: 1,
      order_type: 'delivery',
      status: 'pending',
      created_at: new Date().toISOString(),
      items: [],
    }

    it('dismisses a single notice by id', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder1)
        result.current.notifyNewOrder(mockOrder2)
      })

      const noticeIdToDismiss = result.current.notices[0].id

      act(() => {
        result.current.dismiss(noticeIdToDismiss)
      })

      expect(result.current.notices).toHaveLength(1)
      expect(result.current.notices[0].orderId).toBe('order-1')
    })

    it('dismisses all notices', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.notifyNewOrder(mockOrder1)
        result.current.notifyNewOrder(mockOrder2)
      })

      act(() => {
        result.current.dismissAll()
      })

      expect(result.current.notices).toHaveLength(0)
    })
  })

  describe('toggleSound', () => {
    it('toggles soundEnabled from true to false and updates localStorage', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      expect(result.current.soundEnabled).toBe(true)

      act(() => {
        result.current.toggleSound()
      })

      expect(result.current.soundEnabled).toBe(false)
      expect(localStorage.getItem('olga_admin_sound_enabled')).toBe('0')
    })

    it('toggles soundEnabled from false to true, updates localStorage, and plays test chime', () => {
      localStorage.setItem('olga_admin_sound_enabled', '0')
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      expect(result.current.soundEnabled).toBe(false)

      act(() => {
        result.current.toggleSound()
      })

      expect(result.current.soundEnabled).toBe(true)
      expect(localStorage.getItem('olga_admin_sound_enabled')).toBe('1')
      expect(window.AudioContext).toHaveBeenCalledTimes(1)
    })
  })

  describe('requestDesktopPermission', () => {
    it('requests notification permission and updates state when supported', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      await act(async () => {
        await result.current.requestDesktopPermission()
      })

      expect((window as any).Notification.requestPermission).toHaveBeenCalled()
      expect(result.current.desktopPermission).toBe('granted')
    })

    it('sets desktopPermission to unsupported if window.Notification is undefined', async () => {
      vi.stubGlobal('Notification', undefined)

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      expect(result.current.desktopPermission).toBe('unsupported')

      await act(async () => {
        await result.current.requestDesktopPermission()
      })

      expect(result.current.desktopPermission).toBe('unsupported')
    })

    it('sets desktopPermission to denied if Notification.requestPermission rejects', async () => {
      ;(window as any).Notification.requestPermission = vi.fn().mockRejectedValue(new Error('Permission denied error'))

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      await act(async () => {
        await result.current.requestDesktopPermission()
      })

      expect(result.current.desktopPermission).toBe('denied')
    })
  })

  describe('testAlert', () => {
    it('plays chime and triggers desktop notification when permission is granted', () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })

      expect(window.AudioContext).toHaveBeenCalledTimes(1)
      expect(createdNotifications).toHaveLength(1)
      expect(createdNotifications[0].title).toBe('Notifikasi aktif')
    })

    it('does not trigger desktop notification if permission is not granted', () => {
      ;(window as any).Notification.permission = 'denied'

      const { result } = renderHook(() => useNotifications(), {
        wrapper: NotificationProvider,
      })

      act(() => {
        result.current.testAlert()
      })

      expect(window.AudioContext).toHaveBeenCalledTimes(1)
      expect(createdNotifications).toHaveLength(0)
    })
  })
})
