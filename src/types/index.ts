export interface User {
  id: string
  name: string
  phone: string
  role: 'branch_admin' | 'owner'
  branch_id?: string
}

export interface Branch {
  id: string
  slug: string
  name: string
  address: string
  phone: string
  latitude: number
  longitude: number
  gradient_theme: string
  icon: string
  rating: number
  is_open: boolean
}

export interface OrderItem {
  id: string
  order_id: string
  item_name: string
  item_price: number
  item_icon: string
  quantity: number
  notes?: string
  line_total: number
}

export interface Order {
  id: string
  order_number: string
  branch_id: string
  branch?: Branch
  order_type: 'delivery' | 'pickup' | 'scheduled'
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'completed' | 'rejected' | 'cancelled'
  customer_name: string
  customer_phone: string
  delivery_address?: string
  delivery_notes?: string
  subtotal: number
  delivery_fee: number
  service_fee: number
  discount: number
  grand_total: number
  driver_name?: string
  driver_plate?: string
  version: number
  items?: OrderItem[]
  created_at: string
  rejection_reason?: string
}

export interface MenuItem {
  id: string
  branch_id: string
  category_id: string
  category?: {
    id: string
    name: string
    slug: string
  }
  name: string
  description: string
  price: number
  icon: string
  icon_bg_class: string
  image_url?: string
  tag?: string
  is_available: boolean
  sort_order: number
}

export interface BranchSettings {
  id: string
  branch_id: string
  operating_hours: any
  max_delivery_radius_km: number
  base_delivery_fee_near: number
  base_delivery_fee_mid: number
  base_delivery_fee_far: number
  near_threshold_km: number
  mid_threshold_km: number
  service_fee: number
  min_order_amount: number
  free_delivery_threshold: number
  whatsapp_number: string
  description?: string
}
