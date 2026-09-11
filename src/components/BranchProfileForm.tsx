import React, { useEffect, useRef, useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { Branch, GeocodeResult } from '../types'

const SEARCH_DEBOUNCE_MS = 450
const MIN_QUERY_LENGTH = 3

interface Props {
  branch: Branch
}

/**
 * Edits the outlet's public identity (name/address/phone/coordinates).
 * This used to only be settable once, at seed time, with no admin UI at all
 * — an operator who needed to fix a wrong address or add a real phone number
 * had no way to do it short of a direct database edit.
 */
export const BranchProfileForm: React.FC<Props> = ({ branch }) => {
  const { refreshBranches } = useAuth()

  const [name, setName] = useState(branch.name)
  const [address, setAddress] = useState(branch.address)
  const [phone, setPhone] = useState(branch.phone)
  const [coords, setCoords] = useState({ lat: branch.latitude, lon: branch.longitude })

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GeocodeResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // Reset local state whenever the active branch changes (owner switching outlets).
  useEffect(() => {
    setName(branch.name)
    setAddress(branch.address)
    setPhone(branch.phone)
    setCoords({ lat: branch.latitude, lon: branch.longitude })
    setQuery('')
    setResults([])
  }, [branch.id, branch.name, branch.address, branch.phone, branch.latitude, branch.longitude])

  // Debounced address search against the same geocoder the customer app uses,
  // so a picked result carries real coordinates instead of a hand-typed guess.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort()
      setResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    const timer = window.setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setSearching(true)
      setSearchError(null)
      try {
        const found = await adminApi.searchAddress(trimmed, controller.signal)
        setResults(found)
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([])
          setSearchError(errorMessage(err, 'Pencarian alamat gagal.'))
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false)
      }
    }, SEARCH_DEBOUNCE_MS)

    return () => window.clearTimeout(timer)
  }, [query])

  const pickResult = (result: GeocodeResult) => {
    setAddress(result.full_address || result.label)
    setCoords({ lat: result.latitude, lon: result.longitude })
    setQuery('')
    setResults([])
  }

  const dirty =
    name !== branch.name ||
    address !== branch.address ||
    phone !== branch.phone ||
    coords.lat !== branch.latitude ||
    coords.lon !== branch.longitude

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Nama outlet wajib diisi.')
      return
    }
    if (!address.trim()) {
      setError('Alamat outlet wajib diisi.')
      return
    }
    if (coords.lat === 0 && coords.lon === 0) {
      setError('Cari alamat di atas untuk menentukan koordinat outlet.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await adminApi.updateBranchProfile(branch.id, {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        latitude: coords.lat,
        longitude: coords.lon,
      })
      await refreshBranches()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan profil outlet.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-sm text-stone-900">Profil Outlet</h3>
          <p className="text-[11px] text-stone-500">
            Nama, alamat, dan koordinat ini yang dipakai untuk menghitung ongkir pelanggan.
          </p>
        </div>
        {saved && (
          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shrink-0">
            <i className="fa-solid fa-check mr-1" aria-hidden="true"></i> Tersimpan
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
          {error}
        </p>
      )}

      <div>
        <label htmlFor="branch-name" className="text-xs font-bold text-stone-600 mb-1 block">
          Nama outlet
        </label>
        <input
          id="branch-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500"
        />
      </div>

      <div>
        <label htmlFor="branch-phone" className="text-xs font-bold text-stone-600 mb-1 block">
          Nomor telepon outlet
        </label>
        <input
          id="branch-phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="081234567890"
          className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-500"
        />
        {!phone.trim() && (
          <p className="text-[10px] text-amber-600 mt-1">Belum diisi.</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="branch-address" className="text-xs font-bold text-stone-600 mb-1 block">
          Alamat outlet
        </label>
        <textarea
          id="branch-address"
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500"
        ></textarea>
        <p className="text-[10px] text-stone-400 font-mono">
          {coords.lat.toFixed(6)}, {coords.lon.toFixed(6)}
        </p>

        <div className="relative">
          <i
            className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
            aria-hidden="true"
          ></i>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari alamat baru untuk memperbarui koordinat..."
            autoComplete="off"
            className="w-full pl-9 pr-9 py-2.5 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white transition-all"
          />
          {searching && (
            <i
              className="fa-solid fa-circle-notch fa-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-600 text-xs"
              aria-hidden="true"
            ></i>
          )}
        </div>

        {searchError && <p className="text-[11px] text-red-600 font-medium">{searchError}</p>}

        {results.length > 0 && (
          <ul className="space-y-1 max-h-48 overflow-y-auto border border-stone-200 rounded-xl p-1.5">
            {results.map((result, idx) => (
              <li key={`${result.latitude}-${result.longitude}-${idx}`}>
                <button
                  type="button"
                  onClick={() => pickResult(result)}
                  className="w-full text-left p-2 rounded-lg hover:bg-brand-50 text-stone-700 hover:text-brand-900 text-xs flex items-start gap-2 transition-colors"
                >
                  <i className="fa-solid fa-map-pin text-brand-600 text-xs mt-0.5 shrink-0" aria-hidden="true"></i>
                  <span className="min-w-0">
                    <span className="block font-semibold">{result.label}</span>
                    <span className="block text-[10px] text-stone-400 truncate">{result.full_address}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || !dirty}
        className="w-full py-3 bg-stone-900 hover:bg-black disabled:opacity-40 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-2 transition-all"
      >
        <i className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`} aria-hidden="true"></i>
        <span>{saving ? 'Menyimpan...' : 'Simpan profil outlet'}</span>
      </button>
    </div>
  )
}
