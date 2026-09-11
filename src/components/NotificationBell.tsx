import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useNotifications } from '../context/NotificationContext'
import { adminApi, formatRupiah } from '../api/client'

/**
 * Header bell showing the unread-order backlog, plus the controls for sound
 * and desktop notifications. The count is seeded from the server, so it
 * survives a reload instead of living only in this tab's memory.
 */
export const NotificationBell: React.FC = () => {
  const {
    notices,
    unreadCount,
    setUnreadCount,
    dismissAll,
    soundEnabled,
    toggleSound,
    desktopPermission,
    requestDesktopPermission,
    testAlert,
  } = useNotifications()

  const [open, setOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const handleMarkRead = async () => {
    setMarking(true)
    try {
      const result = await adminApi.acknowledgeOrders()
      setUnreadCount(result.unread)
      dismissAll()
    } catch {
      // Leave the badge alone if the server could not be reached; it is better
      // to over-report unread orders than to hide one.
    } finally {
      setMarking(false)
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Notifikasi${unreadCount > 0 ? `, ${unreadCount} belum dibaca` : ''}`}
        className="relative p-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors"
      >
        <i className="fa-solid fa-bell text-base" aria-hidden="true"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-5 h-5 px-1 text-[10px] font-extrabold text-white bg-red-600 rounded-full shadow animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-stone-200 shadow-2xl overflow-hidden z-50">
          <div className="p-3 border-b border-stone-100 flex items-center justify-between gap-2">
            <span className="font-bold text-xs text-stone-900">
              Pesanan belum ditangani {unreadCount > 0 && `(${unreadCount})`}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkRead}
                disabled={marking}
                className="text-[11px] font-bold text-brand-600 hover:underline disabled:opacity-50"
              >
                {marking ? 'Menandai...' : 'Tandai sudah dilihat'}
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {notices.length === 0 ? (
              <p className="p-4 text-[11px] text-stone-400 text-center">
                {unreadCount > 0
                  ? `${unreadCount} pesanan menunggu. Buka halaman Pesanan untuk menanganinya.`
                  : 'Belum ada notifikasi baru.'}
              </p>
            ) : (
              <ul className="divide-y divide-stone-100">
                {notices.map((n) => (
                  <li key={n.id}>
                    <Link
                      to={`/orders?highlight=${n.orderId}`}
                      onClick={() => setOpen(false)}
                      className="block p-3 hover:bg-stone-50 transition-colors"
                    >
                      <span className="font-mono font-bold text-[11px] text-stone-900 block">
                        {n.orderNumber}
                      </span>
                      <span className="text-[11px] text-stone-600 block truncate">
                        {n.customerName} · {formatRupiah(n.grandTotal)}
                      </span>
                      <span className="text-[10px] text-stone-400">
                        {new Date(n.receivedAt).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Alert preferences */}
          <div className="p-3 border-t border-stone-100 bg-stone-50 space-y-2">
            <button
              onClick={toggleSound}
              className="w-full flex items-center justify-between text-[11px] font-semibold text-stone-700 hover:text-stone-900"
            >
              <span className="flex items-center gap-2">
                <i
                  className={`fa-solid ${soundEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark text-stone-400'}`}
                  aria-hidden="true"
                ></i>
                Suara notifikasi
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                  soundEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-500'
                }`}
              >
                {soundEnabled ? 'AKTIF' : 'MATI'}
              </span>
            </button>

            {desktopPermission === 'granted' ? (
              <button
                onClick={testAlert}
                className="w-full text-left flex items-center justify-between text-[11px] font-semibold text-stone-700 hover:text-stone-900"
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-desktop text-emerald-600" aria-hidden="true"></i>
                  Notifikasi desktop
                </span>
                <span className="text-[10px] font-extrabold text-brand-600 underline">Uji coba</span>
              </button>
            ) : desktopPermission === 'denied' ? (
              <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                Notifikasi desktop diblokir. Aktifkan kembali lewat ikon kunci di address bar browser
                agar pesanan baru tetap terlihat saat tab ini tidak aktif.
              </p>
            ) : desktopPermission === 'unsupported' ? (
              <p className="text-[10px] text-stone-500">Browser ini tidak mendukung notifikasi desktop.</p>
            ) : (
              <button
                onClick={() => void requestDesktopPermission()}
                className="w-full py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-desktop" aria-hidden="true"></i>
                Aktifkan notifikasi desktop
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
