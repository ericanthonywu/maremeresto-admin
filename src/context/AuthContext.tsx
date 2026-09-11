import React, { createContext, useContext, useState } from 'react'
import type { User } from '../types'
import { adminApi } from '../api/client'

interface AuthContextType {
  user: User | null
  login: (identifier: string, pass: string) => Promise<void>
  logout: () => void
  isOwner: boolean
  isBranchAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('olga_admin_user')
    return saved ? JSON.parse(saved) : null
  })

  const login = async (identifier: string, pass: string) => {
    const res = await adminApi.login(identifier, pass)
    setUser(res.user)
  }

  const logout = () => {
    adminApi.logout()
    setUser(null)
    window.location.href = '/login'
  }

  const isOwner = user?.role === 'owner'
  const isBranchAdmin = user?.role === 'branch_admin'

  return (
    <AuthContext.Provider value={{ user, login, logout, isOwner, isBranchAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
