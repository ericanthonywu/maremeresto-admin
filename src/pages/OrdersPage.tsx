import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, errorMessage } from '../api/client'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { RefundOrderModal } from '../components/RefundOrderModal'
import { OrderRow, effectiveOrderTime, nextStatusFor } from '../components/OrderRow'
import type { Order } from '../types'

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'accepted', label: 'Belum diantar' },
  { id: 'completed', label: 'Sedang diantar' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'refunded', label: 'Direfund' },
]

type TimeFilter = 'today' | 'tomorrow' | 'yesterday' | '7days' | '30days' | 'custom' | 'all'

const TIME_FILTERS: Array<{ id: TimeFilter; label: string }> = [
  { id: 'today', label: 'Hari Ini' },
  { id: 'tomorrow', label: 'Besok' },
  { id: 'yesterday', label: 'Kemarin' },
  { id: '7days', label: '7 Hari Terakhir' },
  { id: '30days', label: '30 Hari Terakhir' },
  { id: 'custom', label: 'Pilih Tanggal' },
  { id: 'all', label: 'Semua Waktu' },
]

function formatJakartaDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((p) => p.type === 'year')?.value ?? '2026'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return `${year}-${month}-${day}`
}

function shiftJakartaDate(daysOffset: number): string {
  return formatJakartaDate(new Date(Date.now() + daysOffset * 86400000))
}

