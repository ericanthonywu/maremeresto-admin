import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { adminApi, errorMessage, formatRupiah } from '../api/client'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { RefundOrderModal } from '../components/RefundOrderModal'
import type { Order, OrderStatus } from '../types'

const STATUS_LABELS: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Menunggu', bg: 'bg-amber-100', text: 'text-amber-800' },
  accepted: { label: 'Belum diantar', bg: 'bg-amber-100', text: 'text-amber-800' },
  // Legacy values can still render safely before migration 8 is applied.
  preparing: { label: 'Belum diantar', bg: 'bg-amber-100', text: 'text-amber-800' },
  ready: { label: 'Belum diantar', bg: 'bg-amber-100', text: 'text-amber-800' },
  on_the_way: { label: 'Belum diantar', bg: 'bg-amber-100', text: 'text-amber-800' },
  picked_up: { label: 'Sedang diantar', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  delivered: { label: 'Sedang diantar', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  completed: { label: 'Sedang diantar', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  rejected: { label: 'Ditolak', bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-50', text: 'text-red-600' },
  refunded: { label: 'Direfund', bg: 'bg-purple-100', text: 'text-purple-800' },
}

/**
 * A refund can be issued from any status once the payment has settled,
 * mirroring the server's rule in RefundPayment — not just the ordinary
 * forward state machine. Already-refunded orders are excluded (terminal).
 */
function canRefund(order: Order): boolean {
  return order.payment?.status === 'settlement' && order.status !== 'refunded'
}

/**
 * The next status per order type. Mirrors the server's state machine, so the
 * button never offers a transition the API will reject.
 */
function nextStatusFor(order: Order): OrderStatus | null {
  switch (order.status) {
    case 'pending':
      return 'accepted'
    case 'accepted':
      return 'completed'
    case 'preparing':
      return 'ready'
    case 'ready':
      return 'completed'
    case 'on_the_way':
    case 'delivered':
    case 'picked_up':
      return 'completed'
    default:
      return null
  }
}

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
                {orders.map((order) => {
                  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending
                  const next = nextStatusFor(order)
                  const busy = busyIds.has(order.id)
                  const isHighlighted = highlightId === order.id
                  const isExpanded = expandedId === order.id
                  const isUnread = !order.acknowledged_at

                  return (
                    <React.Fragment key={order.id}>
                      <tr
                        ref={isHighlighted ? highlightRef : undefined}
                        className={`transition-colors ${
                          isHighlighted
                            ? 'bg-amber-50'
                            : isUnread && order.status === 'pending'
                              ? 'bg-emerald-50/40'
                              : 'hover:bg-stone-50/50'
                        } ${busy ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-stone-900 whitespace-nowrap">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            className="flex items-center gap-1.5 hover:text-brand-600"
                            aria-expanded={isExpanded}
                          >
                            <i
                              className={`fa-solid fa-chevron-${isExpanded ? 'down' : 'right'} text-[9px] text-stone-400`}
                              aria-hidden="true"
                            ></i>
                            {order.order_number}
                          </button>
                          {isUnread && order.status === 'pending' && (
                            <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Baru"></span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-bold text-stone-900 block">{order.customer_name}</span>
                          <a
                            href={`https://wa.me/${order.customer_phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Hubungi lewat WhatsApp"
                            className="text-stone-400 font-mono text-[10px] hover:text-emerald-600 inline-flex items-center gap-1"
                          >
                            <i className="fa-brands fa-whatsapp text-emerald-600" aria-hidden="true"></i>
                            {order.customer_phone}
                          </a>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="text-stone-700">
                            {order.order_type === 'delivery'
                              ? 'Antar'
                              : order.order_type === 'pickup'
                                ? 'Ambil'
                                : 'Jadwal'}
                          </span>
                          {order.order_type !== 'pickup' && order.delivery_distance_km > 0 && (
                            <span className="block text-[10px] text-stone-400 font-mono">
                              {order.delivery_distance_km} km
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-stone-900 font-mono whitespace-nowrap">
                          {formatRupiah(order.grand_total)}
                          {order.payment && (
                            <span
                              className={`block text-[9px] font-extrabold uppercase ${
                                order.payment.status === 'settlement' ? 'text-emerald-600' : 'text-amber-600'
                              }`}
                            >
                              {order.payment.status === 'settlement' ? 'Lunas' : 'Belum bayar'}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-lg ${st.bg} ${st.text} font-extrabold text-[10px] uppercase whitespace-nowrap`}
                          >
                            {st.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-stone-400 font-mono whitespace-nowrap">
                          {new Date(order.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {next && (
                              <button
                                onClick={() => handleAdvanceStatus(order)}
                                disabled={busy}
                                title={next === 'completed' && order.order_type !== 'pickup' ? 'Tandai pesanan sedang diantar' : undefined}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
                              >
                                {busy ? '...' : next === 'completed' && order.order_type !== 'pickup' ? '→ Sedang diantar' : `→ ${STATUS_LABELS[next]?.label ?? next}`}
                              </button>
                            )}

                            {order.status === 'accepted' && (
                              <button
                                onClick={() => handleReject(order)}
                                disabled={busy}
                                className="px-2.5 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 rounded-lg text-[10px] font-bold transition-all"
                              >
                                Tolak
                              </button>
                            )}

                            {canRefund(order) && (
                              <button
                                onClick={() => setRefundTarget(order)}
                                disabled={busy}
                                title="Refund pesanan lewat Midtrans"
                                className="px-2.5 py-1 bg-purple-100 hover:bg-purple-200 disabled:opacity-50 text-purple-700 rounded-lg text-[10px] font-bold transition-all"
                              >
                                Refund
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-stone-50/70">
                          <td colSpan={7} className="px-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="space-y-1.5">
                                <h5 className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                                  Item
                                </h5>
                                {order.items?.length ? (
                                  order.items.map((it) => (
                                    <div key={it.id} className="text-stone-700">
                                      <span className="font-semibold">{it.quantity}×</span> {it.item_name}
                                      <span className="text-stone-400 font-mono ml-1">
                                        {formatRupiah(it.line_total)}
                                      </span>
                                      {it.notes && (
                                        <span className="block text-[10px] text-amber-700 italic">
                                          Catatan: {it.notes}
                                        </span>
                                      )}
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-stone-400">Tidak ada item</p>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <h5 className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                                  {order.order_type === 'pickup' ? 'Pengambilan' : 'Pengantaran'}
                                </h5>
                                {order.order_type === 'pickup' ? (
                                  <p className="text-stone-600">Diambil langsung di outlet</p>
                                ) : (
                                  <>
                                    <p className="text-stone-700">{order.delivery_address || '-'}</p>
                                    {order.delivery_notes && (
                                      <p className="text-[10px] text-amber-700 italic">
                                        Patokan: {order.delivery_notes}
                                      </p>
                                    )}
                                    {order.delivery_lat != null && order.delivery_lon != null && (
                                      <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${order.delivery_lat},${order.delivery_lon}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-brand-600 hover:underline font-bold text-[11px] inline-flex items-center gap-1"
                                      >
                                        <i className="fa-solid fa-map-location-dot" aria-hidden="true"></i>
                                        Buka di Google Maps
                                      </a>
                                    )}
                                  </>
                                )}
                                {order.order_type !== 'pickup' && order.status === 'completed' && (
                                  <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">
                                    Pesanan sedang diantar. Pelanggan diarahkan untuk menghubungi WhatsApp outlet.
                                  </p>
                                )}
                              </div>

                              <div className="space-y-1.5">
                                <h5 className="font-bold text-stone-900 text-[11px] uppercase tracking-wider">
                                  Rincian
                                </h5>
                                <div className="flex justify-between text-stone-600">
                                  <span>Subtotal</span>
                                  <span className="font-mono">{formatRupiah(order.subtotal)}</span>
                                </div>
                                {order.order_type !== 'pickup' && (
                                  <div className="flex justify-between text-stone-600">
                                    <span>Ongkir</span>
                                    <span className="font-mono">{formatRupiah(order.delivery_fee)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-stone-600">
                                  <span>Layanan</span>
                                  <span className="font-mono">{formatRupiah(order.service_fee)}</span>
                                </div>
                                {order.discount > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-bold">
                                    <span>Diskon {order.promo_code && `(${order.promo_code})`}</span>
                                    <span className="font-mono">-{formatRupiah(order.discount)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-extrabold text-stone-900 pt-1 border-t border-stone-200">
                                  <span>Total</span>
                                  <span className="font-mono">{formatRupiah(order.grand_total)}</span>
                                </div>
                                {order.rejection_reason && (
                                  <p className="text-[10px] text-red-700 bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                                    Alasan: {order.rejection_reason}
                                  </p>
                                )}
                                {(order.payment?.refund_amount ?? 0) > 0 && (
                                  <p className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 rounded-lg p-2 mt-2">
                                    Direfund {formatRupiah(order.payment!.refund_amount)}
                                    {order.payment?.refunded_at &&
                                      ` pada ${new Date(order.payment.refunded_at).toLocaleString('id-ID')}`}
                                    {order.payment?.refund_reason && ` — ${order.payment.refund_reason}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
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
