import React from 'react'
import { formatRupiah } from '../api/client'
import type { Order, OrderStatus } from '../types'

function formatWhatsAppNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  if (digits.startsWith('8')) return `62${digits}`
  return digits
}

export const STATUS_LABELS: Record<OrderStatus, { label: string; bg: string; text: string }> = {
  pending: { label: 'Menunggu', bg: 'bg-amber-100', text: 'text-amber-800' },
  accepted: { label: 'Belum Panggil Kurir', bg: 'bg-amber-100', text: 'text-amber-800' },
  // Legacy values can still render safely before migration 8 is applied.
  preparing: { label: 'Belum Panggil Kurir', bg: 'bg-amber-100', text: 'text-amber-800' },
  ready: { label: 'Belum Panggil Kurir', bg: 'bg-amber-100', text: 'text-amber-800' },
  on_the_way: { label: 'Dalam Pengiriman', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  picked_up: { label: 'Dalam Pengiriman', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  delivered: { label: 'Terkirim', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  completed: { label: 'Selesai', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  rejected: { label: 'Ditolak', bg: 'bg-red-100', text: 'text-red-800' },
  cancelled: { label: 'Dibatalkan', bg: 'bg-red-50', text: 'text-red-600' },
  refunded: { label: 'Direfund', bg: 'bg-purple-100', text: 'text-purple-800' },
}

export function statusBadgeFor(order: Order): { label: string; bg: string; text: string } {
  if (order.order_type === 'pickup') {
    switch (order.status) {
      case 'accepted':
      case 'preparing':
      case 'ready':
      case 'on_the_way':
        return { label: 'Belum diambil', bg: 'bg-amber-100', text: 'text-amber-800' }
      case 'picked_up':
      case 'delivered':
      case 'completed':
        return { label: 'Sudah diambil', bg: 'bg-emerald-100', text: 'text-emerald-800' }
      default:
        break
    }
  } else if (order.biteship_status && order.status !== 'rejected' && order.status !== 'cancelled' && order.status !== 'refunded') {
    const info = biteshipStatusInfo(order.biteship_status)
    return { label: info.label, bg: info.color, text: '' }
  }
  return STATUS_LABELS[order.status] ?? STATUS_LABELS.pending
}

export function nextActionLabelFor(order: Order, next: OrderStatus): string {
  if (next === 'accepted') return '→ Terima'
  if (next === 'completed') {
    return order.order_type === 'pickup' ? '→ Sudah diambil' : '→ Selesai'
  }
  return `→ ${STATUS_LABELS[next]?.label ?? next}`
}

export function effectiveOrderTime(order: Order): string {
  if (order.order_type === 'scheduled' && order.scheduled_at) {
    return order.scheduled_at
  }
  return order.created_at
}

export function formatOrderDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

function formatScheduledShort(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

function formatScheduledFull(iso?: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
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
  onDispatchCourier: (order: Order, courierCompany?: 'gojek' | 'grab') => void
  onReject: (order: Order) => void
  onRefund: (order: Order) => void
}

function biteshipStatusInfo(status?: string): { label: string; color: string } {
  switch ((status || '').toLowerCase().trim()) {
    case 'placed':
      return { label: 'Menunggu Konfirmasi', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'confirmed':
      return { label: 'Mencari Driver', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'scheduled':
      return { label: 'Dijadwalkan', color: 'bg-amber-50 text-amber-800 border-amber-200' }
    case 'allocated':
      return { label: 'Driver Ditemukan', color: 'bg-blue-50 text-blue-800 border-blue-200' }
    case 'picking_up':
      return { label: 'Menuju Outlet', color: 'bg-indigo-50 text-indigo-800 border-indigo-200' }
    case 'picked':
      return { label: 'Diambil Driver', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'in_transit':
      return { label: 'Dalam Perjalanan', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'dropping_off':
      return { label: 'Menuju Tujuan', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' }
    case 'delivered':
      return { label: 'Terkirim', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' }
    case 'on_hold':
      return { label: 'Ditahan Kurir', color: 'bg-amber-50 text-amber-900 border-amber-300' }
    case 'return_in_transit':
      return { label: 'Retur ke Outlet', color: 'bg-orange-50 text-orange-800 border-orange-200' }
    case 'returned':
      return { label: 'Kembali ke Outlet', color: 'bg-red-50 text-red-700 border-red-200' }
    case 'disposed':
      return { label: 'Dihentikan', color: 'bg-red-50 text-red-700 border-red-200' }
    case 'cancelled':
      return { label: 'Kurir Dibatalkan', color: 'bg-red-50 text-red-700 border-red-200' }
    case 'rejected':
      return { label: 'Ditolak Kurir', color: 'bg-red-50 text-red-700 border-red-200' }
    case 'courier_not_found':
      return { label: 'Driver Tidak Ditemukan', color: 'bg-red-50 text-red-700 border-red-200' }
    default:
      return { label: status || 'Memproses', color: 'bg-stone-100 text-stone-700 border-stone-200' }
  }
}

function canDispatchBiteship(order: Order): boolean {
  if (order.order_type === 'pickup') return false
  if (order.status === 'pending' || order.status === 'cancelled' || order.status === 'rejected' || order.status === 'refunded') {
    return false
  }
  if (!order.biteship_order_id) return true
  const st = (order.biteship_status || '').toLowerCase().trim()
  return st === 'cancelled' || st === 'rejected' || st === 'courier_not_found' || st === 'returned'
}

export const OrderRow: React.FC<OrderRowProps> = ({
  order,
  isHighlighted,
  isExpanded,
  isBusy,
  highlightRef,
  onToggleExpand,
  onAdvanceStatus,
  onDispatchCourier,
  onReject,
  onRefund,
}) => {
  const st = statusBadgeFor(order)
  const next = nextStatusFor(order)
  const canDispatch = canDispatchBiteship(order)
  const defaultCourier: 'gojek' | 'grab' = order.courier_company === 'grab' ? 'grab' : 'gojek'
  const isUnread = !order.acknowledged_at
  const scheduledShort = order.order_type === 'scheduled' ? formatScheduledShort(order.scheduled_at) : null
  const scheduledFull = order.order_type === 'scheduled' ? formatScheduledFull(order.scheduled_at) : null

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
          {order.branch?.name && (
            <span className="block text-[10px] font-sans font-semibold text-stone-500 mt-0.5">
              {order.branch.name}
            </span>
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
          <span className="text-stone-700 font-semibold">
            {order.order_type === 'delivery'
              ? 'Antar'
              : order.order_type === 'pickup'
                ? 'Ambil di Cabang'
                : 'Jadwal'}
          </span>
          {scheduledShort && (
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100/80 px-1.5 py-0.5 rounded-md w-fit">
              <i className="fa-regular fa-clock text-[9px]" aria-hidden="true"></i>
              {scheduledShort}
            </span>
          )}
          {order.order_type !== 'pickup' && (
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              {order.courier_name && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    order.courier_type === 'cod' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {order.courier_name}
                </span>
              )}
              {order.biteship_waybill_id && (
                <span className="text-[10px] font-mono text-stone-500">
                  Resi: {order.biteship_waybill_id}
                </span>
              )}
              {order.delivery_lat != null && order.delivery_lon != null && (
                <a
                  href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-600 hover:text-emerald-700 font-bold text-[10px] inline-flex items-center gap-0.5 hover:underline"
                  title="Buka titik Google Maps"
                >
                  <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
                  <span>Maps</span>
                </a>
              )}
            </div>
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

        <td className="px-4 py-3 font-mono whitespace-nowrap">
          <span className="block text-stone-700 font-semibold">
            {formatOrderDateTime(effectiveOrderTime(order))}
          </span>
          {order.order_type === 'scheduled' && order.scheduled_at && (
            <span className="block text-[10px] text-stone-400">
              Dipesan: {formatOrderDateTime(order.created_at)}
            </span>
          )}
        </td>

        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {order.order_type !== 'pickup' ? (
              canDispatch ? (
                <button
                  onClick={() => onDispatchCourier(order, defaultCourier)}
                  disabled={isBusy}
                  title={`Panggil kurir ${order.courier_name || (defaultCourier === 'grab' ? 'GrabExpress Instant' : 'GoSend Instant')} lewat Biteship`}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
                >
                  {isBusy ? '...' : `${order.biteship_order_id ? '🛵 Panggil Ulang' : '🛵 Panggil'} ${defaultCourier === 'grab' ? 'Grab' : 'GoSend'}`}
                </button>
              ) : order.biteship_tracking_url ? (
                <a
                  href={order.biteship_tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-stone-900 hover:bg-black text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                >
                  <span>Lacak</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden="true" />
                </a>
              ) : null
            ) : next ? (
              <button
                onClick={() => onAdvanceStatus(order)}
                disabled={isBusy}
                title="Tandai pesanan sudah diambil pelanggan"
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
              >
                {isBusy ? '...' : nextActionLabelFor(order, next)}
              </button>
            ) : null}

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
                  {order.order_type === 'pickup' ? 'Pengambilan di Cabang' : 'Pengantaran'}
                </h5>
                {scheduledFull && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <i className="fa-regular fa-clock text-amber-700" aria-hidden="true"></i>
                    <span>Jadwal Antar: {scheduledFull}</span>
                  </div>
                )}
                {order.order_type === 'pickup' ? (
                  <>
                    <p className="text-stone-700 font-medium">
                      Diambil langsung di outlet{order.branch?.name ? ` (${order.branch.name})` : ''}
                    </p>
                    {order.delivery_notes && (
                      <p className="text-[10px] text-amber-700 italic">
                        Catatan: {order.delivery_notes}
                      </p>
                    )}
                    {order.status === 'completed' && (
                      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[10px] font-semibold text-emerald-800">
                        Pesanan sudah diambil oleh pelanggan di cabang.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                          Titik Pickup Kurir (Cabang Asal)
                        </span>
                        {order.branch?.name && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white border border-amber-200 text-amber-900">
                            {order.branch.name}
                          </span>
                        )}
                      </div>
                      <p className="text-stone-800 text-xs font-semibold leading-relaxed">
                        {order.branch?.address || '-'}
                      </p>
                      {(order.branch?.latitude != null && order.branch?.longitude != null) && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <span className="text-[10px] font-mono text-stone-600">
                            📍 {order.branch.latitude.toFixed(5)}, {order.branch.longitude.toFixed(5)}
                          </span>
                          {(order.branch.whatsapp_number || order.branch.phone) && (
                            <span className="text-[10px] font-mono text-stone-600">
                              · {order.branch.whatsapp_number || order.branch.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 space-y-2">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-stone-400 tracking-wider">
                        Alamat Pengiriman (Titik Antar)
                      </span>
                      <p className="text-stone-800 text-xs font-semibold leading-relaxed mt-0.5">
                        {order.delivery_address || '-'}
                      </p>
                    </div>

                    {order.delivery_notes && (
                      <div className="text-[11px] bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-2 flex items-start gap-1.5">
                        <i className="fa-solid fa-note-sticky text-amber-600 mt-0.5 text-xs shrink-0" aria-hidden="true" />
                        <div>
                          <strong className="font-semibold">Patokan / Catatan:</strong>{' '}
                          <span>{order.delivery_notes}</span>
                        </div>
                      </div>
                    )}

                    {order.delivery_lat != null && order.delivery_lon != null && (
                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono bg-stone-200/80 text-stone-700 px-2 py-0.5 rounded-md">
                          📍 {order.delivery_lat.toFixed(6)}, {order.delivery_lon.toFixed(6)}
                        </span>
                        <a
                          href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lon}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                          title="Buka titik koordinat pelanggan langsung di Google Maps"
                        >
                          <i className="fa-solid fa-map-location-dot" aria-hidden="true" />
                          <span>Buka di Google Maps</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-80" aria-hidden="true" />
                        </a>
                      </div>
                    )}
                    </div>
                  </div>
                )}
                {order.order_type !== 'pickup' && (
                  <div
                    className={`rounded-xl border p-3 space-y-2 ${
                      order.courier_type === 'cod'
                        ? 'border-amber-200 bg-amber-50/70'
                        : 'border-emerald-200 bg-emerald-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span
                        className={`text-[11px] font-bold ${
                          order.courier_type === 'cod' ? 'text-amber-950' : 'text-emerald-950'
                        }`}
                      >
                        Kurir: {order.courier_name || 'GoSend Instant'}
                      </span>
                      {order.biteship_status && (
                        <span
                          title={`Status Biteship: ${order.biteship_status}`}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${biteshipStatusInfo(order.biteship_status).color}`}
                        >
                          {biteshipStatusInfo(order.biteship_status).label}
                        </span>
                      )}
                    </div>
                    {order.courier_type === 'cod' && (
                      <p className="text-[11px] text-amber-900 leading-snug">
                        Ongkir tidak ditagihkan di aplikasi — tetap ditanggung customer dan dibayarkan langsung ke kurir (COD).
                      </p>
                    )}

                    {order.biteship_waybill_id && (
                      <p className="text-[11px] font-mono text-stone-700">
                        Resi: <strong>{order.biteship_waybill_id}</strong>
                      </p>
                    )}

                    {(order.driver_name || order.driver_phone || order.driver_plate) && (
                      <div className="text-[11px] text-stone-800 flex flex-wrap items-center gap-1.5">
                        <span>
                          Driver: <strong>{order.driver_name || '-'}</strong>
                          {order.driver_plate ? ` · ${order.driver_plate}` : ''}
                        </span>
                        {order.driver_phone && formatWhatsAppNumber(order.driver_phone) && (
                          <a
                            href={`https://wa.me/${formatWhatsAppNumber(order.driver_phone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-mono font-bold hover:underline"
                          >
                            <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                            <span>{order.driver_phone}</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {canDispatch && (
                        <>
                          <button
                            type="button"
                            onClick={() => onDispatchCourier(order, 'gojek')}
                            disabled={isBusy}
                            className={`px-2.5 py-1.5 rounded-lg disabled:opacity-50 text-white text-[11px] font-bold ${
                              defaultCourier === 'gojek' ? 'bg-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-300' : 'bg-emerald-600/80 hover:bg-emerald-700'
                            }`}
                          >
                            🛵 Panggil GoSend Instant
                          </button>
                          <button
                            type="button"
                            onClick={() => onDispatchCourier(order, 'grab')}
                            disabled={isBusy}
                            className={`px-2.5 py-1.5 rounded-lg disabled:opacity-50 text-white text-[11px] font-bold ${
                              defaultCourier === 'grab' ? 'bg-green-700 hover:bg-green-800 ring-2 ring-green-300' : 'bg-green-700/80 hover:bg-green-800'
                            }`}
                          >
                            🛵 Panggil GrabExpress Instant
                          </button>
                        </>
                      )}
                      {order.biteship_tracking_url && (
                        <a
                          href={order.biteship_tracking_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-900 hover:bg-black text-white text-[11px] font-bold"
                        >
                          <span>Lacak Biteship</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[9px]" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  </div>
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
                  <div className="flex justify-between gap-2 text-stone-600">
                    <span>Ongkir{order.courier_name ? ` (${order.courier_name})` : ''}</span>
                    {order.courier_type === 'cod' ? (
                      <span className="font-bold text-amber-700 text-right">Ditanggung Customer (COD)</span>
                    ) : (
                      <span className="font-mono">{formatRupiah(order.delivery_fee)}</span>
                    )}
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
