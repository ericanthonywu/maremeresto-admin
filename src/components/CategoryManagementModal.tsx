import React, { useState } from 'react'
import { adminApi, errorMessage } from '../api/client'
import type { Category, MenuItem } from '../types'

interface CategoryManagementModalProps {
  isOpen: boolean
  categories: Category[]
  menuItems: MenuItem[]
  onClose: () => void
  onCategoriesChanged: () => void
}

const COMMON_EMOJIS = [
  '☕', '🧊', '🥤', '🧋', '🍵', '🥐', '🍞', '🍰', '🧁', '🍦',
  '🍝', '🍜', '🍛', '🍱', '🍔', '🍟', '🍕', '🥗', '🥩', '🍗',
  '🍲', '🥟', '🥪', '🍳', '🧇', '🥞', '🍩', '🍪', '🍫', '🍽️',
]

interface CategoryRowProps {
  cat: Category
  itemCount: number
  isBusy: boolean
  isCurrentlyEditing: boolean
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  itemCount,
  isBusy,
  isCurrentlyEditing,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      className={`p-3 flex items-center justify-between gap-3 transition-colors ${
        isCurrentlyEditing ? 'bg-brand-50/50' : 'hover:bg-stone-50'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 text-lg rounded-xl bg-stone-100 flex items-center justify-center shrink-0 shadow-inner">
          {cat.emoji || '🍽️'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs text-stone-900 truncate">
              {cat.name}
            </span>
            <span className="text-[10px] text-stone-400 font-mono bg-stone-100 px-1.5 py-0.5 rounded">
              #{cat.sort_order}
            </span>
          </div>
          <span className="text-[10px] text-stone-500 block mt-0.5">
            {itemCount > 0 ? `${itemCount} item menu terhubung` : 'Belum ada menu terhubung'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(cat)}
          title={`Ubah kategori ${cat.name}`}
          className="p-1.5 text-stone-400 hover:text-brand-600 rounded-lg hover:bg-stone-100 transition-colors"
        >
          <i className="fa-solid fa-pen text-xs" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          onClick={() => onDelete(cat)}
          disabled={isBusy || itemCount > 0}
          title={
            itemCount > 0
              ? `Tidak dapat dihapus: digunakan oleh ${itemCount} menu`
              : `Hapus kategori ${cat.name}`
          }
          className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {isBusy ? (
            <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true"></i>
          ) : (
            <i className="fa-solid fa-trash text-xs" aria-hidden="true"></i>
          )}
        </button>
      </div>
    </div>
  )
}

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  isOpen,
  categories,
  menuItems,
  onClose,
  onCategoriesChanged,
}) => {
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [sortOrder, setSortOrder] = useState(0)

  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setEmoji('🍽️')
    setSortOrder(categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 1)
    setEditingCat(null)
    setIsAdding(false)
    setError(null)
  }

  const startAdd = () => {
    resetForm()
    setIsAdding(true)
  }

  const startEdit = (cat: Category) => {
    setEditingCat(cat)
    setIsAdding(false)
    setName(cat.name)
    setEmoji(cat.emoji)
    setSortOrder(cat.sort_order)
    setError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Nama kategori wajib diisi.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editingCat) {
        await adminApi.updateCategory(editingCat.id, {
          name: trimmedName,
          emoji: emoji || '🍽️',
          sort_order: Number(sortOrder) || 0,
        })
        setNotice(`Kategori "${trimmedName}" berhasil diperbarui.`)
      } else {
        await adminApi.createCategory({
          name: trimmedName,
          emoji: emoji || '🍽️',
          sort_order: Number(sortOrder) || 0,
        })
        setNotice(`Kategori "${trimmedName}" berhasil ditambahkan.`)
      }
      resetForm()
      onCategoriesChanged()
      setTimeout(() => setNotice(null), 3000)
    } catch (err) {
      setError(errorMessage(err, 'Gagal menyimpan kategori.'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (cat: Category) => {
    const usageCount = menuItems.filter((m) => m.category_id === cat.id).length
    if (usageCount > 0) {
      setError(`Kategori "${cat.name}" tidak dapat dihapus karena masih digunakan oleh ${usageCount} menu.`)
      return
    }

    if (!window.confirm(`Hapus kategori "${cat.name}"?\n\nTindakan ini tidak dapat dibatalkan.`)) {
      return
    }

    setDeletingId(cat.id)
    setError(null)

    try {
      await adminApi.deleteCategory(cat.id)
      setNotice(`Kategori "${cat.name}" dihapus.`)
      if (editingCat?.id === cat.id) resetForm()
      onCategoriesChanged()
      setTimeout(() => setNotice(null), 3000)
    } catch (err) {
      setError(errorMessage(err, 'Gagal menghapus kategori.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="category-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div>
            <h2 id="category-modal-title" className="font-serif font-bold text-lg text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-tags text-brand-600" aria-hidden="true"></i>
              <span>Kelola Kategori Makanan</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Tambah, ubah, atau susun urutan kategori menu restoran.
            </p>
          </div>
          <button
            onClick={() => {
              resetForm()
              onClose()
            }}
            aria-label="Tutup modal"
            className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/50 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true"></i>
          </button>
        </div>

        {/* Notice & Error */}
        {notice && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2">
            <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
            <span>{notice}</span>
          </div>
        )}

        {error && (
          <div className="mx-5 mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
              <span>{error}</span>
            </span>
            <button onClick={() => setError(null)} className="underline shrink-0">
              Tutup
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Add / Edit Form */}
          {(isAdding || editingCat) ? (
            <form onSubmit={handleSave} className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs text-stone-800 flex items-center gap-1.5">
                  <i className={`fa-solid ${editingCat ? 'fa-pen' : 'fa-plus'} text-brand-600`} aria-hidden="true"></i>
                  <span>{editingCat ? `Ubah Kategori: ${editingCat.name}` : 'Tambah Kategori Baru'}</span>
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-[11px] text-stone-500 hover:text-stone-800 underline"
                >
                  Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                {/* Emoji field */}
                <div className="sm:col-span-3">
                  <label htmlFor="cat-emoji" className="block text-[11px] font-bold text-stone-600 mb-1">
                    Emoji / Ikon
                  </label>
                  <input
                    id="cat-emoji"
                    type="text"
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    maxLength={10}
                    placeholder="🍽️"
                    className="w-full text-center text-xl py-1.5 bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Name field */}
                <div className="sm:col-span-6">
                  <label htmlFor="cat-name" className="block text-[11px] font-bold text-stone-600 mb-1">
                    Nama Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="cat-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="contoh: Dimsum & Kudapan"
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>

                {/* Sort order field */}
                <div className="sm:col-span-3">
                  <label htmlFor="cat-sort" className="block text-[11px] font-bold text-stone-600 mb-1">
                    Urutan
                  </label>
                  <input
                    id="cat-sort"
                    type="number"
                    min={0}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                    className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Emoji quick pick */}
              <div>
                <span className="text-[10px] text-stone-500 block mb-1">Pilihan Cepat Emoji:</span>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setEmoji(em)}
                      className={`w-7 h-7 text-sm rounded-lg flex items-center justify-center transition-all ${
                        emoji === em
                          ? 'bg-brand-100 border border-brand-400 scale-110'
                          : 'bg-white border border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-200 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {saving && <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true"></i>}
                  <span>{editingCat ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <span className="text-xs text-stone-500">
                Total {categories.length} kategori terdaftar
              </span>
              <button
                type="button"
                onClick={startAdd}
                className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
              >
                <i className="fa-solid fa-plus text-xs" aria-hidden="true"></i>
                <span>Tambah Kategori Baru</span>
              </button>
            </div>
          )}

          {/* Categories List Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Daftar Kategori
            </h3>

            {categories.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center">
                Belum ada kategori. Silakan tambahkan kategori baru.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {categories.map((cat) => {
                  const itemCount = menuItems.filter((m) => m.category_id === cat.id).length
                  const isBusy = deletingId === cat.id
                  const isCurrentlyEditing = editingCat?.id === cat.id

                  return (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      itemCount={itemCount}
                      isBusy={isBusy}
                      isCurrentlyEditing={isCurrentlyEditing}
                      onEdit={startEdit}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/50 flex justify-end">
          <button
            type="button"
            onClick={() => {
              resetForm()
              onClose()
            }}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
