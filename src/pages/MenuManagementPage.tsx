import React, { useEffect, useState } from 'react'
import { adminApi } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { MenuItem } from '../types'

export const MenuManagementPage: React.FC = () => {
  const { user } = useAuth()
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const branchId = user?.branch_id || '11111111-1111-1111-1111-111111111111'

  useEffect(() => {
    adminApi.getMenuItems(branchId).then((data) => {
      setItems(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [branchId])

  const handleToggleAvailability = async (item: MenuItem) => {
    try {
      await adminApi.toggleItemAvailability(item.id, !item.is_available)
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)))
    } catch (err) {
      alert('Gagal mengubah ketersediaan')
    }
  }

  const handleDeleteItem = async (item: MenuItem) => {
    if (!confirm(`Hapus "${item.name}" dari menu? Aksi ini tidak dapat dibatalkan.`)) return
    try {
      await adminApi.deleteMenuItem(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      alert('Gagal menghapus item')
    }
  }

  const formatRupiah = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val)

  const filteredItems = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group by category
  const grouped = filteredItems.reduce<Record<string, MenuItem[]>>((acc, item) => {
    const catName = item.category?.name || 'Uncategorized'
    if (!acc[catName]) acc[catName] = []
    acc[catName].push(item)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-serif text-2xl font-bold text-stone-900">Kelola Menu</h1>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari item menu..."
            className="px-4 py-2 bg-white border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-brand-500 w-48"
          />
          <span className="text-xs text-stone-400 font-bold">{items.length} item</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600"></i>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([catName, catItems]) => (
            <div key={catName}>
              <h3 className="font-bold text-sm text-stone-700 mb-3 flex items-center gap-2">
                <span>{catName}</span>
                <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">{catItems.length}</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {catItems.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 border shadow-sm flex items-start gap-3 transition-all ${
                      item.is_available ? 'border-stone-200' : 'border-red-200 bg-red-50/30 opacity-60'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl ${item.icon_bg_class} flex items-center justify-center text-xl text-brand-700 shrink-0`}>
                      <i className={`fa-solid ${item.icon}`}></i>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-stone-900 text-xs truncate">{item.name}</h4>
                        {item.tag && (
                          <span className="bg-amber-100 text-amber-800 text-[8px] font-extrabold px-1.5 py-0.5 rounded">{item.tag}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-stone-400 line-clamp-1 mt-0.5">{item.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-extrabold text-xs text-brand-700">{formatRupiah(item.price)}</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleToggleAvailability(item)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                              item.is_available
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            {item.is_available ? 'Tersedia' : 'Habis'}
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item)}
                            className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                            title="Hapus"
                          >
                            <i className="fa-solid fa-trash text-[10px]"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
