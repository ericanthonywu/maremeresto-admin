import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { render, screen, waitFor, renderHook, act } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { adminApi, TOKEN_KEY, USER_KEY } from '../../api/client'
import type { User, Branch } from '../../types'

// Mock adminApi
vi.mock('../../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/client')>()
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      getCurrentUser: vi.fn(),
      getBranches: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
    },
  }
})

const mockOwnerUser: User = {
  id: 'user-1',
  name: 'Owner User',
  phone: '08123456789',
  role: 'owner',
}

const mockBranchAdminUser: User = {
  id: 'user-2',
  name: 'Branch Admin',
  phone: '08987654321',
  role: 'branch_admin',
  branch_id: 'branch-2',
}

const mockBranches: Branch[] = [
  {
    id: 'branch-1',
    slug: 'outlet-1',
    name: 'Outlet 1',
    address: 'Addr 1',
    phone: '123',
    latitude: 0,
    longitude: 0,
    gradient_theme: 'theme-1',
    icon: 'icon-1',
    rating: 4.5,
    is_open: true,
    is_open_now: true,
  },
  {
    id: 'branch-2',
    slug: 'outlet-2',
    name: 'Outlet 2',
    address: 'Addr 2',
    phone: '456',
    latitude: 0,
    longitude: 0,
    gradient_theme: 'theme-2',
    icon: 'icon-2',
    rating: 4.8,
    is_open: true,
    is_open_now: true,
  },
]

