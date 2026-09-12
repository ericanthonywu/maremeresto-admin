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
  facility_tags?: string[]
  rating: number
  is_open: boolean
  /** Derived server-side from is_open AND today's operating hours. */
  is_open_now: boolean
  today_hours?: string
  whatsapp_number?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  emoji: string
  sort_order: number
}

export interface CategoryInput {
  name: string
  emoji: string
  sort_order: number
}

export interface GeocodeResult {
  label: string
  full_address: string
  latitude: number
  longitude: number
  postcode?: string
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id?: string
  item_name: string
  item_price: number
  item_icon: string
  quantity: number
  notes?: string
  line_total: number
}

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'on_the_way'
  | 'picked_up'
  | 'delivered'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'refunded'

export interface Order {
  id: string
  order_number: string
  branch_id: string
  branch?: Branch
  order_type: 'delivery' | 'pickup' | 'scheduled'
  status: OrderStatus
  customer_name: string
  customer_phone: string
  delivery_address?: string
  delivery_notes?: string
  delivery_lat?: number
  delivery_lon?: number
  delivery_distance_km: number
  subtotal: number
  delivery_fee: number
  service_fee: number
  discount: number
  grand_total: number
  promo_code?: string
  scheduled_at?: string
  acknowledged_at?: string
  rejection_reason?: string
  version: number
  items?: OrderItem[]
  payment?: {
    status: 'pending' | 'settlement' | 'expire' | 'cancel' | 'refund'
    payment_method: string
    amount: number
    paid_at?: string
    refund_amount: number
    refund_reason?: string
    refunded_at?: string
  }
  created_at: string
}

export interface MenuItem {
  id: string
  branch_id: string
  category_id: string
  category?: Category
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

/** Payload for creating or updating a menu item from the admin form. */
export interface MenuItemInput {
  branch_id?: string
  category_id: string
  name: string
  description: string
  price: number
  icon: string
  icon_bg_class: string
  image_url: string
  tag: string
  is_available: boolean
  sort_order: number
}

export interface BranchSettings {
  id: string
  branch_id: string
  operating_hours: OperatingHours
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

export interface DayHours {
  open: string
  close: string
}

export interface OperatingHours {
  weekday?: DayHours
  weekend?: DayHours
  [day: string]: DayHours | undefined
}

export interface HourlySalesPoint {
  hour: string
  orders: number
  revenue: number
}

export interface BranchSalesPoint {
  branch_id: string
  branch_name: string
  orders: number
  revenue: number
}

export interface DashboardStats {
  total_orders: number
  total_revenue: number
  avg_order: number
  pending_orders: number
  completed_orders: number
  cancelled_orders: number
  /** null when there is no comparable previous day, rather than a fake figure. */
  orders_delta_pct: number | null
  revenue_delta_pct: number | null
  hourly: HourlySalesPoint[]
  branches?: BranchSalesPoint[]
}
