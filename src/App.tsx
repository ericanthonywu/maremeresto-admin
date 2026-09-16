import React from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './context/AuthContext'
import { NotificationProvider } from './context/NotificationContext'
import { AdminWebSocketProvider } from './context/AdminWebSocketContext'
import { AdminLayout } from './components/AdminLayout'

import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { OrdersPage } from './pages/OrdersPage'
import { MenuManagementPage } from './pages/MenuManagementPage'
import { FeedbackPage } from './pages/FeedbackPage'
import { SettingsPage } from './pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

const FullPageSpinner: React.FC = () => (
  <div className="min-h-screen bg-[#f5f3ef] flex items-center justify-center">
    <i className="fa-solid fa-circle-notch fa-spin text-3xl text-brand-600" aria-hidden="true"></i>
    <span className="sr-only">Memuat</span>
  </div>
)

const AppRoutes: React.FC = () => {
  const { user, initializing } = useAuth()

  // Wait for the stored token to be validated before deciding where to send
  // the operator, so a expired session does not briefly render the dashboard.
  if (initializing) return <FullPageSpinner />

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

      <Route
        element={
          user ? (
            // The notification provider sits above the socket provider: the
            // socket pushes new orders into it, and the layout renders its
            // toasts and bell on every page.
            <NotificationProvider>
              <AdminWebSocketProvider>
                <AdminLayout />
              </AdminWebSocketProvider>
            </NotificationProvider>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/menu" element={<MenuManagementPage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>

      {/* The old /owner/* routes all rendered the same dashboard. The owner now
          switches outlet from the sidebar instead. */}
      <Route path="/owner/*" element={<Navigate to="/dashboard" replace />} />
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  )
}

export const App: React.FC = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  </QueryClientProvider>
)

export default App
