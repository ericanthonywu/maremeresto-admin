import React from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { formatRupiah } from '../api/client'

/**
 * Stacked toasts for newly arrived orders, rendered by the admin layout so
 * they appear on every page. They persist until dismissed rather than
 * disappearing after five seconds, because an unseen order is a lost order.
 */
export const NewOrderToasts: React.FC = () => {
  const { notices, dismiss, dismissAll } = useNotifications()

  if (notices.length === 0) return null

  const visible = notices.slice(0, 4)
  const hidden = notices.length - visible.length

  return (
    <div
      className="fixed top-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-80 space-y-2"
      role="region"
      aria-label="Pesanan baru"
    >
      {notices.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={dismissAll}
            className="text-[11px] font-bold text-stone-600 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg border border-stone-200 shadow-sm hover:bg-stone-100"
          >
            Tutup semua ({notices.length})
          </button>
        </div>
      )}

      {visible.map((notice) => (
        <div
          key={notice.id}
          role="alert"
          className="bg-white border-l-4 border-emerald-500 rounded-2xl shadow-2xl border border-stone-200 p-4 animate-fade-in"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <i className="fa-solid fa-bell"></i>
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Pesanan baru
                </span>
                <span className="block font-mono font-bold text-xs text-stone-900 truncate">
                  {notice.orderNumber}
                </span>
                <span className="block text-[11px] text-stone-600 truncate">
                  {notice.customerName} · {formatRupiah(notice.grandTotal)}
                </span>
                <span className="block text-[10px] text-stone-400 mt-0.5">
                  {notice.orderType === 'delivery'
                    ? 'Diantar'
                    : notice.orderType === 'pickup'
                      ? 'Ambil sendiri'
                      : 'Dijadwalkan'}
                  {notice.branchName ? ` · ${notice.branchName}` : ''}
                </span>
              </div>
            </div>

            <button
              onClick={() => dismiss(notice.id)}
              aria-label="Tutup notifikasi"
              className="text-stone-400 hover:text-stone-700 p-1 shrink-0"
            >
              <i className="fa-solid fa-xmark text-xs" aria-hidden="true"></i>
            </button>
          </div>

          <Link
            to={`/orders?highlight=${notice.orderId}`}
            onClick={() => dismiss(notice.id)}
            className="mt-3 w-full py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Lihat pesanan</span>
            <i className="fa-solid fa-arrow-right text-[9px]" aria-hidden="true"></i>
          </Link>
        </div>
      ))}

      {hidden > 0 && (
        <Link
          to="/orders"
          className="block text-center text-[11px] font-bold text-stone-700 bg-white/90 backdrop-blur px-3 py-2 rounded-xl border border-stone-200 shadow-sm hover:bg-stone-100"
        >
          +{hidden} pesanan baru lainnya
        </Link>
      )}
    </div>
  )
}
