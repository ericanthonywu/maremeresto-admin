import React, { useCallback, useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { BranchSettings, DayHours } from '../types'
import { BranchProfileForm } from '../components/BranchProfileForm'

const DEFAULT_HOURS: DayHours = { open: '08:00', close: '22:00' }

export const SettingsPage: React.FC = () => {
  const { activeBranchId, activeBranch, isOwner } = useAuth()

  const [settings, setSettings] = useState<BranchSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [togglingOpen, setTogglingOpen] = useState(false)
  const [branchOpen, setBranchOpen] = useState(false)

  const load = useCallback(async () => {
    if (!activeBranchId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.getSettings(activeBranchId)
      // Normalise the operating-hours blob so the form always has both
      // buckets to bind to.
      setSettings({
        ...data,
        operating_hours: {
          weekday: data.operating_hours?.weekday ?? DEFAULT_HOURS,
          weekend: data.operating_hours?.weekend ?? DEFAULT_HOURS,
        },
      })
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat pengaturan outlet.'))
    } finally {
      setLoading(false)
    }
  }, [activeBranchId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setBranchOpen(activeBranch?.is_open ?? false)
  }, [activeBranch?.is_open])

  const updateField = <K extends keyof BranchSettings>(key: K, value: BranchSettings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  // Operating hours are now bound to state and actually persisted. The fields
  // used to be uncontrolled inputs with defaultValue, so whatever the operator
  // typed was silently discarded.
  const updateHours = (bucket: 'weekday' | 'weekend', field: keyof DayHours, value: string) => {
    setSettings((prev) => {
      if (!prev) return prev
      const current = prev.operating_hours[bucket] ?? DEFAULT_HOURS
      return {
        ...prev,
        operating_hours: {
          ...prev.operating_hours,
          [bucket]: { ...current, [field]: value },
        },
      }
    })
  }

  /** Mirrors the server's validation so problems surface before the request. */
  const validate = (s: BranchSettings): string | null => {
    if (s.near_threshold_km < 1) return 'Batas jarak dekat minimal 1 km.'
    if (s.mid_threshold_km <= s.near_threshold_km)
      return 'Batas jarak menengah harus lebih besar dari batas dekat.'
    if (s.max_delivery_radius_km < s.mid_threshold_km)
      return 'Radius maksimal tidak boleh lebih kecil dari batas jarak menengah.'
    if (s.max_delivery_radius_km > 50) return 'Radius maksimal tidak boleh lebih dari 50 km.'
    if (s.base_delivery_fee_mid < s.base_delivery_fee_near || s.base_delivery_fee_far < s.base_delivery_fee_mid)
      return 'Tarif ongkir harus naik sesuai jarak (dekat ≤ menengah ≤ jauh).'
    if ([s.base_delivery_fee_near, s.base_delivery_fee_mid, s.base_delivery_fee_far, s.service_fee].some((v) => v < 0))
      return 'Tarif tidak boleh negatif.'
    if (!s.whatsapp_number?.trim()) return 'Nomor WhatsApp outlet wajib diisi.'
    for (const bucket of ['weekday', 'weekend'] as const) {
      const hours = s.operating_hours[bucket]
      if (!hours?.open || !hours?.close) return 'Jam operasional wajib diisi.'
      if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hours.open) || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(hours.close))
        return 'Jam operasional harus berformat HH:MM.'
    }
    return null
  }

  const handleSave = async () => {
    if (!settings || !activeBranchId) return

    const problem = validate(settings)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const updated = await adminApi.updateSettings({ ...settings, branch_id: activeBranchId })
      setSettings({
        ...updated,
        operating_hours: {
          weekday: updated.operating_hours?.weekday ?? DEFAULT_HOURS,
          weekend: updated.operating_hours?.weekend ?? DEFAULT_HOURS,
        },
      })
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan pengaturan.'))
    } finally {
      setSaving(false)
    }
  }

  const handleToggleOpen = async () => {
    if (!activeBranchId) return
    const next = !branchOpen

    setTogglingOpen(true)
    setError(null)
    try {
      await adminApi.toggleBranchStatus(activeBranchId, next)
      setBranchOpen(next)
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengubah status outlet.'))
    } finally {
      setTogglingOpen(false)
    }
  }

  if (!activeBranchId) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm">
        <i className="fa-solid fa-store text-3xl text-stone-300 mb-2" aria-hidden="true"></i>
        <h3 className="font-bold text-stone-800 text-sm">Pilih outlet terlebih dahulu</h3>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600" aria-hidden="true"></i>
        <span className="sr-only">Memuat pengaturan</span>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm space-y-3">
        <i className="fa-solid fa-triangle-exclamation text-3xl text-amber-500" aria-hidden="true"></i>
        <h3 className="font-bold text-stone-800 text-sm">Pengaturan tidak ditemukan</h3>
        {error && <p className="text-xs text-stone-500">{error}</p>}
        <button
          onClick={() => void load()}
          className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold"
        >
          Coba lagi
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Pengaturan Outlet</h1>
          <p className="text-xs text-stone-500">{activeBranch?.name}</p>
        </div>
        {saved && (
          <span
            role="status"
            className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200"
          >
            <i className="fa-solid fa-check mr-1" aria-hidden="true"></i> Tersimpan
          </span>
        )}
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
          <button onClick={() => setError(null)} className="underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      {activeBranch && <BranchProfileForm branch={activeBranch} />}

      {/* Master open/closed switch */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-serif font-bold text-sm text-stone-900">Status outlet</h3>
          <p className="text-[11px] text-stone-500">
            Mematikan ini menutup outlet segera, di luar jam operasional apa pun. Pelanggan tidak
            dapat membuat pesanan baru.
          </p>
          {activeBranch && !activeBranch.is_open_now && branchOpen && (
            <p className="text-[11px] text-amber-700 mt-1">
              Saat ini di luar jam operasional, jadi outlet tetap tertutup bagi pelanggan.
            </p>
          )}
        </div>
        <button
          onClick={handleToggleOpen}
          disabled={togglingOpen}
          aria-pressed={branchOpen}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 shrink-0 ${
            branchOpen
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          {togglingOpen ? '...' : branchOpen ? 'Buka' : 'Tutup'}
        </button>
      </div>

      {/* Operating hours */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif font-bold text-sm text-stone-900">Jam Operasional</h3>
          <p className="text-[11px] text-stone-500">
            Di luar jam ini outlet otomatis menolak pesanan baru. Waktu mengikuti zona Asia/Jakarta.
          </p>
        </div>

        {(
          [
            { bucket: 'weekday' as const, label: 'Senin – Jumat' },
            { bucket: 'weekend' as const, label: 'Sabtu & Minggu' },
          ]
        ).map(({ bucket, label }) => (
          <div key={bucket} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <span className="text-xs font-bold text-stone-700">{label}</span>
            <div>
              <label htmlFor={`${bucket}-open`} className="text-[10px] font-bold text-stone-500 mb-1 block">
                Buka
              </label>
              <input
                id={`${bucket}-open`}
                type="time"
                value={settings.operating_hours[bucket]?.open ?? ''}
                onChange={(e) => updateHours(bucket, 'open', e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label htmlFor={`${bucket}-close`} className="text-[10px] font-bold text-stone-500 mb-1 block">
                Tutup
              </label>
              <input
                id={`${bucket}-close`}
                type="time"
                value={settings.operating_hours[bucket]?.close ?? ''}
                onChange={(e) => updateHours(bucket, 'close', e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Delivery pricing */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif font-bold text-sm text-stone-900">Tarif Ongkos Kirim</h3>
          <p className="text-[11px] text-stone-500">
            Tarif berlaku sama untuk seluruh outlet dan dihitung otomatis dari jarak alamat pelanggan.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4"><span className="block text-[10px] uppercase font-bold tracking-wider text-emerald-700">0–1 km</span><strong className="block text-base text-emerald-800 mt-1">Gratis</strong></div>
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4"><span className="block text-[10px] uppercase font-bold tracking-wider text-amber-700">&gt;1–5 km</span><strong className="block text-base text-amber-800 mt-1">Rp8.000</strong></div>
          <div className="rounded-2xl bg-blue-50 border border-blue-200 p-4"><span className="block text-[10px] uppercase font-bold tracking-wider text-blue-700">&gt;5–10 km</span><strong className="block text-base text-blue-800 mt-1">Rp12.000</strong></div>
        </div>
        <p className="text-[11px] text-red-700 font-semibold">Maksimum jarak pengantaran: 10 km.</p>
      </div>

      {/* Fees and thresholds */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-serif font-bold text-sm text-stone-900">Biaya & Batas Pesanan</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            {/* This field exists now: the server previously dropped service_fee
                from the UPDATE, so it could never be changed. */}
            <label htmlFor="service-fee" className="text-xs font-bold text-stone-600 mb-1 block">
              Biaya layanan
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Rp</span>
              <input
                id="service-fee"
                type="number"
                min={0}
                step={500}
                value={settings.service_fee}
                onChange={(e) => updateField('service_fee', Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="min-order" className="text-xs font-bold text-stone-600 mb-1 block">
              Minimum order
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Rp</span>
              <input
                id="min-order"
                type="number"
                min={0}
                step={1000}
                value={settings.min_order_amount}
                onChange={(e) => updateField('min_order_amount', Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
              />
            </div>
            <p className="text-[10px] text-stone-400 mt-1">0 = tanpa minimum</p>
          </div>

        </div>
      </div>

      {/* Contact */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <div>
          <h3 className="font-serif font-bold text-sm text-stone-900">Kontak Outlet</h3>
          <p className="text-[11px] text-stone-500">
            WhatsApp ini yang dihubungi pelanggan dari halaman pesanan dan pelacakan.
          </p>
        </div>

        <div>
          <label htmlFor="wa-number" className="text-xs font-bold text-stone-600 mb-1 block">
            Nomor WhatsApp outlet *
          </label>
          <input
            id="wa-number"
            type="tel"
            value={settings.whatsapp_number}
            onChange={(e) => updateField('whatsapp_number', e.target.value)}
            placeholder="081234567890"
            className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
          />
        </div>

        <div>
          <label htmlFor="branch-desc" className="text-xs font-bold text-stone-600 mb-1 block">
            Deskripsi outlet
          </label>
          <textarea
            id="branch-desc"
            rows={2}
            maxLength={500}
            value={settings.description ?? ''}
            onChange={(e) => updateField('description', e.target.value)}
            className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500"
          ></textarea>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => void load()}
          disabled={saving}
          className="px-5 py-3.5 bg-stone-100 hover:bg-stone-200 disabled:opacity-50 text-stone-700 font-bold rounded-2xl text-xs"
        >
          Muat ulang
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
        >
          <i
            className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}
            aria-hidden="true"
          ></i>
          <span>{saving ? 'Menyimpan...' : 'Simpan pengaturan'}</span>
        </button>
      </div>

      {isOwner && (
        <p className="text-[11px] text-stone-400 text-center">
          Anda mengubah pengaturan untuk <strong>{activeBranch?.name}</strong>. Ganti outlet di
          sidebar untuk mengatur cabang lain.
        </p>
      )}
    </div>
  )
}
