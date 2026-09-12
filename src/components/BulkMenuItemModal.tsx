import React, { useEffect, useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import type { Category, MenuItem, MenuItemInput } from '../types'

interface BulkMenuItemModalProps {
  isOpen: boolean
  branchId: string
  categories: Category[]
  onClose: () => void
  onSaved: (items: MenuItem[]) => void
}

type BulkRow = Pick<MenuItemInput, 'category_id' | 'name' | 'description' | 'price' | 'is_available'>

const row = (categories: Category[]): BulkRow => ({
  category_id: categories[0]?.id ?? '',
  name: '',
  description: '',
  price: 0,
  is_available: true,
})

export const BulkMenuItemModal: React.FC<BulkMenuItemModalProps> = ({
  isOpen,
  branchId,
  categories,
  onClose,
  onSaved,
}) => {
  const [rows, setRows] = useState<BulkRow[]>(() => [row(categories), row(categories), row(categories)])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setRows([row(categories), row(categories), row(categories)])
    setError(null)
  }, [isOpen, categories])

  if (!isOpen) return null

  const update = <K extends keyof BulkRow>(index: number, key: K, value: BulkRow[K]) => {
    setRows((current) => current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)))
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!categories.length) {
      setError('Buat kategori terlebih dahulu sebelum menambah menu.')
      return
    }
    if (rows.some((entry) => entry.name.trim().length < 2 || entry.price < 1000 || !entry.category_id)) {
      setError('Setiap baris membutuhkan kategori, nama menu (minimal 2 karakter), dan harga minimal Rp 1.000.')
      return
    }

    const payload: MenuItemInput[] = rows.map((entry, index) => ({
      branch_id: branchId,
      category_id: entry.category_id,
      name: entry.name.trim(),
      description: entry.description.trim(),
      price: entry.price,
      icon: 'fa-utensils',
      icon_bg_class: 'bg-amber-50',
      image_url: '',
      tag: '',
      is_available: entry.is_available,
      sort_order: index,
    }))

    setSaving(true)
    setError(null)
    try {
      onSaved(await adminApi.createMenuItemsBulk(payload))
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Gagal menambahkan menu secara bulk.'))
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
        aria-labelledby="bulk-menu-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl"
      >
        <div className="sticky top-0 z-10 bg-white border-b border-stone-200 px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="bulk-menu-title" className="font-serif text-lg font-bold text-stone-900">Tambah menu bulk</h2>
            <p className="text-[11px] text-stone-500 mt-1">Masukkan beberapa menu sekaligus untuk outlet ini.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 disabled:opacity-50">
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <form onSubmit={submit} className="p-5 sm:p-6 space-y-4">
          <div className="hidden sm:grid grid-cols-[minmax(9rem,1fr)_minmax(11rem,1.3fr)_minmax(10rem,1.4fr)_7rem_4rem_2.5rem] gap-2 px-1 text-[10px] uppercase font-bold tracking-wider text-stone-400">
            <span>Kategori</span><span>Nama</span><span>Deskripsi</span><span>Harga</span><span>Aktif</span><span></span>
          </div>

          <div className="space-y-2">
            {rows.map((entry, index) => (
              <div key={index} className="grid grid-cols-1 sm:grid-cols-[minmax(9rem,1fr)_minmax(11rem,1.3fr)_minmax(10rem,1.4fr)_7rem_4rem_2.5rem] gap-2 rounded-2xl bg-stone-50 border border-stone-200 p-3 sm:p-0 sm:bg-transparent sm:border-0">
                <select aria-label={`Kategori menu ${index + 1}`} value={entry.category_id} onChange={(event) => update(index, 'category_id', event.target.value)} className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500">
                  <option value="">Pilih kategori</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>)}
                </select>
                <input aria-label={`Nama menu ${index + 1}`} value={entry.name} onChange={(event) => update(index, 'name', event.target.value)} placeholder="Nama menu" maxLength={100} className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500" />
                <input aria-label={`Deskripsi menu ${index + 1}`} value={entry.description} onChange={(event) => update(index, 'description', event.target.value)} placeholder="Deskripsi (opsional)" maxLength={500} className="px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500" />
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-stone-400">Rp</span><input aria-label={`Harga menu ${index + 1}`} value={entry.price || ''} onChange={(event) => update(index, 'price', Number(event.target.value))} type="number" min={1000} max={10000000} step={500} className="w-full pl-9 pr-2 py-2 text-xs bg-white border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-brand-500" /></div>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-stone-600 cursor-pointer px-1"><input checked={entry.is_available} onChange={(event) => update(index, 'is_available', event.target.checked)} type="checkbox" className="rounded text-brand-600" /> Aktif</label>
                <button type="button" aria-label={`Hapus baris ${index + 1}`} disabled={rows.length <= 1} onClick={() => setRows((current) => current.filter((_, i) => i !== index))} className="w-9 h-9 justify-self-end sm:justify-self-auto rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><i className="fa-solid fa-trash" aria-hidden="true"></i></button>
              </div>
            ))}
          </div>

          <button type="button" onClick={() => setRows((current) => [...current, row(categories)])} className="px-3 py-2 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl"><i className="fa-solid fa-plus mr-1.5" aria-hidden="true"></i>Tambah baris</button>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-xs font-bold text-stone-700 disabled:opacity-50">Batal</button>
            <button type="submit" disabled={saving} className="px-4 py-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-xs font-bold text-white shadow-md disabled:opacity-50">{saving ? 'Menyimpan...' : `Tambah ${rows.length} menu`}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
