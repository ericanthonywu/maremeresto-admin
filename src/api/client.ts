import axios from 'axios'
import type { User, Branch, Order, MenuItem, BranchSettings } from '../types'

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('olga_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const adminApi = {
  // Auth
  login: async (identifier: string, password: string): Promise<{ token: string; user: User }> => {
    const res = await api.post('/auth/admin-login', { identifier, password })
    const data = res.data.data
    localStorage.setItem('olga_admin_token', data.token)
    localStorage.setItem('olga_admin_user', JSON.stringify(data.user))
    return data
  },

  getCurrentUser: async (): Promise<User> => {
    const res = await api.get('/auth/me')
    return res.data.data
  },

  logout: () => {
    localStorage.removeItem('olga_admin_token')
    localStorage.removeItem('olga_admin_user')
  },

  // Branches
  getBranches: async (): Promise<Branch[]> => {
    const res = await api.get('/branches')
    return res.data.data
  },

  toggleBranchStatus: async (branchId: string, isOpen: boolean) => {
    const res = await api.put(`/admin/branches/${branchId}/status`, { is_open: isOpen })
    return res.data
  },

  // Orders
  getOrders: async (params?: { status?: string; branch_id?: string; search?: string }): Promise<{ data: Order[]; total: number }> => {
    const res = await api.get('/admin/orders', { params })
    return res.data
  },

  getOrder: async (id: string): Promise<Order> => {
    const res = await api.get(`/orders/${id}`)
    return res.data.data
  },

  updateOrderStatus: async (orderId: string, status: string, expectedVersion: number, rejectionReason?: string) => {
    const res = await api.put(`/admin/orders/${orderId}/status`, {
      status,
      expected_version: expectedVersion,
      rejection_reason: rejectionReason || '',
    })
    return res.data
  },

  // Menu Management
  getMenuItems: async (branchId: string): Promise<MenuItem[]> => {
    const res = await api.get(`/branches/${branchId}/menu`)
    return res.data.data
  },

  createMenuItem: async (item: Partial<MenuItem>): Promise<MenuItem> => {
    const res = await api.post('/admin/menu', item)
    return res.data.data
  },

  updateMenuItem: async (id: string, item: Partial<MenuItem>): Promise<MenuItem> => {
    const res = await api.put(`/admin/menu/${id}`, item)
    return res.data.data
  },

  toggleItemAvailability: async (id: string, isAvailable: boolean) => {
    const res = await api.put(`/admin/menu/${id}/availability`, { is_available: isAvailable })
    return res.data
  },

  deleteMenuItem: async (id: string) => {
    const res = await api.delete(`/admin/menu/${id}`)
    return res.data
  },

  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)
    const res = await api.post('/admin/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.url
  },

  // Settings
  getSettings: async (branchId?: string): Promise<BranchSettings> => {
    const res = await api.get('/admin/settings', { params: { branch_id: branchId } })
    return res.data.data
  },

  updateSettings: async (settings: Partial<BranchSettings>) => {
    const res = await api.put('/admin/settings', settings)
    return res.data
  },

  // Dashboard & Analytics
  getBranchDashboard: async (): Promise<any> => {
    const res = await api.get('/admin/dashboard')
    return res.data.data
  },

  getOwnerDashboard: async (): Promise<any> => {
    const res = await api.get('/owner/dashboard')
    return res.data.data
  },
}
