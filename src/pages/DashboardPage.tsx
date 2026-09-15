import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdminWebSocket } from '../context/AdminWebSocketContext'
import { adminApi, errorMessage, formatRupiah } from '../api/client'
import { HourlySalesChart } from '../components/HourlySalesChart'
import type { DashboardStats } from '../types'

/** Renders a day-over-day delta, or an honest dash when there is no baseline. */
const DeltaBadge: React.FC<{ value: number | null; label?: string }> = ({
  value,
  label = 'vs kemarin',
}) => {
  if (value === null || !Number.isFinite(value)) {
    return <span className="text-[10px] text-stone-400 font-medium inline-block mt-2">Belum ada data pembanding</span>
  }

  const rising = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full mt-2 ${
        rising ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
      }`}
    >
      <i
        className={`fa-solid ${rising ? 'fa-arrow-up' : 'fa-arrow-down'} text-[8px]`}
        aria-hidden="true"
      ></i>
      {rising ? '+' : ''}
      {value.toFixed(1)}% {label}
    </span>
  )
}

export const DashboardPage: React.FC = () => {
  const { user, isOwner, activeBranchId, activeBranch, branches } = useAuth()
  const { subscribeToOrders, subscribeToStatusUpdates } = useAdminWebSocket()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'branch' | 'network'>(isOwner ? 'network' : 'branch')

  const loadStats = useCallback(async () => {
    setError(null)
    try {
      const data =
        isOwner && scope === 'network'
          ? await adminApi.getOwnerDashboard()
          : isOwner
            ? await adminApi.getOwnerDashboard(activeBranchId ?? undefined)
            : activeBranchId
              ? await adminApi.getBranchDashboard(activeBranchId)
              : null

      if (data) setStats(data)
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat statistik.'))
    } finally {
      setLoading(false)
    }
  }, [isOwner, scope, activeBranchId])

  useEffect(() => {
    setLoading(true)
    void loadStats()
  }, [loadStats])

  // Keep the figures live: a new order or a status change both move them.
  useEffect(() => {
    const unsubOrders = subscribeToOrders(() => void loadStats())
    const unsubStatus = subscribeToStatusUpdates(() => void loadStats())
    return () => {
      unsubOrders()
      unsubStatus()
    }
  }, [subscribeToOrders, subscribeToStatusUpdates, loadStats])

  const scopeLabel =
    isOwner && scope === 'network' ? 'Seluruh jaringan' : (activeBranch?.name ?? 'Outlet')

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            {isOwner ? 'Dashboard HQ' : 'Dashboard Outlet'}
          </h1>
          <p className="text-xs text-stone-500">
            Selamat datang, <span className="font-bold text-stone-800">{user?.name}</span> · {scopeLabel}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isOwner && branches.length > 1 && (
            <div className="flex gap-1 bg-white border border-stone-300 rounded-xl p-1">
              <button
                onClick={() => setScope('network')}
                aria-pressed={scope === 'network'}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  scope === 'network' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Jaringan
              </button>
              <button
                onClick={() => setScope('branch')}
                aria-pressed={scope === 'branch'}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  scope === 'branch' ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                Per outlet
              </button>
            </div>
          )}

          <span className="text-xs text-stone-400 font-mono">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
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
          <button onClick={() => void loadStats()} className="underline shrink-0 font-bold">
            Coba lagi
          </button>
        </div>
      )}

      {/* Stat tiles. Every number, including the deltas, comes from the API. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
              Pesanan Hari Ini
            </span>
            <div
              className="w-9 h-9 rounded-2xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0 shadow-inner"
              aria-hidden="true"
            >
              <i className="fa-solid fa-receipt text-sm"></i>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-mono">
            {loading ? '—' : stats?.total_orders ?? 0}
          </div>
          {!loading && <DeltaBadge value={stats?.orders_delta_pct ?? null} />}
        </div>

        <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
              Omset Hari Ini
            </span>
            <div
              className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-inner"
              aria-hidden="true"
            >
              <i className="fa-solid fa-coins text-sm"></i>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 break-all font-mono">
            {loading ? '—' : formatRupiah(stats?.total_revenue ?? 0)}
          </div>
          {!loading && <DeltaBadge value={stats?.revenue_delta_pct ?? null} />}
          <p className="text-[10px] text-stone-400 mt-1">Selesai / Lunas</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
              Rata-Rata / Order
            </span>
            <div
              className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shrink-0 shadow-inner"
              aria-hidden="true"
            >
              <i className="fa-solid fa-chart-simple text-sm"></i>
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-extrabold text-stone-900 break-all font-mono">
            {loading ? '—' : formatRupiah(stats?.avg_order ?? 0)}
          </div>
          {!loading && (
            <p className="text-[10px] text-stone-400 font-medium mt-2">
              {stats?.completed_orders ?? 0} selesai · {stats?.cancelled_orders ?? 0} batal
            </p>
          )}
        </div>

        <Link
          to="/orders?status=pending"
          className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-sm hover:border-brand-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between mb-3 gap-2">
            <span className="text-[11px] text-stone-500 font-bold uppercase tracking-wider">
              Pesanan Menunggu
            </span>
            <div
              className={`w-9 h-9 rounded-2xl ${
                (stats?.pending_orders ?? 0) > 0 ? 'bg-red-50 border border-red-200 text-red-600 animate-pulse' : 'bg-stone-50 border border-stone-200 text-stone-500'
              } flex items-center justify-center shrink-0 shadow-inner`}
              aria-hidden="true"
            >
              <i className="fa-solid fa-clock text-sm"></i>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-stone-900 font-mono">
            {loading ? '—' : stats?.pending_orders ?? 0}
          </div>
          <p className="text-[11px] text-brand-600 font-bold mt-2 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
            <span>Buka daftar pesanan</span>
            <i className="fa-solid fa-arrow-right text-[9px]" aria-hidden="true"></i>
          </p>
        </Link>
      </div>

      {/* Hourly chart, driven by real data */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-serif font-bold text-base text-stone-900">Penjualan per jam</h3>
          <div className="flex items-center gap-3 text-[10px] text-stone-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-brand-600" aria-hidden="true"></span> Pesanan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-0.5 bg-emerald-500" aria-hidden="true"></span> Omset
            </span>
          </div>
        </div>
        <HourlySalesChart data={stats?.hourly ?? []} loading={loading} />
      </div>

      {/* Owner-only per-outlet breakdown */}
      {isOwner && stats?.branches && stats.branches.length > 0 && (
        <div className="bg-white rounded-3xl p-4 sm:p-6 border border-stone-200 shadow-sm">
          <h3 className="font-serif font-bold text-base text-stone-900 mb-4">Performa per outlet</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-stone-200">
                <tr>
                  <th className="text-left py-2 font-bold text-stone-500 uppercase tracking-wider">Outlet</th>
                  <th className="text-right py-2 font-bold text-stone-500 uppercase tracking-wider">Pesanan</th>
                  <th className="text-right py-2 font-bold text-stone-500 uppercase tracking-wider">Omset</th>
                  <th className="text-right py-2 font-bold text-stone-500 uppercase tracking-wider">Kontribusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {stats.branches.map((b) => {
                  const share =
                    stats.total_revenue > 0 ? (b.revenue / stats.total_revenue) * 100 : 0
                  return (
                    <tr key={b.branch_id} className="hover:bg-stone-50/50">
                      <td className="py-2.5 font-bold text-stone-900">{b.branch_name}</td>
                      <td className="py-2.5 text-right font-mono text-stone-700">{b.orders}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-stone-900">
                        {formatRupiah(b.revenue)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-flex items-center gap-2 justify-end">
                          <span className="w-16 h-1.5 bg-stone-100 rounded-full overflow-hidden hidden sm:block">
                            <span
                              className="block h-full bg-brand-500 rounded-full"
                              style={{ width: `${share}%` }}
                            ></span>
                          </span>
                          <span className="font-mono text-stone-600">{share.toFixed(0)}%</span>
                        </span>
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
