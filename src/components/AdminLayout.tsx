import React, { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { useNotifications } from '../context/NotificationContext'
import { NotificationBell } from './NotificationBell'
import { NewOrderToasts } from './NewOrderToasts'
import { adminApi } from '../api/client'

interface NavItem {
  name: string
  path: string
  icon: string
  badge?: number
}

export const AdminLayout: React.FC = () => {
  const { user, logout, isOwner, branches, activeBranchId, setActiveBranchId, activeBranch } = useAuth()
  const { isConnected } = useAdminWebSocket()
  const { unreadCount, setUnreadCount, desktopPermission, requestDesktopPermission, testAlert } = useNotifications()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [dismissedNoticeBanner, setDismissedNoticeBanner] = useState(
    () => sessionStorage.getItem('dismissed_notif_banner') === '1'
  )

  // Seed the unread badge from the database so a reload does not reset it.
  // Scoped to the outlet in view — an owner switching outlets otherwise kept
  // seeing the same (network-wide) count no matter which one was selected.
  useEffect(() => {
    if (!activeBranchId && !isOwner) return

    let cancelled = false
    adminApi
      .getOrders({ status: 'pending', limit: 1, branch_id: isOwner ? (activeBranchId ?? undefined) : undefined })
      .then((res) => {
        if (!cancelled) setUnreadCount(res.unread)
      })
      .catch(() => {
        /* the badge is not worth an error banner */
      })

    return () => {
      cancelled = true
    }
  }, [activeBranchId, isOwner, setUnreadCount])

  useEffect(() => setMobileMenuOpen(false), [location.pathname])

  const navItems: NavItem[] = [
    { name: 'Dashboard', path: '/dashboard', icon: 'fa-solid fa-chart-line' },
    { name: 'Pesanan', path: '/orders', icon: 'fa-solid fa-receipt', badge: unreadCount },
    { name: 'Kelola Menu', path: '/menu', icon: 'fa-solid fa-mug-hot' },
    { name: 'Pengaturan', path: '/settings', icon: 'fa-solid fa-sliders' },
  ]

  const activeTitle = useMemo(
    () => navItems.find((n) => location.pathname.startsWith(n.path))?.name ?? 'Dashboard',
    [location.pathname]
  )

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
      isActive
        ? 'bg-brand-600 text-white shadow-lg'
        : 'text-stone-300 hover:bg-stone-800 hover:text-white'
    }`

  const sidebarContent = (
    <>
      <div>
        <div className="p-6 border-b border-stone-800 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-amber-200 text-xl shadow-lg shrink-0"
            aria-hidden="true"
          >
            <i className={`fa-solid ${isOwner ? 'fa-crown' : 'fa-mug-hot'}`}></i>
          </div>
          <div className="min-w-0">
            <span className="font-serif font-bold text-base block text-white leading-none">Mareme Group</span>
            <span className="text-[11px] text-amber-400 font-medium">
              {isOwner ? 'HQ Portal' : 'Outlet Portal'}
            </span>
          </div>
        </div>

        <div className="px-6 py-4 bg-stone-950/60 border-b border-stone-800 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="text-xs font-bold text-white block truncate">{user?.name}</span>
            <span className="text-[10px] text-stone-400 font-mono block truncate">{user?.phone}</span>
          </div>
          <div
            className="flex items-center gap-1.5 shrink-0"
            title={isConnected ? 'Terhubung ke server pesanan' : 'Terputus dari server pesanan'}
          >
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}
              aria-hidden="true"
            ></span>
            <span className="text-[9px] text-stone-400 uppercase font-bold">
              {isConnected ? 'Live' : 'Off'}
            </span>
          </div>
        </div>

        {/* Outlet switcher. The owner can genuinely change outlet now; every
            request carries the chosen branch_id instead of defaulting to a
            hardcoded UUID on the server. */}
        {isOwner && branches.length > 0 && (
          <div className="px-6 py-4 border-b border-stone-800 space-y-1.5">
            <label
              htmlFor="branch-switcher"
              className="text-[10px] font-bold uppercase tracking-wider text-stone-500"
            >
              Outlet aktif
            </label>
            <select
              id="branch-switcher"
              value={activeBranchId ?? ''}
              onChange={(e) => setActiveBranchId(e.target.value)}
              className="w-full bg-stone-800 border border-stone-700 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.is_open_now ? '' : ' (tutup)'}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isOwner && activeBranch && (
          <div className="px-6 py-4 border-b border-stone-800">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
              Outlet
            </span>
            <span className="text-xs font-bold text-white block truncate">{activeBranch.name}</span>
            <span
              className={`text-[10px] font-bold ${
                activeBranch.is_open_now ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {activeBranch.is_open_now ? 'Buka' : 'Tutup'}
              {activeBranch.today_hours ? ` · ${activeBranch.today_hours}` : ''}
            </span>
          </div>
        )}

        <nav className="p-4 space-y-1" aria-label="Menu utama">
          {navItems.map((item) => (
            <NavLink key={item.path} to={item.path} className={navLinkClass}>
              <span className="flex items-center gap-3 min-w-0">
                <i className={`${item.icon} w-4 text-center shrink-0`} aria-hidden="true"></i>
                <span className="truncate">{item.name}</span>
              </span>
              {item.badge ? (
                <span className="bg-red-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full min-w-5 text-center shrink-0">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-stone-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-stone-300 hover:bg-red-900/40 hover:text-red-200 transition-all"
        >
          <i className="fa-solid fa-arrow-right-from-bracket w-4 text-center" aria-hidden="true"></i>
          <span>Keluar</span>
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[#f5f3ef] text-stone-800">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-stone-900 text-white flex-col justify-between shrink-0 fixed inset-y-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setMobileMenuOpen(false)}
            role="presentation"
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 w-72 bg-stone-900 text-white flex flex-col justify-between z-50 shadow-2xl">
            {sidebarContent}
          </aside>
        </>
      )}

      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-stone-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu"
              className="lg:hidden p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              <i className="fa-solid fa-bars" aria-hidden="true"></i>
            </button>

            <div className="min-w-0">
              <h2 className="font-bold text-sm text-stone-900 truncate">
                {activeTitle}
              </h2>
              {activeBranch && (
                <p className="text-[11px] text-stone-500 truncate">{activeBranch.name}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <Link
              to="/orders"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-colors"
            >
              <i className="fa-solid fa-receipt" aria-hidden="true"></i>
              <span>Pesanan</span>
            </Link>
          </div>
        </header>

        {desktopPermission === 'default' && !dismissedNoticeBanner && (
          <div className="bg-gradient-to-r from-amber-600 via-brand-600 to-amber-700 text-white px-4 sm:px-6 py-2.5 shadow-sm flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <i className="fa-solid fa-bell text-amber-200 text-sm shrink-0 animate-bounce" aria-hidden="true"></i>
              <span className="font-medium truncate sm:whitespace-normal">
                Aktifkan notifikasi browser dan suara agar langsung menerima pemberitahuan setiap ada pesanan masuk.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={async () => {
                  testAlert()
                  await requestDesktopPermission()
                }}
                className="px-3 py-1 bg-white text-stone-900 font-bold rounded-xl hover:bg-amber-50 text-xs shadow transition-all active:scale-95"
              >
                Aktifkan
              </button>
              <button
                onClick={() => {
                  setDismissedNoticeBanner(true)
                  sessionStorage.setItem('dismissed_notif_banner', '1')
                }}
                className="text-white/80 hover:text-white p-1 rounded-lg"
                aria-label="Tutup"
              >
                <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Rendered here so new-order toasts appear on every admin page. */}
      <NewOrderToasts />
    </div>
  )
}
