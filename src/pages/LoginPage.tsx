import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../api/client'
import { isSafeRelativeUrl } from '../utils/navigation'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Explain why the operator landed back here after a session timeout.
  useEffect(() => {
    if (searchParams.get('expired') === '1') {
      setError('Sesi Anda telah berakhir. Silakan masuk kembali.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!identifier.trim() || !password) {
      setError('Email dan password wajib diisi.')
      return
    }

    setIsLoading(true)
    try {
      await login(identifier.trim(), password)
      const redirectParam = searchParams.get('redirect')
      const target = redirectParam && isSafeRelativeUrl(redirectParam) ? redirectParam : '/dashboard'
      navigate(target, { replace: true })
    } catch (err) {
      setError(errorMessage(err, 'Login gagal. Periksa email dan password Anda.'))
      setPassword('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div
            className="w-16 h-16 rounded-3xl bg-brand-600 text-amber-200 flex items-center justify-center text-3xl mx-auto shadow-2xl"
            aria-hidden="true"
          >
            <i className="fa-solid fa-mug-hot"></i>
          </div>
          <h1 className="font-serif text-3xl font-bold text-white">Mareme Group</h1>
          <p className="text-stone-400 text-xs">Portal Admin & Barista</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-stone-900/70 rounded-3xl p-8 border border-stone-800 shadow-2xl space-y-5"
        >
          <div>
            <label htmlFor="identifier" className="block text-xs font-bold text-stone-300 mb-1.5">
              Email admin atau WhatsApp
            </label>
            <div className="relative">
              <i
                className="fa-solid fa-user absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs"
                aria-hidden="true"
              ></i>
              <input
                id="identifier"
                type="text"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="nama@cafeolga.id"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-bold text-stone-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <i
                className="fa-solid fa-lock absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 text-xs"
                aria-hidden="true"
              ></i>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password akun Anda"
                className="w-full pl-9 pr-10 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300 text-xs"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true"></i>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-2.5 bg-red-900/40 border border-red-800/60 rounded-xl text-xs text-red-300 font-semibold flex items-start gap-2"
            >
              <i className="fa-solid fa-circle-exclamation text-red-400 mt-0.5 shrink-0" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-base" aria-hidden="true"></i>
            ) : (
              <>
                <i className="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
                <span>Masuk</span>
              </>
            )}
          </button>
        </form>

        {/*
          The one-click "Quick Login Demo" buttons that shipped here are gone.
          They signed in as any outlet admin or the owner with the literal
          password "password", which the backend used to accept for every
          account. Credentials are now set by an operator with:
              go run ./cmd/admintool set-password <email>
        */}
        <p className="text-center text-[11px] text-stone-600">
          Lupa password? Hubungi administrator sistem untuk mengatur ulang.
        </p>
      </div>
    </div>
  )
}
