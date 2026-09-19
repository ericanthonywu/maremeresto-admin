import React, { useCallback, useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import type { BranchCredentials } from '../types'

interface BranchCredentialsSectionProps {
  initialBranchId?: string | null
}

export const BranchCredentialsSection: React.FC<BranchCredentialsSectionProps> = ({
  initialBranchId,
}) => {
  const [credentialsList, setCredentialsList] = useState<BranchCredentials[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Selected branch for editing credentials
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(initialBranchId ?? null)

  // Form fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const loadCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.getAllBranchCredentials()
      setCredentialsList(data)

      // If no branch selected yet or selected branch no longer exists, select first
      if (data.length > 0) {
        setSelectedBranchId((prev) => {
          if (prev && data.some((b) => b.branch_id === prev)) return prev
          return initialBranchId && data.some((b) => b.branch_id === initialBranchId)
            ? initialBranchId
            : data[0].branch_id
        })
      }
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat daftar kredensial cabang.'))
    } finally {
      setLoading(false)
    }
  }, [initialBranchId])

  useEffect(() => {
    void loadCredentials()
  }, [loadCredentials])

  // When selected branch changes, populate form fields
  useEffect(() => {
    if (!selectedBranchId || credentialsList.length === 0) return
    const current = credentialsList.find((b) => b.branch_id === selectedBranchId)
    if (current) {
      setUsername(current.username || '')
      setDisplayName(current.name || '')
      setEmail(current.email || '')
      setPhone(current.phone || '')
      setPassword('')
      setConfirmPassword('')
      setError(null)
    }
  }, [selectedBranchId, credentialsList])

  const selectedBranch = credentialsList.find((b) => b.branch_id === selectedBranchId)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBranchId) return

    setError(null)
    setSuccess(null)

    const trimmedUser = username.trim()
    if (!trimmedUser) {
      setError('Username cabang wajib diisi.')
      return
    }
    if (trimmedUser.length < 3 || trimmedUser.length > 50) {
      setError('Username harus antara 3 sampai 50 karakter.')
      return
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmedUser)) {
      setError('Username hanya boleh berisi huruf, angka, titik (.), strip (-), atau underscore (_).')
      return
    }

    if (password) {
      if (password.length < 8) {
        setError('Password baru minimal 8 karakter.')
        return
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi password tidak cocok.')
        return
      }
    }

    setSaving(true)
    try {
      await adminApi.updateBranchCredentials(selectedBranchId, {
        username: trimmedUser,
        password: password || undefined,
        name: displayName.trim() || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      })

      setSuccess(`Kredensial untuk "${selectedBranch?.branch_name}" berhasil diperbarui.`)
      setPassword('')
      setConfirmPassword('')

      // Reload list to reflect changes
      await loadCredentials()
    } catch (err) {
      setError(errorMessage(err, 'Gagal memperbarui kredensial cabang.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading && credentialsList.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600" aria-hidden="true"></i>
        <p className="text-xs text-stone-500 font-medium">Memuat data kredensial cabang...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Kredensial & Akun Login Cabang
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-50 text-amber-800 border border-amber-200">
                Akses Owner HQ
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Kelola username dan password akun admin/kasir untuk masing-masing outlet / cabang.
            </p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center shrink-0">
            <i className="fa-solid fa-users-gear text-base" aria-hidden="true"></i>
          </div>
        </div>

        {/* Informational tip */}
        <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl flex items-start gap-3 text-xs text-stone-600">
          <i className="fa-solid fa-circle-info text-brand-600 mt-0.5 shrink-0 text-sm" aria-hidden="true"></i>
          <div className="space-y-1">
            <p className="font-semibold text-stone-800">
              Bagaimana staf outlet masuk ke sistem?
            </p>
            <p className="text-[11px] leading-relaxed text-stone-600">
              Staf atau barista dapat membuka portal admin di halaman login dan memasukkan <strong>Username</strong> (atau <strong>Email</strong>) serta <strong>Password</strong> yang telah Anda atur di bawah ini.
            </p>
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

        {/* Branch overview list */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              Daftar Cabang ({credentialsList.length})
            </h3>
            <span className="text-[11px] text-stone-400">Pilih cabang untuk mengatur akun</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {credentialsList.map((branch) => {
              const isSelected = branch.branch_id === selectedBranchId
              return (
                <button
                  key={branch.branch_id}
                  type="button"
                  onClick={() => {
                    setSelectedBranchId(branch.branch_id)
                    setSuccess(null)
                    setError(null)
                  }}
                  className={`text-left p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                      : 'bg-stone-50/70 border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-stone-900 block truncate">
                        {branch.branch_name}
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" aria-hidden="true"></span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-600 font-mono">
                      <i className="fa-solid fa-at text-[10px] text-stone-400" aria-hidden="true"></i>
                      <span className="font-bold text-stone-800 truncate">
                        {branch.username || '(belum diatur)'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between gap-2 text-[10px]">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-semibold ${
                        branch.has_password
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      <i
                        className={`fa-solid ${branch.has_password ? 'fa-check' : 'fa-triangle-exclamation'}`}
                        aria-hidden="true"
                      ></i>
                      {branch.has_password ? 'Password Terpasang' : 'Perlu Password'}
                    </span>
                    <span className="text-stone-400 font-sans">
                      {isSelected ? 'Sedang diedit' : 'Klik edit'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Edit Form for Selected Branch */}
      {selectedBranch && (
        <form
          onSubmit={handleSave}
          className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/90 shadow-sm space-y-6 animate-fade-in"
        >
          <div className="border-b border-stone-100 pb-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
                Form Edit Akun Cabang
              </span>
              <h3 className="font-serif text-base font-bold text-stone-900">
                {selectedBranch.branch_name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-500 font-medium">Status Akun:</span>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  selectedBranch.has_password
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                {selectedBranch.has_password ? 'Aktif & Dapat Login' : 'Belum Ada Password'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Username */}
            <div>
              <label htmlFor="branch-username" className="block text-xs font-bold text-stone-700 mb-1.5">
                Username Login Cabang <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-username"
                  type="text"
                  required
                  autoCapitalize="none"
                  spellCheck={false}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="misal: admin.kerten"
                  className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                Huruf kecil, angka, titik, strip, atau garis bawah. Minimal 3 karakter.
              </p>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="branch-display-name" className="block text-xs font-bold text-stone-700 mb-1.5">
                Nama Tampilan Akun
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-id-card absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="misal: Admin Kerten"
                  className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Nama staf yang tampil di navbar outlet.</p>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="branch-password" className="block text-xs font-bold text-stone-700 mb-1.5">
                Password Baru Cabang
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    selectedBranch.has_password
                      ? 'Kosongkan jika tidak ingin mengubah password'
                      : 'Tetapkan password baru (min. 8 karakter)'
                  }
                  className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                </button>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                {selectedBranch.has_password
                  ? 'Biarkan kosong jika hanya ingin mengubah username.'
                  : 'Wajib diisi agar staf cabang dapat login.'}
              </p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="branch-confirm-password" className="block text-xs font-bold text-stone-700 mb-1.5">
                Konfirmasi Password Baru
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-check-double absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  disabled={!password}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru"
                  className="w-full pl-9 pr-10 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  disabled={!password}
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-1 disabled:opacity-50"
                >
                  <i className={`fa-solid ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
                </button>
              </div>
              {password && confirmPassword && password !== confirmPassword && (
                <p className="text-[11px] text-red-500 font-medium mt-1">Konfirmasi password tidak cocok.</p>
              )}
            </div>

            {/* Email (Optional) */}
            <div>
              <label htmlFor="branch-email" className="block text-xs font-bold text-stone-700 mb-1.5">
                Email Cabang (Opsional)
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-envelope absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="misal: admin.kerten@cafeolga.id"
                  className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                />
              </div>
              <p className="text-[11px] text-stone-400 mt-1">Bisa juga dipakai untuk alternatif login.</p>
            </div>

            {/* Phone (Optional) */}
            <div>
              <label htmlFor="branch-phone" className="block text-xs font-bold text-stone-700 mb-1.5">
                Nomor Telepon / WhatsApp Cabang (Opsional)
              </label>
              <div className="relative">
                <i
                  className="fa-solid fa-phone absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
                  aria-hidden="true"
                ></i>
                <input
                  id="branch-phone"
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0812..."
                  className="w-full pl-9 pr-4 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-brand-500 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between flex-wrap gap-3">
            <div className="text-[11px] text-stone-400">
              {selectedBranch.updated_at ? (
                <span>
                  Terakhir diperbarui:{' '}
                  {new Date(selectedBranch.updated_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : (
                <span>Belum pernah diperbarui</span>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 sm:flex-initial px-6 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-brand-900/20 transition-all flex items-center justify-center gap-2 text-xs"
              >
                <i
                  className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}
                  aria-hidden="true"
                ></i>
                <span>{saving ? 'Menyimpan...' : 'Simpan Kredensial Cabang'}</span>
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
