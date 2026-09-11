import React from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HourlySalesPoint } from '../types'

interface HourlySalesChartProps {
  /** Real per-hour figures from the API. There is no built-in sample data. */
  data: HourlySalesPoint[]
  loading?: boolean
}

const compactRupiah = (value: number): string => {
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}jt`
  if (value >= 1_000) return `Rp ${Math.round(value / 1_000)}rb`
  return `Rp ${value}`
}

export const HourlySalesChart: React.FC<HourlySalesChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="w-full h-72 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand-600" aria-hidden="true"></i>
        <span className="sr-only">Memuat grafik</span>
      </div>
    )
  }

  const hasActivity = data.some((point) => point.orders > 0)

  if (!hasActivity) {
    // Be explicit that there is genuinely nothing yet, rather than drawing an
    // invented curve. The previous chart always rendered the same 12 fake bars.
    return (
      <div className="w-full h-72 flex flex-col items-center justify-center text-center gap-2 bg-stone-50/60 rounded-2xl border border-dashed border-stone-200">
        <i className="fa-solid fa-chart-column text-3xl text-stone-300" aria-hidden="true"></i>
        <h4 className="font-bold text-stone-700 text-sm">Belum ada penjualan hari ini</h4>
        <p className="text-xs text-stone-400 max-w-xs">
          Grafik akan terisi otomatis begitu pesanan pertama hari ini masuk.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
          <XAxis dataKey="hour" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis
            yAxisId="orders"
            stroke="#a8a29e"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={34}
          />
          <YAxis
            yAxisId="revenue"
            orientation="right"
            stroke="#a8a29e"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={compactRupiah}
            width={60}
          />
          <Tooltip
            formatter={(value, name) =>
              name === 'orders'
                ? [`${Number(value ?? 0)} pesanan`, 'Pesanan']
                : [`Rp ${Number(value ?? 0).toLocaleString('id-ID')}`, 'Omset']
            }
            labelFormatter={(label) => `Jam ${label}`}
            contentStyle={{
              backgroundColor: '#1c1917',
              borderRadius: '14px',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
              padding: '8px 12px',
            }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ color: '#d6d3d1', fontWeight: 700, marginBottom: 4 }}
          />
          <Bar yAxisId="orders" dataKey="orders" fill="#c87028" radius={[6, 6, 0, 0]} maxBarSize={24} />
          <Line
            yAxisId="revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 5 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
