import React from 'react'
import { formatRupiah } from '../api/client'
import type { Order, OrderStatus } from '../types'

export const STATUS_LABELS: Record<OrderStatus, { label: string; bg: string; text: string }> = {
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
export function canRefund(order: Order): boolean {
  return order.payment?.status === 'settlement' && order.status !== 'refunded'
}

/**
 * The next status per order type. Mirrors the server's state machine, so the
 * button never offers a transition the API will reject.
 */
export function nextStatusFor(order: Order): OrderStatus | null {
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

interface OrderRowProps {
  order: Order
  isHighlighted: boolean
  isExpanded: boolean
  isBusy: boolean
  highlightRef?: React.Ref<HTMLTableRowElement>
  onToggleExpand: () => void
  onAdvanceStatus: (order: Order) => void
  onReject: (order: Order) => void
  onRefund: (order: Order) => void
}

export const OrderRow: React.FC<OrderRowProps> = ({
  order,
  isHighlighted,
  isExpanded,
  isBusy,
  highlightRef,
  onToggleExpand,
  onAdvanceStatus,
  onReject,
  onRefund,
}) => {
  const st = STATUS_LABELS[order.status] ?? STATUS_LABELS.pending
  const next = nextStatusFor(order)
  const isUnread = !order.acknowledged_at

  return (
    <React.Fragment>
      <tr
        ref={isHighlighted ? highlightRef : undefined}
        className={`transition-colors ${
          isHighlighted
            ? 'bg-amber-50'
            : isUnread && order.status === 'pending'
              ? 'bg-emerald-50/40'
              : 'hover:bg-stone-50/50'
        } ${isBusy ? 'opacity-60' : ''}`}
      >
        <td className="px-4 py-3 font-mono font-bold text-stone-900 whitespace-nowrap">
          <button
            onClick={onToggleExpand}
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
                onClick={() => onAdvanceStatus(order)}
                disabled={isBusy}
                title={next === 'completed' && order.order_type !== 'pickup' ? 'Tandai pesanan sedang diantar' : undefined}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                {isBusy ? '...' : next === 'completed' && order.order_type !== 'pickup' ? '→ Sedang diantar' : `→ ${STATUS_LABELS[next]?.label ?? next}`}
              </button>
            )}

            {order.status === 'accepted' && (
              <button
                onClick={() => onReject(order)}
                disabled={isBusy}
                className="px-2.5 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 rounded-lg text-[10px] font-bold transition-all"
              >
                Tolak
              </button>
            )}

            {canRefund(order) && (
              <button
                onClick={() => onRefund(order)}
                disabled={isBusy}
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
}
