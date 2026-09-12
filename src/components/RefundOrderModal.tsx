import React, { useEffect, useState } from 'react'
import { adminApi, errorMessage, formatRupiah } from '../api/client'
import type { Order } from '../types'

interface RefundOrderModalProps {
  order: Order | null
  onClose: () => void
  onRefunded: (updated: Order) => void
}

export const RefundOrderModal: React.FC<RefundOrderModalProps> = ({ order, onClose, onRefunded }) => {
  const [isPartial, setIsPartial] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remaining = order ? order.grand_total - (order.payment?.refund_amount ?? 0) : 0

  useEffect(() => {
    if (!order) return
    setIsPartial(false)
    setAmountInput('')
    setReason('')
    setError(null)
  }, [order])

  useEffect(() => {
    if (!order) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [order, saving, onClose])

  if (!order) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!reason.trim()) {
      setError('Alasan refund wajib diisi.')
      return
    }

    let amount = 0 // 0 tells the server "refund whatever remains"
    if (isPartial) {
      amount = Math.round(Number(amountInput))
      if (!amount || amount <= 0) {
        setError('Jumlah refund harus lebih dari 0.')
        return
      }
      if (amount > remaining) {
        setError(`Jumlah refund tidak boleh melebihi sisa yang dapat dikembalikan (${formatRupiah(remaining)}).`)
        return
      }
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await adminApi.refundOrder(order.id, reason.trim(), order.version, amount)
      onRefunded(updated)
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Gagal memproses refund.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="refund-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="refund-modal-title" className="font-serif font-bold text-lg text-stone-900">
              Refund Pesanan
            </h3>
            <p className="text-[11px] text-stone-500 font-mono">{order.order_number}</p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center disabled:opacity-50 shrink-0"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
          <i className="fa-solid fa-triangle-exclamation mr-1" aria-hidden="true"></i>
          Dana akan dikembalikan ke pelanggan lewat Midtrans dan tidak dapat dibatalkan. Pesanan akan
          ditandai sebagai <strong>Direfund</strong> setelah berhasil.
        </p>

        <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between text-stone-600">
            <span>Total pesanan</span>
            <span className="font-mono font-bold text-stone-900">{formatRupiah(order.grand_total)}</span>
          </div>
          {(order.payment?.refund_amount ?? 0) > 0 && (
            <div className="flex justify-between text-stone-600">
              <span>Sudah direfund sebelumnya</span>
              <span className="font-mono">{formatRupiah(order.payment?.refund_amount ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between font-extrabold text-stone-900 pt-1 border-t border-stone-200">
            <span>Sisa dapat direfund</span>
            <span className="font-mono">{formatRupiah(remaining)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <span className="block text-xs font-bold text-stone-700">Jumlah refund</span>
            <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="refund-scope"
                checked={!isPartial}
                onChange={() => setIsPartial(false)}
              />
              Penuh ({formatRupiah(remaining)})
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
              <input
                type="radio"
                name="refund-scope"
                checked={isPartial}
                onChange={() => setIsPartial(true)}
              />
              Sebagian (nominal khusus)
            </label>
            {isPartial && (
              <input
                type="number"
                min={1}
                max={remaining}
                step={1}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={`Maks ${remaining}`}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            )}
          </div>

          <div>
            <label htmlFor="r-reason" className="block text-xs font-bold text-stone-700 mb-1">
              Alasan refund *
            </label>
            <textarea
              id="r-reason"
              required
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: pesanan salah, komplain pelanggan, item tidak tersedia, dll."
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white resize-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-3 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-bold rounded-2xl text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-rotate-left'}`}
                aria-hidden="true"
              ></i>
              <span>{saving ? 'Memproses...' : 'Proses refund'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
