import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { adminApi } from '../api/client'
import { HourlySalesChart } from '../components/HourlySalesChart'

export const DashboardPage: React.FC = () => {
  const { user, isOwner } = useAuth()
  const { subscribeToOrders } = useAdminWebSocket()
  const [stats, setStats] = useState<any>(null)
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = isOwner
          ? await adminApi.getOwnerDashboard()
          : await adminApi.getBranchDashboard()
        setStats(data)
      } catch (err) {
        console.error('Failed to load dashboard stats', err)
      }
    }
    loadStats()

    const unsub = subscribeToOrders((order) => {
      setNewOrderAlert(order)
      loadStats()
      setTimeout(() => setNewOrderAlert(null), 5000)
    })

    return unsub
  }, [isOwner, subscribeToOrders])

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  return (
    <div className="space-y-6">
      {/* New Order Alert Toast */}
      {newOrderAlert && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce text-xs font-bold border border-emerald-400">
          <i className="fa-solid fa-bell text-lg"></i>
          <div>
            <span className="block">Pesanan Baru Masuk!</span>
            <span className="text-emerald-200 font-mono">{newOrderAlert.order_number}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            {isOwner ? 'HQ Executive Dashboard' : 'Dashboard Outlet'}
          </h1>
          <p className="text-xs text-stone-500">
            Selamat datang kembali, <span className="font-bold text-stone-800">{user?.name}</span>
          </p>
        </div>
        <span className="text-xs text-stone-400 font-mono">
          {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Pesanan Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <i className="fa-solid fa-receipt text-sm"></i>
            </div>
          </div>
          <span className="text-2xl font-extrabold text-stone-900">{stats?.total_orders ?? 0}</span>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            <i className="fa-solid fa-arrow-up text-[9px] mr-0.5"></i> +12% vs kemarin
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Omset Hari Ini</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <i className="fa-solid fa-coins text-sm"></i>
            </div>
          </div>
          <span className="text-2xl font-extrabold text-stone-900">{formatRupiah(stats?.total_revenue ?? 0)}</span>
          <p className="text-[11px] text-emerald-600 font-bold mt-1">
            <i className="fa-solid fa-arrow-up text-[9px] mr-0.5"></i> +8% vs kemarin
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Rata-rata/Order</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <i className="fa-solid fa-chart-simple text-sm"></i>
            </div>
          </div>
          <span className="text-2xl font-extrabold text-stone-900">{formatRupiah(stats?.avg_order ?? 0)}</span>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">Menunggu</span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <i className="fa-solid fa-clock text-sm"></i>
            </div>
          </div>
          <span className="text-2xl font-extrabold text-stone-900">{stats?.pending_orders ?? 0}</span>
          <p className="text-[11px] text-amber-600 font-bold mt-1">
            Perlu ditindak segera
          </p>
        </div>
      </div>

      {/* Hourly Sales Chart */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-base text-stone-900">Performa Penjualan Per Jam</h3>
          <span className="text-[11px] text-stone-400 font-mono">Hari ini, {new Date().toLocaleDateString('id-ID')}</span>
        </div>
        <HourlySalesChart />
      </div>
    </div>
  )
}
