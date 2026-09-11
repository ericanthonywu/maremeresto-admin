import React, { useEffect, useState, useCallback } from 'react'
import { adminApi } from '../api/client'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import type { Order } from '../types'

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'Menunggu', bg: 'bg-amber-100', text: 'text-amber-800' },
  accepted: { label: 'Diterima', bg: 'bg-blue-100', text: 'text-blue-800' },
  preparing: { label: 'Disiapkan', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  ready: { label: 'Siap', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  on_the_way: { label: 'Diantar', bg: 'bg-cyan-100', text: 'text-cyan-800' },
  delivered: { label: 'Terkirim', bg: 'bg-green-100', text: 'text-green-800' },
  completed: { label: 'Selesai', bg: 'bg-stone-100', text: 'text-stone-600' },
  rejected: { label: 'Ditolak', bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-50', text: 'text-red-600' },
}

const NEXT_STATUS: Record<string, string> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'on_the_way',
  on_the_way: 'delivered',
  delivered: 'completed',
}

export const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const { subscribeToOrders, subscribeToStatusUpdates } = useAdminWebSocket()

  const loadOrders = useCallback(async () => {
    try {
      const res = await adminApi.getOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: searchQuery || undefined,
      })
      setOrders(res.data || [])
      setTotal(res.total || 0)
    } catch (err) {
      console.error('Failed to load orders', err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  useEffect(() => {
    const unsub1 = subscribeToOrders(() => loadOrders())
    const unsub2 = subscribeToStatusUpdates(() => loadOrders())
    return () => { unsub1(); unsub2() }
  }, [subscribeToOrders, subscribeToStatusUpdates, loadOrders])

  const handleAdvanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    try {
      await adminApi.updateOrderStatus(order.id, next, order.version)
      loadOrders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal update status. Mungkin ada perubahan bersamaan.')
      loadOrders()
    }
  }

  const handleRejectOrder = async (order: Order) => {
    const reason = prompt('Alasan penolakan pesanan:')
    if (!reason) return
    try {
      await adminApi.updateOrderStatus(order.id, 'rejected', order.version, reason)
      loadOrders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Gagal menolak pesanan.')
    }
  }

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const statusFilters = ['all', 'pending', 'accepted', 'preparing', 'ready', 'on_the_way', 'delivered', 'completed']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-serif text-2xl font-bold text-stone-900">Pesanan Masuk</h1>
        <span className="text-xs text-stone-400 font-bold">{total} pesanan total</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {statusFilters.map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-brand-600 text-white shadow'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-100'
              }`}
            >
              {st === 'all' ? 'Semua' : STATUS_LABELS[st]?.label || st}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nomor pesanan / nama..."
          className="px-4 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500 w-48"
        />
      </div>

      {/* Orders Table */}
      {loading ? (
        <div className="py-20 flex justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600"></i>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm">
          <i className="fa-solid fa-inbox text-4xl text-stone-300 mb-3"></i>
          <h3 className="font-bold text-stone-800 text-sm">Tidak ada pesanan ditemukan</h3>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">No. Pesanan</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Pelanggan</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Item</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Total</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Waktu</th>
                  <th className="text-left px-4 py-3 font-bold text-stone-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {orders.map((order) => {
                  const st = STATUS_LABELS[order.status] || STATUS_LABELS['pending']
                  const nextStatus = NEXT_STATUS[order.status]
                  return (
                    <tr key={order.id} className="hover:bg-stone-50/50">
                      <td className="px-4 py-3 font-mono font-bold text-stone-900">{order.order_number}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-stone-900 block">{order.customer_name}</span>
                        <span className="text-stone-400 font-mono text-[10px]">{order.customer_phone}</span>
                      </td>
                      <td className="px-4 py-3 text-stone-600">
                        {order.items?.map((it) => `${it.quantity}x ${it.item_name}`).join(', ') || '-'}
                      </td>
                      <td className="px-4 py-3 font-bold text-stone-900">{formatRupiah(order.grand_total)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-lg ${st.bg} ${st.text} font-extrabold text-[10px] uppercase`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-stone-400 font-mono">
                        {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {nextStatus && (
                            <button
                              onClick={() => handleAdvanceStatus(order)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95"
                            >
                              {STATUS_LABELS[nextStatus]?.label || nextStatus}
                            </button>
                          )}
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleRejectOrder(order)}
                              className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-[10px] font-bold transition-all"
                            >
                              Tolak
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
