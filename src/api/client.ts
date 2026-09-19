import axios from 'axios'
import { safeAssign } from '../utils/navigation'
import type {
  Branch,
  BranchCredentials,
  BranchSettings,
  Category,
  CategoryInput,
  ChangePasswordInput,
  DashboardStats,
  FeedbackAISummaryResponse,
  FeedbackAnalytics,
  FeedbackListResponse,
  GeocodeResult,
  MenuItem,
  MenuItemInput,
  Order,
  UpdateBranchCredentialsInput,
  User,
} from '../types'

export const USER_KEY = 'olga_admin_user'
export const TOKEN_KEY = 'olga_admin_token'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
  withCredentials: true,
})

// Attach stored auth token to outgoing API requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A rejected session means the staff session expired. Drop it and send
// the operator back to the login screen rather than leaving them on a page
// whose every request silently fails.
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TOKEN_KEY)
      if (!window.location.pathname.startsWith('/login')) {
        safeAssign('/login?expired=1')
      }
    }
    return Promise.reject(error)
  }
)

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function errorMessage(err: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.'): string {
  if (axios.isAxiosError(err)) {
    const apiError = err.response?.data?.error
    if (typeof apiError === 'string' && apiError.trim()) return apiError
    if (err.code === 'ECONNABORTED') return 'Koneksi timeout. Periksa jaringan dan coba lagi.'
    if (!err.response) return 'Tidak dapat menghubungi server.'
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export const adminApi = {
  // ---- Auth -------------------------------------------------------------
  login: async (identifier: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await api.post('/auth/admin-login', { identifier, password })
    const data = res.data.data
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token)
    }
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await api.get('/auth/me')
    return res.data.data
  },

  changePassword: async (data: ChangePasswordInput): Promise<{ message: string }> => {
    const res = await api.put('/admin/change-password', data)
    return res.data.data ?? res.data
  },

  getAllBranchCredentials: async (): Promise<BranchCredentials[]> => {
    const res = await api.get('/owner/branch-credentials')
    return res.data.data ?? []
  },

  getBranchCredentials: async (branchId: string): Promise<BranchCredentials> => {
    const res = await api.get(`/owner/branches/${branchId}/credentials`)
    return res.data.data
  },

  updateBranchCredentials: async (
    branchId: string,
    data: UpdateBranchCredentialsInput
  ): Promise<BranchCredentials> => {
    const res = await api.put(`/owner/branches/${branchId}/credentials`, data)
    return res.data.data
  },

  logout: () => {
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  },

  // ---- Branches ---------------------------------------------------------
  getBranches: async (): Promise<Branch[]> => {
    const res = await api.get('/branches')
    return res.data.data ?? []
  },

  toggleBranchStatus: async (branchId: string, isOpen: boolean) => {
    const res = await api.put(`/admin/branches/${branchId}/status`, { is_open: isOpen })
    return res.data.data
  },

  updateBranchProfile: async (
    branchId: string,
    profile: { name: string; address: string; phone: string; latitude: number; longitude: number }
  ): Promise<Branch> => {
    const res = await api.put(`/admin/branches/${branchId}/profile`, profile)
    return res.data.data
  },

  // Public geocoder proxy (same endpoint the customer app uses), so an
  // operator can pick an address for a branch instead of typing raw
  // coordinates by hand.
  searchAddress: async (query: string, signal?: AbortSignal): Promise<GeocodeResult[]> => {
    const res = await api.get('/geocode/search', { params: { q: query }, signal })
    return res.data.data ?? []
  },

  // ---- Orders -----------------------------------------------------------
  getOrders: async (params?: {
    status?: string
    branch_id?: string
    search?: string
    limit?: number
    offset?: number
  }): Promise<{ orders: Order[]; total: number; unread: number; statusCounts: Record<string, number> }> => {
    const res = await api.get('/admin/orders', { params })
    return {
      orders: res.data.data ?? [],
      total: res.data.total ?? 0,
      unread: res.data.unread ?? 0,
      statusCounts: res.data.status_counts ?? {},
    }
  },

  getOrder: async (id: string): Promise<Order> => {
    const res = await api.get(`/admin/orders/${id}`)
    return res.data.data
  },

  updateOrderStatus: async (
    orderId: string,
    status: string,
    expectedVersion: number,
    rejectionReason?: string
  ): Promise<Order> => {
    const res = await api.put(`/admin/orders/${orderId}/status`, {
      status,
      expected_version: expectedVersion,
      rejection_reason: rejectionReason ?? '',
    })
    return res.data.data
  },

  /**
   * Refunds a paid order through Midtrans. `amount` is optional — omit it (or
   * pass 0) to refund whatever is still outstanding. Moves the order to the
   * terminal "refunded" status on success.
   */
  refundOrder: async (
    orderId: string,
    reason: string,
    expectedVersion: number,
    amount?: number
  ): Promise<Order> => {
    const res = await api.post(`/admin/orders/${orderId}/refund`, {
      amount: amount ?? 0,
      reason,
      expected_version: expectedVersion,
    })
    return res.data.data
  },

  /** Clears the unread-order badge, which is backed by the database. */
  acknowledgeOrders: async (
    orderIds?: string[],
    branchId?: string
  ): Promise<{ acknowledged: number; unread: number }> => {
    const res = await api.post('/admin/orders/acknowledge', {
      ...(orderIds ? { order_ids: orderIds } : {}),
      ...(branchId ? { branch_id: branchId } : {}),
    })
    return res.data.data
  },

  // ---- Menu -------------------------------------------------------------
  getCategories: async (): Promise<Category[]> => {
    const res = await api.get('/categories')
    return res.data.data ?? []
  },

  createCategory: async (cat: CategoryInput): Promise<Category> => {
    const res = await api.post('/admin/categories', cat)
    return res.data.data
  },

  updateCategory: async (id: string, cat: Partial<CategoryInput>): Promise<Category> => {
    const res = await api.put(`/admin/categories/${id}`, cat)
    return res.data.data
  },

  deleteCategory: async (id: string): Promise<{ id: string }> => {
    const res = await api.delete(`/admin/categories/${id}`)
    return res.data.data
  },

  getMenuItems: async (branchIdOrSlug: string): Promise<MenuItem[]> => {
    const res = await api.get(`/branches/${branchIdOrSlug}/menu`)
    return res.data.data ?? []
  },

  createMenuItem: async (item: MenuItemInput): Promise<MenuItem> => {
    const res = await api.post('/admin/menu', item)
    return res.data.data
  },

  updateMenuItem: async (id: string, item: Partial<MenuItemInput>): Promise<MenuItem> => {
    // branch_id is required on creation but intentionally forbidden on the
    // update DTO: changing an item's outlet by editing it would be unsafe.
    const { branch_id: _branchId, ...payload } = item
    const res = await api.put(`/admin/menu/${id}`, payload)
    return res.data.data
  },

  createMenuItemsBulk: async (items: MenuItemInput[]): Promise<MenuItem[]> => {
    const res = await api.post('/admin/menu/bulk', { items })
    return res.data.data ?? []
  },

  toggleItemAvailability: async (id: string, isAvailable: boolean) => {
    const res = await api.put(`/admin/menu/${id}/availability`, { is_available: isAvailable })
    return res.data.data
  },

  deleteMenuItem: async (id: string) => {
    const res = await api.delete(`/admin/menu/${id}`)
    return res.data.data
  },

  uploadImage: async (file: File): Promise<string> => {
    if (!file || !file.type || !ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
      throw new Error('Tipe file tidak valid. Hanya gambar (JPG, PNG, GIF, atau WebP) yang diperbolehkan.')
    }
    const formData = new FormData()
    formData.append('image', file)
    const res = await api.post('/admin/upload', formData, {
      // Let the browser supply the multipart boundary. Manually setting this
      // header is the common cause of malformed upload bodies.
      headers: { 'Content-Type': undefined },
      timeout: 60000,
    })
    return res.data.data.url
  },

  // ---- Settings ---------------------------------------------------------
  getSettings: async (branchId: string): Promise<BranchSettings> => {
    const res = await api.get('/admin/settings', { params: { branch_id: branchId } })
    return res.data.data
  },

  updateSettings: async (settings: Partial<BranchSettings> & { branch_id: string }): Promise<BranchSettings> => {
    const res = await api.put('/admin/settings', settings)
    return res.data.data
  },

  // ---- Dashboard --------------------------------------------------------
  getBranchDashboard: async (branchId: string): Promise<DashboardStats> => {
    const res = await api.get('/admin/dashboard', { params: { branch_id: branchId } })
    return res.data.data
  },

  /** Network-wide, or one outlet when branchId is given. */
  getOwnerDashboard: async (branchId?: string): Promise<DashboardStats> => {
    const res = await api.get('/owner/dashboard', {
      params: branchId ? { branch_id: branchId } : undefined,
    })
    return res.data.data
  },

  // ---- Feedback & AI Analytics ------------------------------------------
  getFeedback: async (params?: {
    branch_id?: string
    rating?: number
    search?: string
    limit?: number
    offset?: number
  }): Promise<FeedbackListResponse> => {
    const res = await api.get('/admin/feedback', { params })
    return res.data.data
  },

  getFeedbackAnalytics: async (branchId?: string): Promise<FeedbackAnalytics> => {
    const res = await api.get('/admin/feedback/analytics', {
      params: branchId ? { branch_id: branchId } : undefined,
    })
    return res.data.data
  },

  getFeedbackAISummary: async (branchId?: string): Promise<FeedbackAISummaryResponse> => {
    const res = await api.post(
      '/admin/feedback/ai-summary',
      {},
      {
        params: branchId ? { branch_id: branchId } : undefined,
        timeout: 45000,
      }
    )
    return res.data.data
  },
}
