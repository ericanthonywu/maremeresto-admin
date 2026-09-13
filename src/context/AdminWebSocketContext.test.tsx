import React from 'react'
import { render, screen, act, renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AdminWebSocketProvider, useAdminWebSocket } from './AdminWebSocketContext'
import { TOKEN_KEY } from '../api/client'
import type { Order, User } from '../types'

// Mock useAuth and useNotifications contexts
const mockNotifyNewOrder = vi.fn()
const mockAuthValue: {
  user: User | null
  activeBranchId: string | null
  isOwner: boolean
} = {
  user: { id: 'u1', name: 'Admin', phone: '08123', role: 'branch_admin', branch_id: 'branch-1' },
  activeBranchId: 'branch-1',
  isOwner: false,
}

vi.mock('./AuthContext', () => ({
  useAuth: () => mockAuthValue,
}))

vi.mock('./NotificationContext', () => ({
  useNotifications: () => ({
    notifyNewOrder: mockNotifyNewOrder,
  }),
}))

// Dummy Mock WebSocket
class MockWebSocket {
  static instances: MockWebSocket[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  // Helper methods for tests
  open() {
    this.readyState = MockWebSocket.OPEN
    if (this.onopen) this.onopen()
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
    if (this.onclose) this.onclose()
  }

  error() {
    if (this.onerror) this.onerror()
  }

  sendMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) })
    }
  }

  sendRawMessage(data: string) {
    if (this.onmessage) {
      this.onmessage({ data })
    }
  }
}

