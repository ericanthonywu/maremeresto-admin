import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi, errorMessage, formatRupiah } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { MenuItemFormModal } from '../components/MenuItemFormModal'
import { CategoryManagementModal } from '../components/CategoryManagementModal'
import { BulkMenuItemModal } from '../components/BulkMenuItemModal'
import type { Category, MenuItem } from '../types'

type AvailabilityFilter = 'all' | 'available' | 'unavailable'

export const MenuManagementPage: React.FC = () => {
  const { activeBranchId, activeBranch } = useAuth()

  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
	const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  const setBusy = (id: string, busy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })

  const showNotice = useCallback((msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice(null), 3000)
  }, [])

  const load = useCallback(async () => {
    if (!activeBranchId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [menu, cats] = await Promise.all([
        adminApi.getMenuItems(activeBranchId),
        adminApi.getCategories(),
      ])
      setItems(menu)
      setCategories(cats)
    } catch (err) {
      setError(errorMessage(err, 'Gagal memuat daftar menu.'))
    } finally {
      setLoading(false)
    }
  }, [activeBranchId])

  useEffect(() => {
    void load()
  }, [load])

  const handleToggleAvailability = async (item: MenuItem) => {
    setBusy(item.id, true)
    // Optimistic flip, reverted if the request fails.
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i))
    )
    try {
      await adminApi.toggleItemAvailability(item.id, !item.is_available)
      showNotice(`"${item.name}" ditandai ${!item.is_available ? 'tersedia' : 'habis'}.`)
    } catch (err) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, is_available: item.is_available } : i))
      )
      setError(errorMessage(err, 'Gagal mengubah ketersediaan.'))
    } finally {
      setBusy(item.id, false)
    }
  }

  const handleDelete = async (item: MenuItem) => {
    if (
      !window.confirm(
        `Hapus "${item.name}" dari menu ${activeBranch?.name ?? 'outlet ini'}?\n\nTindakan ini tidak dapat dibatalkan. Untuk menyembunyikan sementara, gunakan tombol "Habis".`
      )
    ) {
      return
    }

    setBusy(item.id, true)
    try {
      await adminApi.deleteMenuItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      showNotice(`"${item.name}" dihapus.`)
    } catch (err) {
      setError(errorMessage(err, 'Gagal menghapus item.'))
    } finally {
      setBusy(item.id, false)
    }
  }

  const handleSaved = (saved: MenuItem, mode: 'created' | 'updated') => {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
    })
    showNotice(mode === 'created' ? `"${saved.name}" ditambahkan.` : `"${saved.name}" diperbarui.`)
  }

  const handleBulkSaved = (saved: MenuItem[]) => {
    setItems((current) => [...current, ...saved])
    showNotice(`${saved.length} menu berhasil ditambahkan.`)
  }

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (item: MenuItem) => {
    setEditing(item)
    setFormOpen(true)
  }

  const searchableItems = useMemo(() => {
    return items.map((i) => ({
      item: i,
      nameLower: i.name.toLowerCase(),
      descriptionLower: i.description.toLowerCase(),
      categoryNameLower: (i.category?.name ?? '').toLowerCase(),
      tagLower: (i.tag ?? '').toLowerCase(),
    }))
  }, [items])

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return searchableItems
      .filter(({ item, nameLower, descriptionLower, categoryNameLower, tagLower }) => {
        if (categoryFilter !== 'all' && item.category_id !== categoryFilter) return false
        if (availabilityFilter === 'available' && !item.is_available) return false
        if (availabilityFilter === 'unavailable' && item.is_available) return false
        if (!query) return true
        return (
          nameLower.includes(query) ||
          descriptionLower.includes(query) ||
          categoryNameLower.includes(query) ||
          tagLower.includes(query)
        )
      })
      .map(({ item }) => item)
  }, [searchableItems, categoryFilter, availabilityFilter, searchQuery])

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const item of filteredItems) {
      const key = item.category?.name ?? 'Tanpa kategori'
      const bucket = map.get(key)
      if (bucket) bucket.push(item)
      else map.set(key, [item])
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    }
    return map
  }, [filteredItems])

  const unavailableCount = items.filter((i) => !i.is_available).length

  if (!activeBranchId) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm">
        <i className="fa-solid fa-store text-3xl text-stone-300 mb-2" aria-hidden="true"></i>
        <h3 className="font-bold text-stone-800 text-sm">Pilih outlet terlebih dahulu</h3>
        <p className="text-xs text-stone-500 mt-1">
          Gunakan pemilih outlet di sidebar untuk menentukan menu yang dikelola.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">Kelola Menu</h1>
          <p className="text-xs text-stone-500">
            {activeBranch?.name} · {items.length} item
            {unavailableCount > 0 && ` · ${unavailableCount} habis`}
          </p>
        </div>

        <div className="flex items-center gap-2">
		  <button
			onClick={() => setBulkModalOpen(true)}
			className="px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95"
		  >
			<i className="fa-solid fa-table-list text-brand-600" aria-hidden="true"></i>
			<span>Tambah bulk</span>
		  </button>
          <button
            onClick={() => setCategoryModalOpen(true)}
            className="px-4 py-2.5 bg-white hover:bg-stone-50 text-stone-700 border border-stone-300 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <i className="fa-solid fa-tags text-brand-600" aria-hidden="true"></i>
            <span>Kelola Kategori</span>
          </button>

          <button
            onClick={openCreate}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Tambah menu</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2"
        >
          <i className="fa-solid fa-circle-check" aria-hidden="true"></i>
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold flex items-center justify-between gap-3"
        >
          <span className="flex items-center gap-2">
            <i className="fa-solid fa-circle-exclamation" aria-hidden="true"></i>
            {error}
          </span>
          <button onClick={() => setError(null)} className="underline shrink-0">
            Tutup
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[12rem]">
          <label htmlFor="menu-admin-search" className="sr-only">
            Cari menu
          </label>
          <i
            className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs"
            aria-hidden="true"
          ></i>
          <input
            id="menu-admin-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, deskripsi, atau label..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter kategori"
          className="px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-brand-500"
        >
          <option value="all">Semua kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>

        {/* Radio buttons filter */}
        <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs">
          {(
            [
              { id: 'all', label: 'Semua' },
              { id: 'available', label: 'Tersedia' },
              { id: 'unavailable', label: 'Habis' },
            ] as const
          ).map((opt) => (
            <label
              key={opt.id}
              className={`inline-flex items-center gap-1.5 cursor-pointer px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
                availabilityFilter === opt.id
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <input
                type="radio"
                name="availabilityFilter"
                value={opt.id}
                checked={availabilityFilter === opt.id}
                onChange={() => setAvailabilityFilter(opt.id)}
                className="w-3.5 h-3.5 text-brand-600 focus:ring-brand-500 cursor-pointer"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Quick action checkbox to hide out-of-stock items */}
        <label className="inline-flex items-center gap-2 bg-white border border-stone-300 rounded-xl px-3 py-2 text-xs font-semibold text-stone-700 cursor-pointer hover:bg-stone-50 transition-colors select-none">
          <input
            type="checkbox"
            checked={availabilityFilter === 'available'}
            onChange={(e) => setAvailabilityFilter(e.target.checked ? 'available' : 'all')}
            className="w-4 h-4 rounded text-brand-600 border-stone-300 focus:ring-brand-500 cursor-pointer"
          />
          <i className="fa-solid fa-eye-slash text-stone-400 text-xs" aria-hidden="true"></i>
          <span>Sembunyikan menu stok habis</span>
        </label>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600" aria-hidden="true"></i>
          <span className="sr-only">Memuat menu</span>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm space-y-3">
          <i className="fa-solid fa-mug-hot text-4xl text-stone-300" aria-hidden="true"></i>
          <h3 className="font-bold text-stone-800 text-sm">Outlet ini belum punya menu</h3>
          <p className="text-xs text-stone-500">Tambahkan item pertama agar pelanggan dapat memesan.</p>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-xs font-bold shadow-md"
          >
            <i className="fa-solid fa-plus" aria-hidden="true"></i>
            <span>Tambah menu</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-stone-200 shadow-sm">
          <i className="fa-solid fa-filter-circle-xmark text-3xl text-stone-300 mb-2" aria-hidden="true"></i>
          <h3 className="font-bold text-stone-800 text-sm">Tidak ada menu yang cocok dengan filter</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([catName, catItems]) => (
            <section key={catName}>
              <h3 className="font-bold text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span>{catName}</span>
                <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                  {catItems.length}
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {catItems.map((item) => {
                  const busy = busyIds.has(item.id)
                  return (
                    <article
                      key={item.id}
                      className={`bg-white rounded-2xl p-4 border shadow-sm flex items-start gap-3 transition-all ${
                        item.is_available ? 'border-stone-200' : 'border-red-200 bg-red-50/30'
                      } ${busy ? 'opacity-60' : ''}`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl ${item.icon_bg_class} flex items-center justify-center text-xl text-brand-700 shrink-0 overflow-hidden`}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                        ) : (
                          <i className={`fa-solid ${item.icon}`} aria-hidden="true"></i>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-stone-900 text-xs truncate">{item.name}</h4>
                          {item.tag && (
                            <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase">
                              {item.tag}
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-stone-400 line-clamp-2 mt-0.5">
                          {item.description || <span className="italic">Tanpa deskripsi</span>}
                        </p>

                        <div className="flex items-center justify-between mt-2 gap-2">
                          <span className="font-extrabold text-xs text-brand-700">
                            {formatRupiah(item.price)}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Quick action button / checkbox to hide item if stock is out */}
                            <label
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer select-none ${
                                item.is_available
                                  ? 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                              } ${busy ? 'opacity-50 pointer-events-none' : ''}`}
                              title={
                                item.is_available
                                  ? 'Centang untuk hide menu ini dari pesanan (stok habis)'
                                  : 'Klik untuk mengaktifkan kembali menu (tersedia)'
                              }
                            >
                              <input
                                type="checkbox"
                                checked={!item.is_available}
                                onChange={() => handleToggleAvailability(item)}
                                disabled={busy}
                                className="w-3.5 h-3.5 rounded text-red-600 border-stone-300 focus:ring-red-500 cursor-pointer"
                              />
                              <span>{!item.is_available ? 'Stok Habis (Hide)' : 'Hide jika habis'}</span>
                            </label>

                            <button
                              onClick={() => openEdit(item)}
                              disabled={busy}
                              title="Ubah menu"
                              aria-label={`Ubah ${item.name}`}
                              className="p-1.5 text-stone-400 hover:text-brand-600 disabled:opacity-50 transition-colors"
                            >
                              <i className="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
                            </button>

                            <button
                              onClick={() => handleDelete(item)}
                              disabled={busy}
                              title="Hapus menu"
                              aria-label={`Hapus ${item.name}`}
                              className="p-1.5 text-stone-400 hover:text-red-500 disabled:opacity-50 transition-colors"
                            >
                              <i className="fa-solid fa-trash text-[10px]" aria-hidden="true"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <MenuItemFormModal
        isOpen={formOpen}
        item={editing}
        branchId={activeBranchId}
        categories={categories}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
      />

	  <BulkMenuItemModal
		isOpen={bulkModalOpen}
		branchId={activeBranchId}
		categories={categories}
		onClose={() => setBulkModalOpen(false)}
		onSaved={handleBulkSaved}
	  />

      <CategoryManagementModal
        isOpen={categoryModalOpen}
        categories={categories}
        menuItems={items}
        onClose={() => setCategoryModalOpen(false)}
        onCategoriesChanged={() => void load()}
      />
    </div>
  )
}
