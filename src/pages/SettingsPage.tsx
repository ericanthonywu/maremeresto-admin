import React, { useEffect, useState } from 'react'
import { adminApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { BranchSettings } from '../types'

export const SettingsPage: React.FC = () => {
  const { user } = useAuth()
  const [settings, setSettings] = useState<BranchSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    adminApi.getSettings(user?.branch_id).then((data) => {
      setSettings(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [user?.branch_id])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      await adminApi.updateSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      alert('Gagal menyimpan pengaturan')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600"></i>
      </div>
    )
  }

  if (!settings) {
    return <div className="text-center text-stone-400 py-20">Pengaturan tidak ditemukan</div>
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-stone-900">Pengaturan Outlet</h1>
        {saved && (
          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            <i className="fa-solid fa-check mr-1"></i> Tersimpan!
          </span>
        )}
      </div>

      {/* Operating Hours */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-serif font-bold text-sm text-stone-900">Jam Operasional</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Weekday Buka</label>
            <input type="time" defaultValue="08:00" className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs" />
          </div>
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Weekday Tutup</label>
            <input type="time" defaultValue="22:00" className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs" />
          </div>
        </div>
      </div>

      {/* Delivery Fees */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-serif font-bold text-sm text-stone-900">Tarif Ongkos Kirim</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Dekat (&lt;{settings.near_threshold_km}km)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-stone-400">Rp</span>
              <input
                type="number"
                value={settings.base_delivery_fee_near}
                onChange={(e) => setSettings({ ...settings, base_delivery_fee_near: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Menengah ({settings.near_threshold_km}-{settings.mid_threshold_km}km)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-stone-400">Rp</span>
              <input
                type="number"
                value={settings.base_delivery_fee_mid}
                onChange={(e) => setSettings({ ...settings, base_delivery_fee_mid: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Jauh (&gt;{settings.mid_threshold_km}km)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-stone-400">Rp</span>
              <input
                type="number"
                value={settings.base_delivery_fee_far}
                onChange={(e) => setSettings({ ...settings, base_delivery_fee_far: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Order Minimums */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-serif font-bold text-sm text-stone-900">Batas Pesanan</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Min. Order</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-stone-400">Rp</span>
              <input
                type="number"
                value={settings.min_order_amount}
                onChange={(e) => setSettings({ ...settings, min_order_amount: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-stone-600 mb-1 block">Free Delivery di atas</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs text-stone-400">Rp</span>
              <input
                type="number"
                value={settings.free_delivery_threshold}
                onChange={(e) => setSettings({ ...settings, free_delivery_threshold: Number(e.target.value) })}
                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Number */}
      <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
        <h3 className="font-serif font-bold text-sm text-stone-900">Kontak Outlet</h3>
        <div>
          <label className="text-xs font-bold text-stone-600 mb-1 block">Nomor WhatsApp Outlet</label>
          <input
            type="text"
            value={settings.whatsapp_number}
            onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })}
            className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono"
          />
        </div>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
      >
        {saving ? (
          <i className="fa-solid fa-circle-notch fa-spin"></i>
        ) : (
          <i className="fa-solid fa-floppy-disk"></i>
        )}
        <span>{saving ? 'Menyimpan...' : 'Simpan Semua Pengaturan'}</span>
      </button>
    </div>
  )
}
