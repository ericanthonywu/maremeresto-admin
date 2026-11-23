import React from 'react'

const CHUNK_RELOAD_KEY = 'mareme_admin_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 15_000

const CHUNK_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'importing a module script failed',
  'error loading dynamically imported module',
  'unable to preload css',
  'chunkloaderror',
  'loading chunk',
]

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : ''
  const lower = message.toLowerCase()
  return CHUNK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern))
}

export function tryReloadOnceForChunkError(): boolean {
  try {
    const now = Date.now()
    const lastReloadRaw = sessionStorage.getItem(CHUNK_RELOAD_KEY)
    const lastReload = lastReloadRaw ? Number(lastReloadRaw) : 0
    if (!Number.isFinite(lastReload) || now - lastReload > RELOAD_COOLDOWN_MS) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
      window.location.reload()
      return true
    }
  } catch {
    // Ignore storage errors
  }
  return false
}

export function registerPreloadErrorHandler(): void {
  if (typeof window === 'undefined') return
  window.addEventListener('vite:preloadError', (event) => {
    if (tryReloadOnceForChunkError()) {
      event.preventDefault()
    }
  })
}

interface ErrorBoundaryState {
  hasError: boolean
  isChunkError: boolean
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, isChunkError: false }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, isChunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: unknown) {
    if (isChunkLoadError(error)) {
      tryReloadOnceForChunkError()
    }
  }

  private handleReload = () => {
    try {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY)
    } catch {
      // Ignore
    }
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center px-4 py-12">
        <div className="bg-white rounded-3xl p-8 text-center border border-stone-200 shadow-sm max-w-md w-full space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-2xl mx-auto">
            <i
              className={`fa-solid ${this.state.isChunkError ? 'fa-arrows-rotate' : 'fa-triangle-exclamation'}`}
              aria-hidden="true"
            />
          </div>
          <div className="space-y-1.5">
            <h2 className="font-bold text-lg text-stone-900">
              {this.state.isChunkError
                ? 'Portal Baru Saja Diperbarui'
                : 'Halaman Gagal Dimuat'}
            </h2>
            <p className="text-xs text-stone-600 leading-relaxed">
              {this.state.isChunkError
                ? 'Versi terbaru sudah tersedia. Muat ulang halaman untuk melanjutkan.'
                : 'Terjadi kesalahan saat menampilkan halaman. Silakan muat ulang.'}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <i className="fa-solid fa-rotate-right text-xs" aria-hidden="true" />
            <span>Muat Ulang Halaman</span>
          </button>
        </div>
      </div>
    )
  }
}
