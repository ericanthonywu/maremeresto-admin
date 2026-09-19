import React, { useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'

export const ChangePasswordSection: React.FC = () => {
  const { user } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!currentPassword) {
      setError('Password saat ini wajib diisi.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Password baru tidak boleh sama dengan password saat ini.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.')
      return
    }

    setSaving(true)
    try {
      const res = await adminApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setSuccess(res.message || 'Password akun Anda berhasil diperbarui.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengubah password. Periksa password saat ini.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-bold text-stone-900">Ubah Password Saya</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-brand-50 text-brand-700 border border-brand-200">
              {user?.role === 'owner' ? 'Owner HQ' : 'Staff Outlet'}
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Ganti password untuk akun yang sedang Anda gunakan ({user?.name || user?.phone}).
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
          <i className="fa-solid fa-key text-base" aria-hidden="true"></i>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-exclamation text-sm shrink-0" aria-hidden="true"></i>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-stone-400 hover:text-stone-600 shrink-0 text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-fade-in"
        >
          <div className="flex items-center gap-2.5">
            <i className="fa-solid fa-circle-check text-sm shrink-0 text-emerald-600" aria-hidden="true"></i>
            <span>{success}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="text-stone-400 hover:text-stone-600 shrink-0 text-xs underline"
          >
            Tutup
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="current-password" className="block text-xs font-bold text-stone-700 mb-1.5">
            Password Saat Ini
          </label>
          <div className="relative">
            <i
              className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              aria-hidden="true"
            ></i>
            <input
              id="current-password"
              type={showCurrent ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowCurrent((v) => !v)}
              aria-label={showCurrent ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
            >
              <i className={`fa-solid ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="new-password" className="block text-xs font-bold text-stone-700 mb-1.5">
            Password Baru
          </label>
          <div className="relative">
            <i
              className="fa-solid fa-shield-halved absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              aria-hidden="true"
            ></i>
            <input
              id="new-password"
              type={showNew ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowNew((v) => !v)}
              aria-label={showNew ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
            >
              <i className={`fa-solid ${showNew ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
            </button>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">
            Gunakan kombinasi huruf, angka, atau simbol agar lebih aman.
          </p>
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-xs font-bold text-stone-700 mb-1.5">
            Konfirmasi Password Baru
          </label>
          <div className="relative">
            <i
              className="fa-solid fa-check-double absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
              aria-hidden="true"
            ></i>
            <input
              id="confirm-password"
              type={showConfirm ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
            >
              <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
            </button>
          </div>
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-[11px] text-red-500 font-medium mt-1">Password konfirmasi tidak cocok.</p>
          )}
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-brand-900/20 transition-all flex items-center justify-center gap-2 text-xs"
          >
            <i
              className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}
              aria-hidden="true"
            ></i>
            <span>{saving ? 'Menyimpan...' : 'Perbarui Password'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
