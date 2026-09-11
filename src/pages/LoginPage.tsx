import React, { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await login(identifier, password)
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal. Periksa kredensial Anda.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleQuickLogin = async (email: string) => {
    setIdentifier(email)
    setPassword('password')
    setError(null)
    setIsLoading(true)
    try {
      await login(email, 'password')
      window.location.href = '/dashboard'
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login gagal.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo & Title */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-brand-600 text-amber-200 flex items-center justify-center text-3xl mx-auto shadow-2xl">
            <i className="fa-solid fa-mug-hot"></i>
          </div>
          <h1 className="font-serif text-3xl font-bold text-white">Cafe Olga</h1>
          <p className="text-stone-400 text-xs">Admin & Barista Management Portal</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-stone-900/70 rounded-3xl p-8 border border-stone-800 shadow-2xl space-y-5">
          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Email Admin atau Nomor HP
            </label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-3.5 top-3 text-stone-500 text-xs"></i>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin.sudirman@cafeolga.id"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <i className="fa-solid fa-lock absolute left-3.5 top-3 text-stone-500 text-xs"></i>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-4 py-2.5 bg-stone-800 border border-stone-700 rounded-xl text-xs text-white placeholder-stone-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-2.5 bg-red-900/40 border border-red-800/60 rounded-xl text-xs text-red-300 font-semibold flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation text-red-400"></i>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? (
              <i className="fa-solid fa-circle-notch fa-spin text-base"></i>
            ) : (
              <>
                <i className="fa-solid fa-arrow-right-to-bracket"></i>
                <span>Masuk ke Dashboard</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Login Demo Cards */}
        <div className="space-y-2">
          <p className="text-center text-[11px] text-stone-500 font-bold uppercase tracking-wider">
            Quick Login Demo
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('admin.kerten@cafeolga.id')}
              className="py-3 px-3 bg-stone-900/50 border border-stone-800 rounded-2xl text-stone-300 hover:text-white hover:border-brand-700 text-xs font-semibold transition-all text-center"
            >
              <i className="fa-solid fa-store text-brand-500 block mb-1"></i>
              Admin Kerten
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin.makamhaji@cafeolga.id')}
              className="py-3 px-3 bg-stone-900/50 border border-stone-800 rounded-2xl text-stone-300 hover:text-white hover:border-emerald-700 text-xs font-semibold transition-all text-center"
            >
              <i className="fa-solid fa-utensils text-emerald-500 block mb-1"></i>
              Admin Makamhaji
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin.makdjan@cafeolga.id')}
              className="py-3 px-3 bg-stone-900/50 border border-stone-800 rounded-2xl text-stone-300 hover:text-white hover:border-indigo-700 text-xs font-semibold transition-all text-center"
            >
              <i className="fa-solid fa-bowl-rice text-indigo-400 block mb-1"></i>
              Admin Mak Djan
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('owner@cafeolga.id')}
              className="py-3 px-3 bg-stone-900/50 border border-stone-800 rounded-2xl text-stone-300 hover:text-white hover:border-amber-600 text-xs font-semibold transition-all text-center"
            >
              <i className="fa-solid fa-crown text-amber-400 block mb-1"></i>
              Owner HQ
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
