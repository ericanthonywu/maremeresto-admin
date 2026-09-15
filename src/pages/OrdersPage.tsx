import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, errorMessage } from '../api/client'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { RefundOrderModal } from '../components/RefundOrderModal'
import { OrderRow, nextStatusFor } from '../components/OrderRow'
import type { Order } from '../types'

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Semua' },
  { id: 'accepted', label: 'Belum diantar' },
  { id: 'completed', label: 'Sedang diantar' },
  { id: 'rejected', label: 'Ditolak' },
  { id: 'cancelled', label: 'Dibatalkan' },
  { id: 'refunded', label: 'Direfund' },
]

export const OrdersPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { activeBranchId, isOwner } = useAuth()
  const { subscribeToOrders, subscribeToStatusUpdates } = useAdminWebSocket()
  const { setUnreadCount } = useNotifications()

  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all')
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
        limit: 50,
      })
      setOrders(res.orders)
      setTotal(res.total)
      setStatusCounts(res.statusCounts)
      setUnreadCount(res.unread)
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat daftar pesanan.'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, activeBranchId, isOwner, setUnreadCount])

  useEffect(() => {
    setLoading(true)
    void loadOrders()
  }, [loadOrders])

  // Live refresh on new orders and status changes from other devices.
  useEffect(() => {
    const unsubOrders = subscribeToOrders(() => void loadOrders())
    const unsubStatus = subscribeToStatusUpdates(() => void loadOrders())
    return () => {
      unsubOrders()
      unsubStatus()
    }
  }, [subscribeToOrders, subscribeToStatusUpdates, loadOrders])

  // Scroll a notification's order into view once it is on screen.
  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightId, orders])

  const applyUpdated = (updated: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
  }

  const handleAdvanceStatus = async (order: Order) => {
    const next = nextStatusFor(order)
    if (!next) return

    setBusy(order.id, true)
    try {
      applyUpdated(await adminApi.updateOrderStatus(order.id, next, order.version))
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

  const pendingCount = statusCounts.pending ?? 0
  const allStatusCount = useMemo(() => Object.values(statusCounts).reduce((sum, count) => sum + count, 0), [statusCounts])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Pesanan</h1>
          <p className="text-xs text-stone-500">
            {total} pesanan{statusFilter !== 'all' ? ' (terfilter)' : ''}
            {pendingCount > 0 && ` · ${pendingCount} menunggu tindakan`}
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {STATUS_FILTERS.map((st) => (
            <button
              key={st.id}
              onClick={() => handleFilterChange(st.id)}
              aria-pressed={statusFilter === st.id}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === st.id
                  ? 'bg-brand-600 text-white shadow'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {st.label} ({st.id === 'all' ? allStatusCount : (statusCounts[st.id] ?? 0)})
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[12rem]">
          <label htmlFor="order-search" className="sr-only">
            Cari pesanan
          </label>
          <i
            className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
            aria-hidden="true"
          ></i>
          <input
            id="order-search"
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nomor pesanan, nama, atau WhatsApp..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500"
          />
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
            {searchQuery || statusFilter !== 'all'
              ? 'Coba ubah filter atau kata kunci pencarian.'
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