describe('AdminWebSocketContext', () => {
  let originalWebSocket: typeof window.WebSocket

  beforeEach(() => {
    vi.useFakeTimers()
    MockWebSocket.instances = []
    originalWebSocket = window.WebSocket
    // @ts-expect-error Mocking global WebSocket
    window.WebSocket = MockWebSocket

    localStorage.setItem(TOKEN_KEY, 'test-auth-token')
    mockNotifyNewOrder.mockReset()

    mockAuthValue.user = { id: 'u1', name: 'Admin', phone: '08123', role: 'branch_admin', branch_id: 'branch-1' }
    mockAuthValue.activeBranchId = 'branch-1'
    mockAuthValue.isOwner = false
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    window.WebSocket = originalWebSocket
    localStorage.clear()
  })

  it('throws error when useAdminWebSocket is used outside provider', () => {
    const TestComponent = () => {
      useAdminWebSocket()
      return null
    }

    // Suppress console.error during expected throw
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestComponent />)).toThrow('useAdminWebSocket must be used within an AdminWebSocketProvider')
    consoleError.mockRestore()
  })

  it('establishes WebSocket connection with correct URL parameters for branch admin', () => {
    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    expect(MockWebSocket.instances).toHaveLength(1)
    const ws = MockWebSocket.instances[0]
    expect(ws.url).toContain('room=branch%3Abranch-1')
    expect(ws.url).toContain('token=test-auth-token')
  })

  it('establishes WebSocket connection with owner room when user is owner', () => {
    mockAuthValue.isOwner = true
    mockAuthValue.user = { id: 'u2', name: 'Owner', phone: '08123', role: 'owner' }

    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    expect(MockWebSocket.instances).toHaveLength(1)
    const ws = MockWebSocket.instances[0]
    expect(ws.url).toContain('room=owner')
  })

  it('updates isConnected state on open and close', () => {
    const TestComponent = () => {
      const { isConnected } = useAdminWebSocket()
      return <div data-testid="status">{isConnected ? 'connected' : 'disconnected'}</div>
    }

    render(
      <AdminWebSocketProvider>
        <TestComponent />
      </AdminWebSocketProvider>
    )

    expect(screen.getByTestId('status').textContent).toBe('disconnected')

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    expect(screen.getByTestId('status').textContent).toBe('connected')

    act(() => {
      ws.close()
    })

    expect(screen.getByTestId('status').textContent).toBe('disconnected')
  })

  it('handles new_order event and notifies order listeners', () => {
    const orderListener = vi.fn()

    const TestComponent = () => {
      const { subscribeToOrders } = useAdminWebSocket()
      React.useEffect(() => {
        return subscribeToOrders(orderListener)
      }, [subscribeToOrders])
      return null
    }

    render(
      <AdminWebSocketProvider>
        <TestComponent />
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    const sampleOrder: Partial<Order> = {
      id: 'order-101',
      order_number: 'ORD-101',
      branch_id: 'branch-1',
      customer_name: 'John',
      grand_total: 50000,
    }

    act(() => {
      ws.sendMessage({ event: 'new_order', payload: sampleOrder })
    })

    expect(mockNotifyNewOrder).toHaveBeenCalledWith(sampleOrder)
    expect(orderListener).toHaveBeenCalledWith(sampleOrder)
  })

  it('filters new_order notifications for owner when order branch does not match activeBranchId', () => {
    mockAuthValue.isOwner = true
    mockAuthValue.activeBranchId = 'branch-1'

    const orderListener = vi.fn()

    const TestComponent = () => {
      const { subscribeToOrders } = useAdminWebSocket()
      React.useEffect(() => {
        return subscribeToOrders(orderListener)
      }, [subscribeToOrders])
      return null
    }

    render(
      <AdminWebSocketProvider>
        <TestComponent />
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    const otherBranchOrder: Partial<Order> = {
      id: 'order-202',
      branch_id: 'branch-2',
      order_number: 'ORD-202',
    }

    act(() => {
      ws.sendMessage({ event: 'new_order', payload: otherBranchOrder })
    })

    // Notification toast/sound skipped because branch-2 != activeBranchId ('branch-1')
    expect(mockNotifyNewOrder).not.toHaveBeenCalled()
    // Listener is still invoked so lists can update
    expect(orderListener).toHaveBeenCalledWith(otherBranchOrder)
  })

  it('handles order_paid and status_updated events', () => {
    const orderListener = vi.fn()
    const statusListener = vi.fn()

    const TestComponent = () => {
      const { subscribeToOrders, subscribeToStatusUpdates } = useAdminWebSocket()
      React.useEffect(() => {
        const unsub1 = subscribeToOrders(orderListener)
        const unsub2 = subscribeToStatusUpdates(statusListener)
        return () => {
          unsub1()
          unsub2()
        }
      }, [subscribeToOrders, subscribeToStatusUpdates])
      return null
    }

    render(
      <AdminWebSocketProvider>
        <TestComponent />
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    const paidOrder = { id: 'order-303' }
    act(() => {
      ws.sendMessage({ event: 'order_paid', payload: paidOrder })
    })
    expect(orderListener).toHaveBeenCalledWith(paidOrder)

    const statusUpdate = { order_id: 'order-303', status: 'completed' }
    act(() => {
      ws.sendMessage({ event: 'status_updated', payload: statusUpdate })
    })
    expect(statusListener).toHaveBeenCalledWith(statusUpdate)
  })

  it('handles error events and malformed JSON gracefully', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    // Malformed JSON should be ignored
    expect(() => {
      act(() => {
        ws.sendRawMessage('invalid-json{{{')
      })
    }).not.toThrow()

    // Error event
    act(() => {
      ws.sendMessage({ event: 'error', payload: 'Subscription failed' })
    })

    expect(warnSpy).toHaveBeenCalledWith(
      'Admin websocket rejected a subscription',
      'Subscription failed'
    )

    warnSpy.mockRestore()
  })

  it('shows dropped connection warning banner when connection is unexpectedly dropped', () => {
    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    expect(
      screen.queryByText(/Koneksi pesanan real-time terputus/i)
    ).toBeNull()

    act(() => {
      ws.close()
    })

    expect(
      screen.getByText(/Koneksi pesanan real-time terputus/i)
    ).not.toBeNull()
  })

  it('schedules reconnection with backoff timer on unexpected disconnect', () => {
    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    expect(MockWebSocket.instances).toHaveLength(1)
    const ws1 = MockWebSocket.instances[0]
    act(() => {
      ws1.open()
      ws1.close()
    })

    // Timer is scheduled. Fast forward timers to trigger reconnect
    act(() => {
      vi.runAllTimers()
    })

    expect(MockWebSocket.instances.length).toBeGreaterThan(1)
  })

  it('allows manual reconnection via reconnect() when connection is closed', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AdminWebSocketProvider>{children}</AdminWebSocketProvider>
    )
    const { result } = renderHook(() => useAdminWebSocket(), { wrapper })

    expect(MockWebSocket.instances).toHaveLength(1)
    const ws = MockWebSocket.instances[0]

    // Close current connection
    act(() => {
      ws.open()
      ws.close()
    })

    const countBefore = MockWebSocket.instances.length

    act(() => {
      result.current.reconnect()
    })

    // Should create a new WebSocket connection instance
    expect(MockWebSocket.instances.length).toBeGreaterThan(countBefore)
  })

  it('triggers reconnection on visibilitychange and online events when disconnected', () => {
    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    expect(MockWebSocket.instances).toHaveLength(1)
    const ws1 = MockWebSocket.instances[0]
    act(() => {
      ws1.open()
      ws1.close()
    })

    const initialCount = MockWebSocket.instances.length

    // Trigger online event
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount)

    // Trigger visibilitychange event
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(MockWebSocket.instances.length).toBeGreaterThan(initialCount)
  })

  it('calls ws.close() when onerror is triggered', () => {
    render(
      <AdminWebSocketProvider>
        <div>Child</div>
      </AdminWebSocketProvider>
    )

    const ws = MockWebSocket.instances[0]
    act(() => {
      ws.open()
    })

    const closeSpy = vi.spyOn(ws, 'close')
    act(() => {
      ws.error()
    })

    expect(closeSpy).toHaveBeenCalled()
  })
})
