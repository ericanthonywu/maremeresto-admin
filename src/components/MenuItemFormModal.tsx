import React, { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi, errorMessage, formatRupiah } from '../api/client'
import type { Category, MenuItem, MenuItemInput } from '../types'

interface MenuItemFormModalProps {
  isOpen: boolean
  /** null = create, an item = edit. */
  item: MenuItem | null
  branchId: string
  categories: Category[]
  onClose: () => void
  onSaved: (saved: MenuItem, mode: 'created' | 'updated') => void
}

/** Icon choices, matching the Font Awesome set the storefront already loads. */
const ICON_CHOICES = [
  { icon: 'fa-mug-hot', label: 'Minuman panas' },
  { icon: 'fa-mug-saucer', label: 'Kopi' },
  { icon: 'fa-glass-water', label: 'Minuman dingin' },
  { icon: 'fa-whiskey-glass', label: 'Gelas tinggi' },
  { icon: 'fa-leaf', label: 'Teh / matcha' },
  { icon: 'fa-bowl-food', label: 'Nasi / hidangan' },
  { icon: 'fa-bowl-rice', label: 'Nasi' },
  { icon: 'fa-drumstick-bite', label: 'Ayam / daging' },
  { icon: 'fa-fish', label: 'Seafood' },
  { icon: 'fa-bread-slice', label: 'Roti / pastry' },
  { icon: 'fa-cookie-bite', label: 'Dessert' },
  { icon: 'fa-ice-cream', label: 'Es krim' },
  { icon: 'fa-plate-wheat', label: 'Pelengkap' },
  { icon: 'fa-pepper-hot', label: 'Pedas' },
]

const BG_CHOICES = [
  { value: 'bg-amber-50', label: 'Amber' },
  { value: 'bg-stone-100', label: 'Netral' },
  { value: 'bg-emerald-50', label: 'Hijau' },
  { value: 'bg-sky-50', label: 'Biru' },
  { value: 'bg-rose-50', label: 'Merah' },
  { value: 'bg-indigo-50', label: 'Indigo' },
]

const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function emptyForm(branchId: string, categories: Category[]): MenuItemInput {
  return {
    branch_id: branchId,
    category_id: categories[0]?.id ?? '',
    name: '',
    description: '',
    price: 0,
    icon: 'fa-mug-hot',
    icon_bg_class: 'bg-amber-50',
    image_url: '',
    tag: '',
    is_available: true,
    sort_order: 0,
  }
}

