import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Branch, User } from '../types'
import { adminApi, TOKEN_KEY, USER_KEY } from '../api/client'
import { safeAssign } from '../utils/navigation'

interface AuthContextType {
  user: User | null
  /** True until the stored session has been checked against the server. */
  initializing: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  isOwner: boolean
  isBranchAdmin: boolean

  /** Outlets this account may act on. One for a branch admin, all for the owner. */
  branches: Branch[]
  /**
   * The outlet currently in view. A branch admin is pinned to their own; the
   * owner can switch, which previously was impossible — every owner request
   * silently fell back to a hardcoded branch UUID.
   */
  activeBranchId: string | null
  setActiveBranchId: (id: string) => void
  activeBranch: Branch | null
  /** Re-fetches branches after an admin edits an outlet's profile (name/address/phone). */
  refreshBranches: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const ACTIVE_BRANCH_KEY = 'olga_admin_active_branch'

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(readStoredUser)
  const [initializing, setInitializing] = useState(Boolean(localStorage.getItem(TOKEN_KEY)))
  const [branches, setBranches] = useState<Branch[]>([])
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null)

  // Validate the stored token on boot. A cached user object alone is not proof
  // of a live session, so the app used to render the dashboard for an expired
  // login and then fail every request.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setInitializing(false)
      return
    }

    let cancelled = false
    adminApi
      .getCurrentUser()
      .then((fresh) => {
        if (cancelled) return
        // Merge: /auth/me returns identity claims, the login response carries
        // the display name.
        setUser((prev) => ({ ...(prev ?? ({} as User)), ...fresh }))
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setInitializing(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // Load the outlets this account can act on.
  const loadBranches = useCallback(async () => {
    if (!user) {
      setBranches([])
      return
    }
    try {
      const all = await adminApi.getBranches()
      const permitted = user.role === 'owner' ? all : all.filter((b) => b.id === user.branch_id)
      setBranches(permitted)

      setActiveBranchIdState((prev) => {
        if (prev && permitted.some((b) => b.id === prev)) return prev
        const remembered = localStorage.getItem(ACTIVE_BRANCH_KEY)
        return user.role === 'owner'
          ? (permitted.find((b) => b.id === remembered)?.id ?? permitted[0]?.id ?? null)
          : (user.branch_id ?? null)
      })
    } catch {
      setBranches([])
    }
  }, [user])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await adminApi.login(identifier, password)
    setUser(res.user)
  }, [])

  const logout = useCallback(() => {
    adminApi.logout()
    setUser(null)
    localStorage.removeItem(ACTIVE_BRANCH_KEY)
    safeAssign('/login')
  }, [])

  const setActiveBranchId = useCallback(
    (id: string) => {
      // A branch admin cannot move off their own outlet.
      if (user?.role !== 'owner') return
      localStorage.setItem(ACTIVE_BRANCH_KEY, id)
      setActiveBranchIdState(id)
    },
    [user?.role]
  )

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) ?? null,
    [branches, activeBranchId]
  )

  const value = useMemo(
    () => ({
      user,
      initializing,
      login,
      logout,
      isOwner: user?.role === 'owner',
      isBranchAdmin: user?.role === 'branch_admin',
      branches,
      activeBranchId,
      setActiveBranchId,
      activeBranch,
      refreshBranches: loadBranches,
    }),
    [user, initializing, login, logout, branches, activeBranchId, setActiveBranchId, activeBranch, loadBranches]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