function sortOrdersByEffectiveTime(list: Order[]): Order[] {
  return [...list].sort((a, b) => {
    const ta = new Date(effectiveOrderTime(a)).getTime()
    const tb = new Date(effectiveOrderTime(b)).getTime()
    if (tb !== ta) return tb - ta
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

export const OrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeBranchId, isOwner } = useAuth()
  const { subscribeToOrders, subscribeToStatusUpdates } = useAdminWebSocket()
  const { setUnreadCount } = useNotifications()

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(
    (searchParams.get('time') as TimeFilter) || 'today'
  )
  const [customDateFrom, setCustomDateFrom] = useState(() => shiftJakartaDate(0))
  const [customDateTo, setCustomDateTo] = useState(() => shiftJakartaDate(0))
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(searchParams.get('highlight'))
  const [refundTarget, setRefundTarget] = useState<Order | null>(null)

  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLTableRowElement | null>(null)

  // Debounce the search box so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(searchInput.trim()), 400)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const dateRange = useMemo((): { date_from?: string; date_to?: string; include_active?: boolean } => {
    switch (timeFilter) {
      case 'today': {
        const today = shiftJakartaDate(0)
        return { date_from: today, date_to: today, include_active: true }
      }
      case 'tomorrow': {
        const tomorrow = shiftJakartaDate(1)
        return { date_from: tomorrow, date_to: tomorrow }
      }
      case 'yesterday': {
        const yesterday = shiftJakartaDate(-1)
        return { date_from: yesterday, date_to: yesterday }
      }
      case '7days':
        return { date_from: shiftJakartaDate(-6), date_to: shiftJakartaDate(0) }
      case '30days':
        return { date_from: shiftJakartaDate(-29), date_to: shiftJakartaDate(0) }
      case 'custom':
        return {
          date_from: customDateFrom || undefined,
          date_to: customDateTo || customDateFrom || undefined,
        }
      case 'all':
      default:
        return {}
    }
  }, [timeFilter, customDateFrom, customDateTo])

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })

  const loadOrders = useCallback(async () => {
    if (!activeBranchId && !isOwner) return

    setError(null)
    try {
      const res = await adminApi.getOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
        branch_id: isOwner ? (activeBranchId ?? undefined) : undefined,
        date_from: dateRange.date_from,
        date_to: dateRange.date_to,
        include_active: dateRange.include_active,
        limit: 50,
      })
      setOrders(sortOrdersByEffectiveTime(res.orders))
      setTotal(res.total)
      setStatusCounts(res.statusCounts)
      setUnreadCount(res.unread)
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat daftar pesanan.'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, activeBranchId, isOwner, dateRange, setUnreadCount])

  useEffect(() => {
    setLoading(true)
    void loadOrders()
  }, [loadOrders])

  // Live refresh on new orders and status changes from other devices.
  useEffect(() => {
    const unsubOrders = subscribeToOrders((incomingOrder) => {
      const inBranchScope = !isOwner || !activeBranchId || incomingOrder.branch_id === activeBranchId
      const inStatusScope =
        statusFilter === 'all'
          ? incomingOrder.status !== 'pending'
          : incomingOrder.status === statusFilter
      if (inBranchScope && inStatusScope && (timeFilter === 'today' || timeFilter === 'all' || timeFilter === '7days' || timeFilter === '30days')) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === incomingOrder.id)
          const next = exists
            ? prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o))
            : [incomingOrder, ...prev]
          return sortOrdersByEffectiveTime(next)
        })
      }
      void loadOrders()
    })
    const unsubStatus = subscribeToStatusUpdates(() => void loadOrders())
    return () => {
      unsubOrders()
      unsubStatus()
    }
  }, [subscribeToOrders, subscribeToStatusUpdates, loadOrders, isOwner, activeBranchId, statusFilter, timeFilter])

  // Scroll a notification's order into view once it is on screen.
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, orders])

  const applyUpdated = (updated: Order) => {
    setOrders((prev) => sortOrdersByEffectiveTime(prev.map((o) => (o.id === updated.id ? updated : o))))
  }

  const handleAdvanceStatus = async (order: Order) => {
    const next = nextStatusFor(order)
    if (!next) return

    setBusy(order.id, true)
    try {
      applyUpdated(await adminApi.updateOrderStatus(order.id, next, order.version))
      void loadOrders()
    } catch (err) {
      setError(errorMessage(err, 'Gagal memperbarui status.'))
      // Re-sync: a conflict means someone else changed it first.
      void loadOrders()
    } finally {
      setBusy(order.id, false)
    }
  }

  const handleReject = async (order: Order) => {
    const reason = window.prompt(
      `Alasan penolakan pesanan ${order.order_number}?\n\nAlasan ini disimpan pada riwayat pesanan.`
    )
    if (reason === null) return
    if (!reason.trim()) {
      setError('Alasan penolakan wajib diisi.')
      return
    }

    setBusy(order.id, true)
    try {
      applyUpdated(await adminApi.updateOrderStatus(order.id, 'rejected', order.version, reason.trim()))
      void loadOrders()
    } catch (err) {
      setError(errorMessage(err, 'Gagal menolak pesanan.'))
      void loadOrders()
    } finally {
      setBusy(order.id, false)
    }
  }

  const handleFilterChange = (id: string) => {
    setStatusFilter(id)
    const next = new URLSearchParams(searchParams)
    if (id === 'all') next.delete('status')
    else next.set('status', id)
    next.delete('highlight')
    setSearchParams(next, { replace: true })
  }

  const handleTimeFilterChange = (id: TimeFilter) => {
    setTimeFilter(id)
    const next = new URLSearchParams(searchParams)
    if (id === 'today') next.delete('time')
    else next.set('time', id)
    next.delete('highlight')
    setSearchParams(next, { replace: true })
  }

  const pendingCount = statusCounts.accepted ?? 0
  const allStatusCount = useMemo(
    () =>
      Object.entries(statusCounts)
        .filter(([st]) => st !== 'pending')
        .reduce((sum, [, count]) => sum + count, 0),
    [statusCounts]
  )

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Pesanan</h1>
          <p className="text-xs text-stone-500">
            {total} pesanan
            {TIME_FILTERS.find((t) => t.id === timeFilter)?.label
              ? ` · ${TIME_FILTERS.find((t) => t.id === timeFilter)?.label}`
              : ''}
            {statusFilter !== 'all' ? ' (terfilter)' : ''}
            {pendingCount > 0 && ` · ${pendingCount} belum diantar`}
          </p>
        </div>

        <button
          onClick={() => void loadOrders()}
          className="px-3 py-2 bg-white hover:bg-stone-100 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 flex items-center gap-2"
        >
          <i className="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
          <span>Segarkan</span>
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            {error}
          </span>
          <button onClick={() => setError(null)} className="underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      <div className="space-y-3 bg-white p-3 rounded-2xl border border-stone-200/90 shadow-sm">
        {/* Time filter bar (defaults to Hari Ini) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-stone-100">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            <span className="text-[11px] font-bold text-stone-500 mr-1 flex items-center gap-1 shrink-0">
              <i className="fa-regular fa-calendar text-stone-400" aria-hidden="true"></i>
              Waktu:
            </span>
            {TIME_FILTERS.map((tf) => (
              <button
                key={tf.id}
                onClick={() => handleTimeFilterChange(tf.id)}
                aria-pressed={timeFilter === tf.id}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  timeFilter === tf.id
                    ? 'bg-stone-900 text-white shadow-sm'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 text-xs">
              <input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                aria-label="Dari tanggal"
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
              <span className="text-stone-400 font-bold">s/d</span>
              <input
                type="date"
                value={customDateTo}
                min={customDateFrom}
                onChange={(e) => setCustomDateTo(e.target.value)}
                aria-label="Sampai tanggal"
                className="px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {STATUS_FILTERS.map((st) => (
              <button
                key={st.id}
                onClick={() => handleFilterChange(st.id)}
                aria-pressed={statusFilter === st.id}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  statusFilter === st.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/60'
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    statusFilter === st.id ? 'bg-white/20 text-white' : 'bg-stone-200/70 text-stone-700'
                  }`}
                >
                  {st.id === 'all' ? allStatusCount : (statusCounts[st.id] ?? 0)}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[14rem]">
            <label htmlFor="order-search" className="sr-only">
              Cari pesanan
            </label>
            <i
              className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              aria-hidden="true"
            ></i>
            <input
              id="order-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nomor pesanan, nama, atau WhatsApp..."
              className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setSearchQuery('')
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                aria-label="Hapus pencarian"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600" aria-hidden="true"></i>
          <span className="sr-only">Memuat pesanan</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm">
          <i className="fa-solid fa-inbox text-4xl text-stone-300 mb-3" aria-hidden="true"></i>
          <h3 className="font-bold text-stone-800 text-sm">Tidak ada pesanan ditemukan</h3>
          <p className="text-xs text-stone-500 mt-1">
            {searchQuery || statusFilter !== 'all' || timeFilter !== 'all'
              ? 'Coba ubah filter waktu, status, atau kata kunci pencarian.'
              : 'Pesanan yang masuk akan muncul di sini secara otomatis.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">No.</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Tipe</th>
                  <th className="text-right px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Total</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Waktu</th>
                  <th className="text-right px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    isHighlighted={highlightId === order.id}
                    isExpanded={expandedId === order.id}
                    isBusy={busyIds.has(order.id)}
                    highlightRef={highlightRef}
                    onToggleExpand={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    onAdvanceStatus={handleAdvanceStatus}
                    onReject={handleReject}
                    onRefund={setRefundTarget}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RefundOrderModal
        order={refundTarget}
        onClose={() => setRefundTarget(null)}
        onRefunded={applyUpdated}
      />
    </div>
  )
}