export const MenuItemFormModal: React.FC<MenuItemFormModalProps> = ({
  isOpen,
  item,
  branchId,
  categories,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<MenuItemInput>(() => emptyForm(branchId, categories))
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const isEditing = Boolean(item)

  // Load the item being edited, or reset to a blank form for a new one.
  useEffect(() => {
    if (!isOpen) return

    setError(null)
    if (item) {
      setForm({
        branch_id: item.branch_id,
        category_id: item.category_id,
        name: item.name,
        description: item.description,
        price: item.price,
        icon: item.icon,
        icon_bg_class: item.icon_bg_class,
        image_url: item.image_url ?? '',
        tag: item.tag ?? '',
        is_available: item.is_available,
        sort_order: item.sort_order,
      })
    } else {
      setForm(emptyForm(branchId, categories))
    }
  }, [isOpen, item, branchId, categories])

  useEffect(() => {
    if (!isOpen) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previous
    }
  }, [isOpen, saving, onClose])

  const update = useCallback(<K extends keyof MenuItemInput>(key: K, value: MenuItemInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Check client-side too, so an oversized file fails fast with a clear
    // message instead of a generic upload error.
    if (!file.type.startsWith('image/')) {
      setError('File harus berupa gambar (JPG, PNG, atau WebP).')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError('Ukuran gambar maksimal 8 MB.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const url = await adminApi.uploadImage(file)
      update('image_url', url)
    } catch (err) {
      setError(errorMessage(err, 'Gagal mengunggah gambar.'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /** Mirrors the server's rules so the operator sees the problem immediately. */
  const validate = (): string | null => {
    if (!form.category_id) return 'Pilih kategori menu.'
    const name = form.name.trim()
    if (name.length < 2 || name.length > 100) return 'Nama menu harus 2-100 karakter.'
    if (form.description.trim().length > 500) return 'Deskripsi maksimal 500 karakter.'
    if (!Number.isFinite(form.price) || form.price < 1000) return 'Harga minimal Rp 1.000.'
    if (form.price > 10_000_000) return 'Harga maksimal Rp 10.000.000.'
    if (form.tag.trim().length > 50) return 'Label maksimal 50 karakter.'
    if (form.sort_order < 0 || form.sort_order > 9999) return 'Urutan harus antara 0 dan 9999.'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload: MenuItemInput = {
        ...form,
        name: form.name.trim(),
        description: form.description.trim(),
        tag: form.tag.trim(),
        branch_id: branchId,
      }

      const saved = item
        ? await adminApi.updateMenuItem(item.id, payload)
        : await adminApi.createMenuItem(payload)

      onSaved(saved, item ? 'updated' : 'created')
      onClose()
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan menu.'))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={() => !saving && onClose()}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-form-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto outline-none"
      >
        <div className="sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between gap-3 z-10">
          <h3 id="menu-form-title" className="font-serif font-bold text-lg text-stone-900">
            {isEditing ? 'Ubah Menu' : 'Tambah Menu Baru'}
          </h3>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Tutup"
            className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name & category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mi-name" className="block text-xs font-bold text-stone-700 mb-1">
                Nama menu *
              </label>
              <input
                id="mi-name"
                type="text"
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="mis. Es Kopi Susu Gula Aren"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white"
              />
            </div>

            <div>
              <label htmlFor="mi-category" className="block text-xs font-bold text-stone-700 mb-1">
                Kategori *
              </label>
              <select
                id="mi-category"
                required
                value={form.category_id}
                onChange={(e) => update('category_id', e.target.value)}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
              >
                <option value="">Pilih kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="mi-desc" className="block text-xs font-bold text-stone-700 mb-1">
              Deskripsi
            </label>
            <textarea
              id="mi-desc"
              rows={3}
              maxLength={500}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Deskripsi singkat yang dilihat pelanggan"
              className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500 focus:bg-white"
            ></textarea>
            <p className="text-[10px] text-stone-400 mt-1 text-right">
              {form.description.length}/500
            </p>
          </div>

          {/* Price, tag, sort order */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="mi-price" className="block text-xs font-bold text-stone-700 mb-1">
                Harga *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">Rp</span>
                <input
                  id="mi-price"
                  type="number"
                  required
                  min={1000}
                  max={10000000}
                  step={500}
                  value={form.price || ''}
                  onChange={(e) => update('price', Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
              {form.price >= 1000 && (
                <p className="text-[10px] text-stone-500 mt-1">{formatRupiah(form.price)}</p>
              )}
            </div>

            <div>
              <label htmlFor="mi-tag" className="block text-xs font-bold text-stone-700 mb-1">
                Label (opsional)
              </label>
              <input
                id="mi-tag"
                type="text"
                maxLength={50}
                value={form.tag}
                onChange={(e) => update('tag', e.target.value)}
                placeholder="Best, Favorit, Baru"
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label htmlFor="mi-sort" className="block text-xs font-bold text-stone-700 mb-1">
                Urutan tampil
              </label>
              <input
                id="mi-sort"
                type="number"
                min={0}
                max={9999}
                value={form.sort_order}
                onChange={(e) => update('sort_order', Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-300 rounded-xl font-mono focus:outline-none focus:border-brand-500"
              />
              <p className="text-[10px] text-stone-400 mt-1">Angka kecil tampil lebih dulu</p>
            </div>
          </div>

          {/* Image */}
          <div>
            <span className="block text-xs font-bold text-stone-700 mb-1">Foto menu (opsional)</span>
            <div className="flex items-start gap-3">
              <div
                className={`w-20 h-20 rounded-2xl ${form.icon_bg_class} border border-stone-200 flex items-center justify-center overflow-hidden shrink-0`}
              >
                {form.image_url ? (
                  <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <i className={`fa-solid ${form.icon} text-2xl text-brand-700`} aria-hidden="true"></i>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                  id="mi-image"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 bg-stone-900 hover:bg-black disabled:opacity-50 text-white rounded-xl text-[11px] font-bold flex items-center gap-2"
                  >
                    <i
                      className={`fa-solid ${uploading ? 'fa-circle-notch fa-spin' : 'fa-upload'}`}
                      aria-hidden="true"
                    ></i>
                    <span>{uploading ? 'Mengunggah...' : 'Pilih gambar'}</span>
                  </button>
                  {form.image_url && (
                    <button
                      type="button"
                      onClick={() => update('image_url', '')}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-[11px] font-bold"
                    >
                      Hapus gambar
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-stone-400">
                  JPG, PNG atau WebP, maksimal 8 MB. Gambar otomatis dikompresi ke 800px.
                </p>
              </div>
            </div>
          </div>

          {/* Icon fallback, used when there is no photo */}
          <div>
            <span className="block text-xs font-bold text-stone-700 mb-2">
              Ikon pengganti {form.image_url && <span className="font-normal text-stone-400">(dipakai bila foto gagal dimuat)</span>}
            </span>
            <div className="grid grid-cols-7 gap-2">
              {ICON_CHOICES.map((choice) => (
                <button
                  key={choice.icon}
                  type="button"
                  title={choice.label}
                  aria-label={choice.label}
                  aria-pressed={form.icon === choice.icon}
                  onClick={() => update('icon', choice.icon)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-base transition-all ${
                    form.icon === choice.icon
                      ? 'bg-brand-600 text-white shadow-md ring-2 ring-brand-300'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  <i className={`fa-solid ${choice.icon}`} aria-hidden="true"></i>
                </button>
              ))}
            </div>
          </div>

          {/* Background colour */}
          <div>
            <span className="block text-xs font-bold text-stone-700 mb-2">Warna latar ikon</span>
            <div className="flex flex-wrap gap-2">
              {BG_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={form.icon_bg_class === choice.value}
                  onClick={() => update('icon_bg_class', choice.value)}
                  className={`px-3 py-2 rounded-xl text-[11px] font-bold border transition-all ${choice.value} ${
                    form.icon_bg_class === choice.value
                      ? 'border-brand-500 ring-2 ring-brand-300 text-stone-900'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <label className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-stone-50 border border-stone-200 cursor-pointer">
            <span className="min-w-0">
              <span className="block text-xs font-bold text-stone-900">Tersedia untuk dipesan</span>
              <span className="block text-[10px] text-stone-500">
                Matikan bila stok habis; menu tetap tampil tetapi tidak dapat ditambahkan ke keranjang.
              </span>
            </span>
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(e) => update('is_available', e.target.checked)}
              className="w-5 h-5 rounded text-brand-600 focus:ring-brand-500 shrink-0"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2"
            >
              <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0" aria-hidden="true"></i>
              <span>{error}</span>
            </p>
          )}

          <div className="flex gap-2 pt-2">
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
              disabled={saving || uploading}
              className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-bold rounded-2xl text-xs shadow-md flex items-center justify-center gap-2"
            >
              <i
                className={`fa-solid ${saving ? 'fa-circle-notch fa-spin' : 'fa-floppy-disk'}`}
                aria-hidden="true"
              ></i>
              <span>{saving ? 'Menyimpan...' : isEditing ? 'Simpan perubahan' : 'Tambah menu'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
