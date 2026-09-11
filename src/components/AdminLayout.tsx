import React, { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'

export const AdminLayout: React.FC = () => {
  const { user, logout, isOwner } = useAuth()
  const { isConnected } = useAdminWebSocket()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const branchNav = [
    { name: 'Dashboard', path: '/dashboard', icon: 'fa-solid fa-chart-line' },
    { name: 'Pesanan Masuk', path: '/orders', icon: 'fa-solid fa-receipt' },
    { name: 'Kelola Menu', path: '/menu', icon: 'fa-solid fa-mug-hot' },
    { name: 'Pengaturan Outlet', path: '/settings', icon: 'fa-solid fa-sliders' },
  ]

  const ownerNav = [
    { name: 'HQ Dashboard', path: '/owner/dashboard', icon: 'fa-solid fa-crown' },
    { name: 'Semua Pesanan', path: '/owner/orders', icon: 'fa-solid fa-receipt' },
    { name: 'Cabang & Outlet', path: '/owner/branches', icon: 'fa-solid fa-network-wired' },
    { name: 'Analytics & Omset', path: '/owner/analytics', icon: 'fa-solid fa-chart-pie' },
  ]

  const navItems = isOwner ? ownerNav : branchNav

  return (
    <div className="min-h-screen bg-[#f5f3ef] text-stone-800 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 bg-stone-900 text-white flex-col justify-between shrink-0 fixed inset-y-0 z-30">
        <div>
          {/* Brand Logo Header */}
          <div className="p-6 border-b border-stone-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center text-amber-200 text-xl font-bold shadow-lg">
              {isOwner ? <i className="fa-solid fa-crown"></i> : <i className="fa-solid fa-mug-hot"></i>}
            </div>
            <div>
              <span className="font-serif font-bold text-base block text-white leading-none">
                Cafe Olga
              </span>
              <span className="text-[11px] text-amber-400 font-medium">
                {isOwner ? 'HQ Executive Portal' : 'Outlet Barista Portal'}
              </span>
            </div>
          </div>

          {/* User Profile Strip */}
          <div className="px-6 py-4 bg-stone-950/60 border-b border-stone-800 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-xs font-bold text-white block truncate">{user?.name}</span>
              <span className="text-[10px] text-stone-400 font-mono block">{user?.phone}</span>
            </div>
            <div className="flex items-center gap-1.5" title={isConnected ? 'Live WebSocket Terhubung' : 'Terputus'}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-[9px] text-stone-400 uppercase font-bold">{isConnected ? 'Live' : 'Off'}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1.5">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-stone-400 hover:text-white hover:bg-stone-800'
                  }`}
                >
                  <i className={`${item.icon} text-sm`}></i>
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Sidebar Footer Logout */}
        <div className="p-4 border-t border-stone-800">
          <button
            onClick={logout}
            className="w-full py-3 px-4 rounded-2xl bg-stone-800/80 hover:bg-red-900/60 hover:text-red-200 text-stone-400 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Keluar Sistem</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-stone-200 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700"
            >
              <i className="fa-solid fa-bars text-lg"></i>
            </button>
            <h2 className="font-serif font-bold text-lg text-stone-900 hidden sm:block">
              {isOwner ? 'HQ Executive Portal' : 'Outlet Barista Management'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-xs text-stone-700 font-semibold">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
              <span>{isConnected ? 'Real-time Aktif' : 'Terputus'}</span>
            </div>
            <button
              onClick={logout}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-red-600 font-bold"
            >
              <i className="fa-solid fa-arrow-right-from-bracket"></i>
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-stone-900 text-white p-4 border-b border-stone-800 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold text-stone-300 hover:text-white hover:bg-stone-800"
              >
                <i className={`${item.icon} text-sm`}></i>
                <span>{item.name}</span>
              </Link>
            ))}
            <button
              onClick={logout}
              className="w-full text-left px-4 py-3 text-xs text-red-400 font-bold hover:bg-stone-800 rounded-xl"
            >
              Keluar
            </button>
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