describe('AuthProvider & useAuth', () => {
  const originalLocation = window.location

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Mock window.location.assign
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, assign: vi.fn() },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    })
  })

  const TestConsumer: React.FC = () => {
    const auth = useAuth()
    return (
      <div>
        <span data-testid="initializing">{auth.initializing ? 'true' : 'false'}</span>
        <span data-testid="user">{auth.user ? auth.user.name : 'no-user'}</span>
        <span data-testid="role">{auth.user?.role ?? 'no-role'}</span>
        <span data-testid="isOwner">{auth.isOwner ? 'true' : 'false'}</span>
        <span data-testid="isBranchAdmin">{auth.isBranchAdmin ? 'true' : 'false'}</span>
        <span data-testid="activeBranchId">{auth.activeBranchId ?? 'none'}</span>
        <span data-testid="activeBranchName">{auth.activeBranch?.name ?? 'none'}</span>
        <span data-testid="branchesCount">{auth.branches.length}</span>
        <button onClick={() => { void auth.login('test@test.com', 'pass') }}>Login</button>
        <button onClick={() => { auth.logout() }}>Logout</button>
        <button onClick={() => { auth.setActiveBranchId('branch-2') }}>Set Branch 2</button>
        <button onClick={() => { void auth.refreshBranches() }}>Refresh Branches</button>
      </div>
    )
  }

  describe('Initialization Logic', () => {
    it('initializes immediately without API call when no token exists in localStorage', async () => {
      vi.mocked(adminApi.getBranches).mockResolvedValue([])

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(screen.getByTestId('initializing')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(adminApi.getCurrentUser).not.toHaveBeenCalled()
    })

    it('handles invalid JSON in localStorage USER_KEY gracefully', async () => {
      localStorage.setItem(USER_KEY, 'invalid-json{')

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(screen.getByTestId('initializing')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    it('validates stored token on boot and merges fresh user data when getCurrentUser succeeds', async () => {
      localStorage.setItem(TOKEN_KEY, 'valid-token')
      localStorage.setItem(USER_KEY, JSON.stringify({ ...mockOwnerUser, name: 'Cached Name' }))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue({
        id: 'user-1',
        name: 'Fresh Owner User',
        phone: '08123456789',
        role: 'owner',
      })
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      expect(adminApi.getCurrentUser).toHaveBeenCalledTimes(1)

      await waitFor(() => {
        expect(screen.getByTestId('initializing')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('user')).toHaveTextContent('Fresh Owner User')
      expect(screen.getByTestId('isOwner')).toHaveTextContent('true')
    })

    it('resets user to null when getCurrentUser fails (e.g., token expired)', async () => {
      localStorage.setItem(TOKEN_KEY, 'expired-token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))

      vi.mocked(adminApi.getCurrentUser).mockRejectedValue(new Error('Unauthorized 401'))

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('initializing')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    it('safely handles component unmount while getCurrentUser request is pending', async () => {
      localStorage.setItem(TOKEN_KEY, 'valid-token')

      let resolveCurrentUser!: (user: User) => void
      const currentUserPromise = new Promise<User>((resolve) => {
        resolveCurrentUser = resolve
      })
      vi.mocked(adminApi.getCurrentUser).mockReturnValue(currentUserPromise)

      const { unmount } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      // Unmount while pending
      unmount()

      // Resolve after unmount
      await act(async () => {
        resolveCurrentUser(mockOwnerUser)
      })

      // No state update error should occur
    })

    it('safely handles unmount rejection while getCurrentUser request is pending', async () => {
      localStorage.setItem(TOKEN_KEY, 'valid-token')

      let rejectCurrentUser!: (err: Error) => void
      const currentUserPromise = new Promise<User>((_, reject) => {
        rejectCurrentUser = reject
      })
      vi.mocked(adminApi.getCurrentUser).mockReturnValue(currentUserPromise)

      const { unmount } = render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      unmount()

      await act(async () => {
        rejectCurrentUser(new Error('Network error'))
      })
    })
  })

  describe('Branch Loading & Management Logic', () => {
    it('loads all branches for owner and defaults active branch to first branch', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('branchesCount')).toHaveTextContent('2')
      })

      expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-1')
      expect(screen.getByTestId('activeBranchName')).toHaveTextContent('Outlet 1')
    })

    it('uses remembered active branch from localStorage for owner if valid', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))
      localStorage.setItem('olga_admin_active_branch', 'branch-2')

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-2')
      })
      expect(screen.getByTestId('activeBranchName')).toHaveTextContent('Outlet 2')
    })

    it('filters branches for branch_admin to only their assigned branch and pins activeBranchId', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockBranchAdminUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockBranchAdminUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('branchesCount')).toHaveTextContent('1')
      })

      expect(screen.getByTestId('isBranchAdmin')).toHaveTextContent('true')
      expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-2')
      expect(screen.getByTestId('activeBranchName')).toHaveTextContent('Outlet 2')
    })

    it('allows owner to change active branch and persists choice to localStorage', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-1')
      })

      await act(async () => {
        screen.getByText('Set Branch 2').click()
      })

      expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-2')
      expect(localStorage.getItem('olga_admin_active_branch')).toBe('branch-2')
    })

    it('prevents branch_admin from changing active branch', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockBranchAdminUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockBranchAdminUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-2')
      })

      await act(async () => {
        screen.getByText('Set Branch 2').click()
      })

      expect(screen.getByTestId('activeBranchId')).toHaveTextContent('branch-2')
      expect(localStorage.getItem('olga_admin_active_branch')).toBeNull()
    })

    it('handles errors when fetching branches by clearing branches list', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockRejectedValue(new Error('Failed to load branches'))

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('initializing')).toHaveTextContent('false')
      })

      expect(screen.getByTestId('branchesCount')).toHaveTextContent('0')
      expect(screen.getByTestId('activeBranchId')).toHaveTextContent('none')
    })
  })

  describe('Auth Actions', () => {
    it('handles login successfully', async () => {
      vi.mocked(adminApi.login).mockResolvedValue({
        token: 'new-token',
        user: mockOwnerUser,
      })
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await act(async () => {
        screen.getByText('Login').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('Owner User')
      })

      expect(adminApi.login).toHaveBeenCalledWith('test@test.com', 'pass')
    })

    it('handles logout by invoking adminApi.logout, clearing user state, removing stored branch, and redirecting', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))
      localStorage.setItem('olga_admin_active_branch', 'branch-1')

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockResolvedValue(mockBranches)

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('user')).toHaveTextContent('Owner User')
      })

      await act(async () => {
        screen.getByText('Logout').click()
      })

      expect(adminApi.logout).toHaveBeenCalled()
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
      expect(localStorage.getItem('olga_admin_active_branch')).toBeNull()
      expect(window.location.assign).toHaveBeenCalledWith('/login')
    })

    it('allows manual refresh of branches via refreshBranches', async () => {
      localStorage.setItem(TOKEN_KEY, 'token')
      localStorage.setItem(USER_KEY, JSON.stringify(mockOwnerUser))

      vi.mocked(adminApi.getCurrentUser).mockResolvedValue(mockOwnerUser)
      vi.mocked(adminApi.getBranches).mockResolvedValueOnce([mockBranches[0]])

      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('branchesCount')).toHaveTextContent('1')
      })

      vi.mocked(adminApi.getBranches).mockResolvedValueOnce(mockBranches)

      await act(async () => {
        screen.getByText('Refresh Branches').click()
      })

      await waitFor(() => {
        expect(screen.getByTestId('branchesCount')).toHaveTextContent('2')
      })
    })
  })

  describe('useAuth Hook validation', () => {
    it('throws error when used outside of AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow('useAuth must be used within an AuthProvider')

      consoleError.mockRestore()
    })
  })
})
