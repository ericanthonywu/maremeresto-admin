import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'

interface HourlyData {
  hour: string
  orders: number
  revenue: number
}

const DEFAULT_HOURLY: HourlyData[] = [
  { hour: '08:00', orders: 12, revenue: 380000 },
  { hour: '09:00', orders: 24, revenue: 760000 },
  { hour: '10:00', orders: 19, revenue: 610000 },
  { hour: '11:00', orders: 35, revenue: 1120000 },
  { hour: '12:00', orders: 48, revenue: 1540000 },
  { hour: '13:00', orders: 42, revenue: 1350000 },
  { hour: '14:00', orders: 28, revenue: 890000 },
  { hour: '15:00', orders: 31, revenue: 990000 },
  { hour: '16:00', orders: 38, revenue: 1210000 },
  { hour: '17:00', orders: 45, revenue: 1440000 },
  { hour: '18:00', orders: 29, revenue: 920000 },
  { hour: '19:00', orders: 20, revenue: 640000 },
]

export const HourlySalesChart: React.FC<{ data?: HourlyData[] }> = ({ data = DEFAULT_HOURLY }) => {
  const formatRupiah = (val: number) =>
    `Rp ${(val / 1000).toFixed(0)}k`

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="hour" stroke="#9ca3af" fontSize={11} tickLine={false} />
          <YAxis
            yAxisId="left"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            tickFormatter={(v) => `${v} pesanan`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#9ca3af"
            fontSize={11}
            tickLine={false}
            tickFormatter={formatRupiah}
          />
          <Tooltip
            formatter={(value: any, name: any) => {
              if (name === 'orders') return [`${value} pesanan`, 'Pesanan']
              return [`Rp ${Number(value).toLocaleString('id-ID')}`, 'Omset']
            }}
            contentStyle={{
              backgroundColor: '#1c1917',
              borderRadius: '16px',
              border: 'none',
              color: '#fff',
              fontSize: '12px',
            }}
          />
          <Bar yAxisId="left" dataKey="orders" fill="#c87028" radius={[8, 8, 0, 0]} barSize={20} />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="revenue"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, fill: '#10b981' }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
