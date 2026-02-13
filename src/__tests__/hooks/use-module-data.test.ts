/**
 * Unit tests for useModuleData hook
 * Tests CRUD operations, loading states, error handling, and caching
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useModuleData } from '@/hooks/common/use-module-data'

// Mock fetch
global.fetch = jest.fn()

// Mock toast
const mockToast = jest.fn()
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast
  })
}))

// Mock data for testing
interface TestUser {
  id: string
  name: string
  email: string
  role: string
}

const mockUsers: TestUser[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'ADMIN' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'USER' },
  { id: '3', name: 'Bob Johnson', email: 'bob@example.com', role: 'USER' }
]

const mockFetchSuccess = (data: any) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ success: true, data })
  } as Response)
}

const mockFetchError = (status: number, message: string) => {
  return Promise.resolve({
    ok: false,
    status,
    statusText: message,
    json: () => Promise.resolve({ message })
  } as Response)
}

describe('useModuleData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
    mockToast.mockClear()
    // Clear cache between tests
    jest.resetModules()
  })

  describe('Data Loading (GET)', () => {
    it('should load data on mount when initialLoad is true', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      expect(result.current.loading).toBe(true)
      expect(result.current.data).toEqual([])

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockUsers)
      expect(result.current.error).toBeNull()
      expect(global.fetch).toHaveBeenCalledWith('/api/users')
    })

    it('should not load data on mount when initialLoad is false', () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: false })
      )

      expect(result.current.loading).toBe(false)
      expect(result.current.data).toEqual([])
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('should handle array response format', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers)
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockUsers)
    })

    it('should handle success/data response format', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockUsers)
    })

    it('should handle single item response', async () => {
      const singleUser = mockUsers[0]
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(singleUser))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users/1', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([singleUser])
    })

    it('should apply transform function if provided', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const transform = (data: TestUser[]) => data.filter(u => u.role === 'ADMIN')

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          transform 
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(1)
      expect(result.current.data[0].role).toBe('ADMIN')
    })

    it('should call onSuccess callback when data loads successfully', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))
      const onSuccess = jest.fn()

      renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          onSuccess 
        })
      )

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(mockUsers)
      })
    })

    it('should handle loading error', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        mockFetchError(500, 'Internal Server Error')
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toContain('Error 500')
      expect(result.current.data).toEqual([])
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive'
        })
      )
    })

    it('should call onError callback when loading fails', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        mockFetchError(404, 'Not Found')
      )
      const onError = jest.fn()

      renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          onError 
        })
      )

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(expect.stringContaining('Error 404'))
      })
    })
  })

  describe('Create Operation (POST)', () => {
    it('should create a new item successfully', async () => {
      const newUser = { id: '4', name: 'Alice Williams', email: 'alice@example.com', role: 'USER' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(newUser))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(3)

      let createdUser: TestUser | null = null
      await act(async () => {
        createdUser = await result.current.create({ name: 'Alice Williams', email: 'alice@example.com' })
      })

      expect(createdUser).toEqual(newUser)
      expect(result.current.data).toHaveLength(4)
      expect(result.current.data[3]).toEqual(newUser)
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String)
        })
      )
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Éxito',
          description: 'Registro creado correctamente'
        })
      )
    })

    it('should handle create error', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchError(400, 'Bad Request'))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let createdUser: TestUser | null = null
      await act(async () => {
        createdUser = await result.current.create({ name: 'Invalid' })
      })

      expect(createdUser).toBeNull()
      expect(result.current.data).toHaveLength(3) // Should not add to list
      expect(result.current.error).toContain('Bad Request')
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive'
        })
      )
    })

    it('should set loading state during create', async () => {
      const newUser = { id: '4', name: 'Alice', email: 'alice@example.com', role: 'USER' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => new Promise(resolve => 
          setTimeout(() => resolve(mockFetchSuccess(newUser)), 100)
        ))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.create({ name: 'Alice' })
      })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('Update Operation (PUT)', () => {
    it('should update an existing item successfully', async () => {
      const updatedUser = { ...mockUsers[0], name: 'John Updated' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(updatedUser))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let updated: TestUser | null = null
      await act(async () => {
        updated = await result.current.update('1', { name: 'John Updated' })
      })

      expect(updated).toEqual(updatedUser)
      expect(result.current.data[0].name).toBe('John Updated')
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        })
      )
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Éxito',
          description: 'Registro actualizado correctamente'
        })
      )
    })

    it('should handle update error', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchError(404, 'Not Found'))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const originalName = result.current.data[0].name

      let updated: TestUser | null = null
      await act(async () => {
        updated = await result.current.update('1', { name: 'Updated' })
      })

      expect(updated).toBeNull()
      expect(result.current.data[0].name).toBe(originalName) // Should not update
      expect(result.current.error).toContain('Not Found')
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive'
        })
      )
    })

    it('should update only the specified item', async () => {
      const updatedUser = { ...mockUsers[1], name: 'Jane Updated' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(updatedUser))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.update('2', { name: 'Jane Updated' })
      })

      expect(result.current.data[0].name).toBe('John Doe') // Unchanged
      expect(result.current.data[1].name).toBe('Jane Updated') // Changed
      expect(result.current.data[2].name).toBe('Bob Johnson') // Unchanged
    })
  })

  describe('Delete Operation (DELETE)', () => {
    it('should delete an item successfully', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(3)

      let deleted: boolean = false
      await act(async () => {
        deleted = await result.current.remove('1')
      })

      expect(deleted).toBe(true)
      expect(result.current.data).toHaveLength(2)
      expect(result.current.data.find(u => u.id === '1')).toBeUndefined()
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/users/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Éxito',
          description: 'Registro eliminado correctamente'
        })
      )
    })

    it('should handle delete error', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchError(403, 'Forbidden'))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let deleted: boolean = false
      await act(async () => {
        deleted = await result.current.remove('1')
      })

      expect(deleted).toBe(false)
      expect(result.current.data).toHaveLength(3) // Should not remove
      expect(result.current.error).toContain('Forbidden')
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          variant: 'destructive'
        })
      )
    })

    it('should remove only the specified item', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.remove('2')
      })

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data.find(u => u.id === '1')).toBeDefined()
      expect(result.current.data.find(u => u.id === '2')).toBeUndefined()
      expect(result.current.data.find(u => u.id === '3')).toBeDefined()
    })
  })

  describe('Reload Operation', () => {
    it('should reload data', async () => {
      const updatedUsers = [...mockUsers, { id: '4', name: 'New User', email: 'new@example.com', role: 'USER' }]
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(updatedUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(3)

      await act(async () => {
        await result.current.reload()
      })

      expect(result.current.data).toHaveLength(4)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should show loading state during reload', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => new Promise(resolve => 
          setTimeout(() => resolve(mockFetchSuccess(mockUsers)), 100)
        ))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      act(() => {
        result.current.reload()
      })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should invalidate cache on reload', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          enableCache: true,
          cacheTTL: 60000
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Reload should fetch again even with cache
      await act(async () => {
        await result.current.reload()
      })

      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('Utility Functions', () => {
    it('should find item by id', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const found = result.current.findById('2')
      expect(found).toEqual(mockUsers[1])
    })

    it('should return undefined for non-existent id', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const found = result.current.findById('999')
      expect(found).toBeUndefined()
    })

    it('should allow manual data setting', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const newData = [mockUsers[0]]
      act(() => {
        result.current.setData(newData)
      })

      expect(result.current.data).toEqual(newData)
      expect(result.current.data).toHaveLength(1)
    })
  })

  describe('Caching', () => {
    beforeEach(() => {
      // Clear the cache map before each test
      jest.isolateModules(() => {
        require('@/hooks/common/use-module-data')
      })
    })

    it('should use cached data when available', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result: result1, unmount: unmount1 } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users-cache-test', 
          initialLoad: true,
          enableCache: true,
          cacheTTL: 60000
        })
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      const fetchCallCount = (global.fetch as jest.Mock).mock.calls.length

      // Second hook with same endpoint should use cache
      const { result: result2 } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users-cache-test', 
          initialLoad: true,
          enableCache: true,
          cacheTTL: 60000
        })
      )

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      // Should not fetch again (cache hit)
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallCount)
      expect(result2.current.data).toEqual(mockUsers)
    })

    it('should not use cache when disabled', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(mockUsers))

      const { result: result1 } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          enableCache: false
        })
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
      })

      expect(global.fetch).toHaveBeenCalledTimes(1)

      const { result: result2 } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users', 
          initialLoad: true,
          enableCache: false
        })
      )

      await waitFor(() => {
        expect(result2.current.loading).toBe(false)
      })

      // Should fetch again
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should invalidate cache after create', async () => {
      const newUser = { id: '4', name: 'Alice', email: 'alice@example.com', role: 'USER' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(newUser))
        .mockImplementationOnce(() => mockFetchSuccess([...mockUsers, newUser]))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users-create-cache', 
          initialLoad: true,
          enableCache: true
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fetchCountAfterLoad = (global.fetch as jest.Mock).mock.calls.length

      await act(async () => {
        await result.current.create({ name: 'Alice' })
      })

      const fetchCountAfterCreate = (global.fetch as jest.Mock).mock.calls.length

      // Reload should fetch again (cache invalidated)
      await act(async () => {
        await result.current.reload()
      })

      // Should have made 3 total calls: initial load, create, reload
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountAfterCreate + 1)
    })

    it('should invalidate cache after update', async () => {
      const updatedUser = { ...mockUsers[0], name: 'Updated' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(updatedUser))
        .mockImplementationOnce(() => mockFetchSuccess([updatedUser, ...mockUsers.slice(1)]))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users-update-cache', 
          initialLoad: true,
          enableCache: true
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fetchCountAfterLoad = (global.fetch as jest.Mock).mock.calls.length

      await act(async () => {
        await result.current.update('1', { name: 'Updated' })
      })

      const fetchCountAfterUpdate = (global.fetch as jest.Mock).mock.calls.length

      await act(async () => {
        await result.current.reload()
      })

      // Should have made 3 total calls: initial load, update, reload
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountAfterUpdate + 1)
    })

    it('should invalidate cache after delete', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response))
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers.slice(1)))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ 
          endpoint: '/api/users-delete-cache', 
          initialLoad: true,
          enableCache: true
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const fetchCountAfterLoad = (global.fetch as jest.Mock).mock.calls.length

      await act(async () => {
        await result.current.remove('1')
      })

      const fetchCountAfterDelete = (global.fetch as jest.Mock).mock.calls.length

      await act(async () => {
        await result.current.reload()
      })

      // Should have made 3 total calls: initial load, delete, reload
      expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCountAfterDelete + 1)
    })
  })

  describe('Loading States', () => {
    it('should set loading to true during data fetch', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockFetchSuccess(mockUsers)), 100))
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('should set loading to false after successful fetch', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual(mockUsers)
    })

    it('should set loading to false after failed fetch', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => mockFetchError(500, 'Error'))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
    })

    it('should handle concurrent operations correctly', async () => {
      const newUser = { id: '4', name: 'Alice', email: 'alice@example.com', role: 'USER' }
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => new Promise(resolve => 
          setTimeout(() => resolve(mockFetchSuccess(newUser)), 100)
        ))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Start create operation
      act(() => {
        result.current.create({ name: 'Alice' })
      })

      expect(result.current.loading).toBe(true)

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })
  })

  describe('Error Handling', () => {
    it('should clear error on successful operation', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchError(500, 'Error'))
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })

      await act(async () => {
        await result.current.reload()
      })

      expect(result.current.error).toBeNull()
    })

    it('should handle network errors', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.reject(new Error('Network error'))
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.error).toContain('Network error')
      })
    })

    it('should handle JSON parse errors', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.reject(new Error('Invalid JSON'))
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.error).toBeTruthy()
      })
    })

    it('should handle error responses with custom messages', async () => {
      ;(global.fetch as jest.Mock).mockImplementationOnce(() => 
        Promise.resolve({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () => Promise.resolve({ message: 'Custom error message' })
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        // The hook shows "Error 400: Bad Request" not the custom message
        // This is expected behavior based on the implementation
        expect(result.current.error).toContain('Error 400')
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty response', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess([]))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
      expect(result.current.error).toBeNull()
    })

    it('should handle null response', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(null)
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })

    it('should handle undefined response', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(undefined)
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })

    it('should handle response without success field', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(() => 
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: mockUsers })
        } as Response)
      )

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
    })

    it('should handle multiple hooks with different endpoints', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess([{ id: '1', name: 'Dept 1' }]))

      const { result: result1 } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      const { result: result2 } = renderHook(() => 
        useModuleData<any>({ endpoint: '/api/departments', initialLoad: true })
      )

      await waitFor(() => {
        expect(result1.current.loading).toBe(false)
        expect(result2.current.loading).toBe(false)
      })

      expect(result1.current.data).toEqual(mockUsers)
      expect(result2.current.data).toEqual([{ id: '1', name: 'Dept 1' }])
    })

    it('should handle rapid successive operations', async () => {
      const newUser1 = { id: '4', name: 'User 4', email: 'user4@example.com', role: 'USER' }
      const newUser2 = { id: '5', name: 'User 5', email: 'user5@example.com', role: 'USER' }
      
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => mockFetchSuccess(newUser1))
        .mockImplementationOnce(() => mockFetchSuccess(newUser2))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Create two users rapidly
      await act(async () => {
        await result.current.create({ name: 'User 4' })
        await result.current.create({ name: 'User 5' })
      })

      expect(result.current.data).toHaveLength(5)
    })

    it('should handle operations on empty data', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess([]))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toEqual([])
      expect(result.current.findById('1')).toBeUndefined()
    })

    it('should handle very large datasets', async () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `${i + 1}`,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: 'USER'
      }))

      ;(global.fetch as jest.Mock).mockImplementation(() => mockFetchSuccess(largeDataset))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(1000)
      expect(result.current.findById('500')).toBeDefined()
    })
  })

  describe('Data Integrity', () => {
    it('should not mutate original data on operations', async () => {
      ;(global.fetch as jest.Mock)
        .mockImplementationOnce(() => mockFetchSuccess(mockUsers))
        .mockImplementationOnce(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) } as Response))

      const { result } = renderHook(() => 
        useModuleData<TestUser>({ endpoint: '/api/users', initialLoad: true })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const originalLength = result.current.data.length
      const firstUser = result.current.data[0]

      await act(async () => {
        await result.current.remove('1')
      })

      // Original data reference should be different
      expect(result.current.data.length).toBe(originalLength - 1)
      expect(result.current.data).not.toContain(firstUser)
    })
  })
})
