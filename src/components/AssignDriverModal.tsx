import React, { useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import type { DriverInput, Order } from '../types'

interface AssignDriverModalProps {
  order: Order | null
  onClose: () => void
  onAssigned: (updated: Order) => void
}

/** Same rule as the server: 08... or +628..., 10-14 digits. */
function isValidPhone(raw: string): boolean {
  let cleaned = raw.trim().replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('+62')) cleaned = cleaned.slice(3)
  else if (cleaned.startsWith('62')) cleaned = cleaned.slice(2)
  else if (cleaned.startsWith('0')) cleaned = cleaned.slice(1)
  return /^8[1-9][0-9]{7,11}$/.test(cleaned)
}

export const AssignDriverModal: React.FC<AssignDriverModalProps> = ({ order, onClose, onAssigned }) => {
  const [form, setForm] = useState<DriverInput>({
    driver_name: '',
    driver_phone: '',
    driver_vehicle: '',
    driver_plate: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-fill when reassigning a courier already on the order.
  useEffect(() => {
    if (!order) return
    setError(null)
    setForm({
      driver_name: order.driver_name ?? '',
      driver_phone: order.driver_phone ?? '',
      driver_vehicle: order.driver_vehicle ?? '',
      driver_plate: order.driver_plate ?? '',
    })
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

    if (form.driver_name.trim().length < 2) {
      setError('Nama kurir minimal 2 karakter.')
      return
    }
    if (!isValidPhone(form.driver_phone)) {
      setError('Nomor telepon kurir tidak valid. Gunakan format 08... atau +628...')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await adminApi.assignDriver(order.id, {
        driver_name: form.driver_name.trim(),
        driver_phone: form.driver_phone.trim(),
        driver_vehicle: form.driver_vehicle.trim(),
        driver_plate: form.driver_plate.trim().toUpperCase(),
      })
      onAssigned(updated)
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Gagal menetapkan kurir.'))
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
        aria-labelledby="driver-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="driver-modal-title" className="font-serif font-bold text-lg text-stone-900">
              Tetapkan Kurir
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

        <p className="text-[11px] text-stone-600 bg-stone-50 border border-stone-200 rounded-xl p-2.5">
          Data ini tampil di halaman pelacakan pelanggan, lengkap dengan tombol WhatsApp dan telepon.
          Isi dengan data kurir yang sebenarnya.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="d-name" className="block text-xs font-bold text-stone-700 mb-1">
              Nama kurir *
            </label>
            <input
              id="d-name"
              type="text"
              required
              maxLength={100}
              value={form.driver_name}
              onChange={(e) => setForm({ ...form, driver_name: e.target.value })}
              placeholder="Nama lengkap kurir"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="d-phone" className="block text-xs font-bold text-stone-700 mb-1">
              Nomor telepon / WhatsApp *
            </label>
            <input
              id="d-phone"
              type="tel"
              required
              inputMode="tel"
              value={form.driver_phone}
              onChange={(e) => setForm({ ...form, driver_phone: e.target.value })}
              placeholder="081234567890"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-brand-500 focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="d-vehicle" className="block text-xs font-bold text-stone-700 mb-1">
                Kendaraan
              </label>
              <input
                id="d-vehicle"
                type="text"
                maxLength={100}
                value={form.driver_vehicle}
                onChange={(e) => setForm({ ...form, driver_vehicle: e.target.value })}
                placeholder="Honda Vario"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label htmlFor="d-plate" className="block text-xs font-bold text-stone-700 mb-1">
                Nomor polisi
              </label>
              <input
                id="d-plate"
                type="text"
                maxLength={30}
                value={form.driver_plate}
                onChange={(e) => setForm({ ...form, driver_plate: e.target.value.toUpperCase() })}
                placeholder="AD 1234 XY"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono uppercase focus:outline-none focus:border-brand-500"
              />
            </div>
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
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-motorcycle'}`}
                aria-hidden="true"
              ></i>
              <span>{saving ? 'Menyimpan...' : 'Tetapkan kurir'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
