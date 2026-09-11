import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'
import { AdminLayout } from './components/AdminLayout'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { MenuManagementPage } from './pages/MenuManagementPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient()

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

const AppRoutes: React.FC = () => {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AdminWebSocketProvider>
              <AdminLayout />
            </AdminWebSocketProvider>
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/menu" element={<MenuManagementPage />} />
        <Route path="/settings" element={<SettingsPage />} />

        {/* Owner routes reuse same pages with isOwner context */}
        <Route path="/owner/dashboard" element={<DashboardPage />} />
        <Route path="/owner/orders" element={<OrdersPage />} />
        <Route path="/owner/branches" element={<DashboardPage />} />
        <Route path="/owner/analytics" element={<DashboardPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
