import React, { useEffect, useState } from 'react'
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
  index: number
  total: number
  itemCount: number
  isBusy: boolean
  isCurrentlyEditing: boolean
  isDragging: boolean
  isDragOver: boolean
  canReorder: boolean
  onDragStart: (e: React.DragEvent<HTMLDivElement>, catId: string) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>, catId: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, targetCatId: string) => void
  onDragEnd: () => void
  onMoveByStep: (catId: string, delta: -1 | 1) => void
  onEdit: (cat: Category) => void
  onDelete: (cat: Category) => void
}

const CategoryRow: React.FC<CategoryRowProps> = ({
  cat,
  index,
  total,
  itemCount,
  isBusy,
  isCurrentlyEditing,
  isDragging,
  isDragOver,
  canReorder,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onMoveByStep,
  onEdit,
  onDelete,
}) => {
  return (
    <div
      draggable={canReorder}
      onDragStart={(e) => canReorder && onDragStart(e, cat.id)}
      onDragOver={(e) => canReorder && onDragOver(e, cat.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => canReorder && onDrop(e, cat.id)}
      onDragEnd={onDragEnd}
      className={`p-3 flex items-center justify-between gap-3 transition-all select-none ${
        isCurrentlyEditing
          ? 'bg-brand-50/50'
          : isDragOver
          ? 'bg-brand-50/70 ring-2 ring-inset ring-brand-500'
          : 'hover:bg-stone-50'
      } ${isDragging ? 'opacity-40' : ''} ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="text-stone-300 hover:text-stone-500 px-1 py-1 shrink-0 transition-colors"
          title="Geser (drag & drop) untuk mengubah urutan kategori"
          aria-hidden="true"
        >
          <i className="fa-solid fa-grip-vertical text-xs"></i>
        </span>
        <span className="w-9 h-9 text-lg rounded-xl bg-stone-100 flex items-center justify-center shrink-0 shadow-inner">
          {cat.emoji || '🍽️'}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-xs text-stone-900 truncate">
              {cat.name}
            </span>
          </div>
          <span className="text-[10px] text-stone-500 block mt-0.5">
            {itemCount > 0 ? `${itemCount} item menu terhubung` : 'Belum ada menu terhubung'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div className="flex items-center mr-1">
          <button
            type="button"
            disabled={!canReorder || index === 0}
            onClick={() => onMoveByStep(cat.id, -1)}
            title="Geser naik"
            aria-label={`Geser naik ${cat.name}`}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <i className="fa-solid fa-arrow-up text-[10px]" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            disabled={!canReorder || index === total - 1}
            onClick={() => onMoveByStep(cat.id, 1)}
            title="Geser turun"
            aria-label={`Geser turun ${cat.name}`}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <i className="fa-solid fa-arrow-down text-[10px]" aria-hidden="true"></i>
          </button>
        </div>

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
  const [orderedCategories, setOrderedCategories] = useState<Category[]>(categories)
  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [isAdding, setIsAdding] = useState(false)

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🍽️')

  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)
  const [draggedCatId, setDraggedCatId] = useState<string | null>(null)
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setOrderedCategories([...categories].sort((a, b) => a.sort_order - b.sort_order))
  }, [categories])

  if (!isOpen) return null

  const resetForm = () => {
    setName('')
    setEmoji('🍽️')
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
    setError(null)
  }

  const persistCategoryOrder = async (nextList: Category[], previousList: Category[]) => {
    const withUpdatedSort = nextList.map((cat, idx) => ({
      ...cat,
      sort_order: idx + 1,
    }))
    setOrderedCategories(withUpdatedSort)

    const prevSortById = new Map(previousList.map((c) => [c.id, c.sort_order]))
    const changed = withUpdatedSort.filter((c) => prevSortById.get(c.id) !== c.sort_order)
    if (changed.length === 0) return

    setReordering(true)
    setError(null)
    try {
      await Promise.all(
        changed.map((c) =>
          adminApi.updateCategory(c.id, {
            name: c.name,
            emoji: c.emoji || '🍽️',
            sort_order: c.sort_order,
          })
        )
      )
      setNotice('Urutan kategori berhasil disimpan.')
      onCategoriesChanged()
      setTimeout(() => setNotice(null), 2500)
    } catch (err) {
      setOrderedCategories(previousList)
      setError(errorMessage(err, 'Gagal menyimpan urutan kategori.'))
    } finally {
      setReordering(false)
    }
  }

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, catId: string) => {
    setDraggedCatId(catId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', catId)
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, catId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (catId !== draggedCatId && dragOverCatId !== catId) {
      setDragOverCatId(catId)
    }
  }

  const handleDragLeave = () => {
    setDragOverCatId(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetCatId: string) => {
    e.preventDefault()
    const sourceId = draggedCatId || e.dataTransfer.getData('text/plain')
    setDraggedCatId(null)
    setDragOverCatId(null)

    if (!sourceId || sourceId === targetCatId) return

    const fromIndex = orderedCategories.findIndex((c) => c.id === sourceId)
    const toIndex = orderedCategories.findIndex((c) => c.id === targetCatId)
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return

    const next = [...orderedCategories]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)

    void persistCategoryOrder(next, orderedCategories)
  }

  const handleDragEnd = () => {
    setDraggedCatId(null)
    setDragOverCatId(null)
  }

  const handleMoveByStep = (catId: string, delta: -1 | 1) => {
    const fromIndex = orderedCategories.findIndex((c) => c.id === catId)
    const toIndex = fromIndex + delta
    if (fromIndex < 0 || toIndex < 0 || toIndex >= orderedCategories.length) return

    const next = [...orderedCategories]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)

    void persistCategoryOrder(next, orderedCategories)
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
          sort_order: editingCat.sort_order,
        })
        setNotice(`Kategori "${trimmedName}" berhasil diperbarui.`)
      } else {
        const nextSort =
          orderedCategories.length > 0
            ? Math.max(...orderedCategories.map((c) => c.sort_order)) + 1
            : 1
        await adminApi.createCategory({
          name: trimmedName,
          emoji: emoji || '🍽️',
          sort_order: nextSort,
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

  const canReorder = !saving && !reordering && !deletingId

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
              Tambah, ubah, atau geser (drag & drop) untuk mengatur urutan kategori.
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
                <div className="sm:col-span-9">
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
                Total {orderedCategories.length} kategori terdaftar
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                Daftar Kategori
              </h3>
              <span className="text-[11px] text-stone-400 flex items-center gap-1.5">
                {reordering ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-brand-600" aria-hidden="true"></i>
                    <span>Menyimpan urutan...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-grip-vertical text-stone-300" aria-hidden="true"></i>
                    <span>Geser baris untuk ubah urutan</span>
                  </>
                )}
              </span>
            </div>

            {orderedCategories.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center">
                Belum ada kategori. Silakan tambahkan kategori baru.
              </p>
            ) : (
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                {orderedCategories.map((cat, idx) => {
                  const itemCount = menuItems.filter((m) => m.category_id === cat.id).length
                  const isBusy = deletingId === cat.id
                  const isCurrentlyEditing = editingCat?.id === cat.id

                  return (
                    <CategoryRow
                      key={cat.id}
                      cat={cat}
                      index={idx}
                      total={orderedCategories.length}
                      itemCount={itemCount}
                      isBusy={isBusy}
                      isCurrentlyEditing={isCurrentlyEditing}
                      isDragging={draggedCatId === cat.id}
                      isDragOver={dragOverCatId === cat.id && draggedCatId !== cat.id}
                      canReorder={canReorder}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onDragEnd={handleDragEnd}
                      onMoveByStep={handleMoveByStep}
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
