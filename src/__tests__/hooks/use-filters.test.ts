/**
 * Unit tests for useFilters hook
 * Tests all filter types: search, select, multiselect, checkbox, range, daterange
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useFilters, FilterConfig } from '@/hooks/common/use-filters'

// Mock data for testing
interface TestUser {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  age: number
  createdAt: string
}

const mockUsers: TestUser[] = [
  {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'ADMIN',
    isActive: true,
    age: 30,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'USER',
    isActive: true,
    age: 25,
    createdAt: '2024-01-15T00:00:00Z'
  },
  {
    id: '3',
    name: 'Bob Johnson',
    email: 'bob@example.com',
    role: 'USER',
    isActive: false,
    age: 35,
    createdAt: '2024-02-01T00:00:00Z'
  },
  {
    id: '4',
    name: 'Alice Williams',
    email: 'alice@example.com',
    role: 'ADMIN',
    isActive: true,
    age: 28,
    createdAt: '2024-02-15T00:00:00Z'
  }
]

describe('useFilters', () => {
  describe('Search Filter', () => {
    const searchConfig: FilterConfig<TestUser>[] = [
      {
        id: 'search',
        type: 'search',
        searchFields: ['name', 'email'],
        placeholder: 'Search users...'
      }
    ]

    it('should return all data when search is empty', () => {
      const { result } = renderHook(() => useFilters(mockUsers, searchConfig))
      expect(result.current.filteredData).toHaveLength(4)
    })

    it('should filter by name (case-insensitive)', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, searchConfig, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(2) // John Doe and Bob Johnson
      })
    })

    it('should filter by email', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, searchConfig, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'jane@')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(1)
        expect(result.current.filteredData[0].name).toBe('Jane Smith')
      })
    })

    it('should be case-insensitive', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, searchConfig, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'JOHN')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(2)
      })
    })

    it('should debounce search input', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, searchConfig, { debounceMs: 100 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
      })

      // Immediately after setting, should still show all data (debounced)
      expect(result.current.filteredData).toHaveLength(4)

      // After debounce delay, should show filtered data
      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(2)
      }, { timeout: 200 })
    })
  })

  describe('Select Filter', () => {
    const selectConfig: FilterConfig<TestUser>[] = [
      {
        id: 'role',
        type: 'select',
        field: 'role',
        options: [
          { value: 'all', label: 'All' },
          { value: 'ADMIN', label: 'Admin' },
          { value: 'USER', label: 'User' }
        ],
        defaultValue: 'all'
      }
    ]

    it('should return all data when filter is "all"', () => {
      const { result } = renderHook(() => useFilters(mockUsers, selectConfig))
      expect(result.current.filteredData).toHaveLength(4)
    })

    it('should filter by role ADMIN', () => {
      const { result } = renderHook(() => useFilters(mockUsers, selectConfig))
      
      act(() => {
        result.current.setFilter('role', 'ADMIN')
      })

      expect(result.current.filteredData).toHaveLength(2)
      expect(result.current.filteredData.every(u => u.role === 'ADMIN')).toBe(true)
    })

    it('should filter by role USER', () => {
      const { result } = renderHook(() => useFilters(mockUsers, selectConfig))
      
      act(() => {
        result.current.setFilter('role', 'USER')
      })

      expect(result.current.filteredData).toHaveLength(2)
      expect(result.current.filteredData.every(u => u.role === 'USER')).toBe(true)
    })
  })

  describe('Checkbox Filter', () => {
    const checkboxConfig: FilterConfig<TestUser>[] = [
      {
        id: 'active',
        type: 'checkbox',
        field: 'isActive',
        label: 'Active only',
        defaultValue: false
      }
    ]

    it('should return all data when checkbox is false', () => {
      const { result } = renderHook(() => useFilters(mockUsers, checkboxConfig))
      expect(result.current.filteredData).toHaveLength(4)
    })

    it('should filter active users when checkbox is true', () => {
      const { result } = renderHook(() => useFilters(mockUsers, checkboxConfig))
      
      act(() => {
        result.current.setFilter('active', true)
      })

      expect(result.current.filteredData).toHaveLength(3)
      expect(result.current.filteredData.every(u => u.isActive === true)).toBe(true)
    })
  })

  describe('Range Filter', () => {
    const rangeConfig: FilterConfig<TestUser>[] = [
      {
        id: 'ageRange',
        type: 'range',
        field: 'age',
        label: 'Age range',
        min: 0,
        max: 100
      }
    ]

    it('should filter by age range', () => {
      const { result } = renderHook(() => useFilters(mockUsers, rangeConfig))
      
      act(() => {
        result.current.setFilter('ageRange', [25, 30])
      })

      expect(result.current.filteredData).toHaveLength(3) // Jane (25), Alice (28), John (30)
      expect(result.current.filteredData.every(u => u.age >= 25 && u.age <= 30)).toBe(true)
    })

    it('should handle edge values', () => {
      const { result } = renderHook(() => useFilters(mockUsers, rangeConfig))
      
      act(() => {
        result.current.setFilter('ageRange', [30, 30])
      })

      expect(result.current.filteredData).toHaveLength(1)
      expect(result.current.filteredData[0].age).toBe(30)
    })
  })

  describe('Date Range Filter', () => {
    const dateRangeConfig: FilterConfig<TestUser>[] = [
      {
        id: 'dateRange',
        type: 'daterange',
        field: 'createdAt',
        label: 'Created date range'
      }
    ]

    it('should filter by date range', () => {
      const { result } = renderHook(() => useFilters(mockUsers, dateRangeConfig))
      
      const startDate = new Date('2024-01-01')
      const endDate = new Date('2024-01-31')
      
      act(() => {
        result.current.setFilter('dateRange', [startDate, endDate])
      })

      expect(result.current.filteredData).toHaveLength(2) // John and Jane
    })

    it('should include boundary dates', () => {
      const { result } = renderHook(() => useFilters(mockUsers, dateRangeConfig))
      
      const startDate = new Date('2024-01-15')
      const endDate = new Date('2024-01-15')
      
      act(() => {
        result.current.setFilter('dateRange', [startDate, endDate])
      })

      expect(result.current.filteredData).toHaveLength(1)
      expect(result.current.filteredData[0].name).toBe('Jane Smith')
    })
  })

  describe('Multiple Filters', () => {
    const multiConfig: FilterConfig<TestUser>[] = [
      {
        id: 'search',
        type: 'search',
        searchFields: ['name', 'email']
      },
      {
        id: 'role',
        type: 'select',
        field: 'role',
        options: [
          { value: 'all', label: 'All' },
          { value: 'ADMIN', label: 'Admin' }
        ]
      },
      {
        id: 'active',
        type: 'checkbox',
        field: 'isActive'
      }
    ]

    it('should apply multiple filters (AND logic)', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, multiConfig, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('role', 'ADMIN')
        result.current.setFilter('active', true)
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(2) // John and Alice (both ADMIN and active)
      })
    })

    it('should apply search with other filters', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, multiConfig, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
        result.current.setFilter('role', 'ADMIN')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(1)
        expect(result.current.filteredData[0].name).toBe('John Doe')
      })
    })
  })

  describe('Filter Management', () => {
    const config: FilterConfig<TestUser>[] = [
      {
        id: 'search',
        type: 'search',
        searchFields: ['name']
      },
      {
        id: 'role',
        type: 'select',
        field: 'role',
        defaultValue: 'all'
      }
    ]

    it('should clear all filters', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, config, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
        result.current.setFilter('role', 'ADMIN')
      })

      await waitFor(() => {
        expect(result.current.filteredData.length).toBeLessThan(4)
      })

      act(() => {
        result.current.clearFilters()
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(4)
        expect(result.current.filters.search).toBe('')
        expect(result.current.filters.role).toBe('all')
      })
    })

    it('should clear individual filter', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, config, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
        result.current.setFilter('role', 'ADMIN')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(1)
      })

      act(() => {
        result.current.clearFilter('role')
      })

      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(2) // Both Johns
        expect(result.current.filters.role).toBe('all')
        expect(result.current.filters.search).toBe('john')
      })
    })

    it('should count active filters correctly', async () => {
      const { result } = renderHook(() => useFilters(mockUsers, config, { debounceMs: 0 }))
      
      expect(result.current.activeFiltersCount).toBe(0)
      expect(result.current.hasActiveFilters).toBe(false)

      act(() => {
        result.current.setFilter('search', 'john')
      })

      await waitFor(() => {
        expect(result.current.activeFiltersCount).toBe(1)
        expect(result.current.hasActiveFilters).toBe(true)
      })

      act(() => {
        result.current.setFilter('role', 'ADMIN')
      })

      expect(result.current.activeFiltersCount).toBe(2)

      act(() => {
        result.current.clearFilters()
      })

      await waitFor(() => {
        expect(result.current.activeFiltersCount).toBe(0)
        expect(result.current.hasActiveFilters).toBe(false)
      })
    })
  })

  describe('Callbacks', () => {
    const config: FilterConfig<TestUser>[] = [
      {
        id: 'search',
        type: 'search',
        searchFields: ['name']
      }
    ]

    it('should call onFilterChange callback', () => {
      const onFilterChange = jest.fn()
      const { result } = renderHook(() => 
        useFilters(mockUsers, config, { onFilterChange })
      )
      
      act(() => {
        result.current.setFilter('search', 'john')
      })

      expect(onFilterChange).toHaveBeenCalled()
      expect(onFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'john' })
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty data array', () => {
      const config: FilterConfig<TestUser>[] = [
        {
          id: 'search',
          type: 'search',
          searchFields: ['name']
        }
      ]
      
      const { result } = renderHook(() => useFilters([], config))
      expect(result.current.filteredData).toHaveLength(0)
    })

    it('should handle null/undefined field values', async () => {
      const dataWithNulls = [
        { id: '1', name: null, email: 'test@example.com' },
        { id: '2', name: 'John', email: null }
      ] as any

      const config: FilterConfig<any>[] = [
        {
          id: 'search',
          type: 'search',
          searchFields: ['name', 'email']
        }
      ]
      
      const { result } = renderHook(() => useFilters(dataWithNulls, config, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'test@')
      })

      // Should not crash and should find the match in email
      await waitFor(() => {
        expect(result.current.filteredData).toHaveLength(1)
        expect(result.current.filteredData[0].email).toBe('test@example.com')
      })
    })

    it('should handle filter config without searchFields', () => {
      const config: FilterConfig<TestUser>[] = [
        {
          id: 'search',
          type: 'search'
          // No searchFields defined
        }
      ]
      
      const { result } = renderHook(() => useFilters(mockUsers, config, { debounceMs: 0 }))
      
      act(() => {
        result.current.setFilter('search', 'john')
      })

      // Should return all data when searchFields is undefined
      expect(result.current.filteredData).toHaveLength(4)
    })

    it('should handle filter config without field for select', () => {
      const config: FilterConfig<TestUser>[] = [
        {
          id: 'role',
          type: 'select'
          // No field defined
        }
      ]
      
      const { result } = renderHook(() => useFilters(mockUsers, config))
      
      act(() => {
        result.current.setFilter('role', 'ADMIN')
      })

      // Should return all data when field is undefined
      expect(result.current.filteredData).toHaveLength(4)
    })
  })

  describe('Multiselect Filter', () => {
    const multiselectConfig: FilterConfig<TestUser>[] = [
      {
        id: 'roles',
        type: 'multiselect',
        field: 'role',
        options: [
          { value: 'ADMIN', label: 'Admin' },
          { value: 'USER', label: 'User' }
        ]
      }
    ]

    it('should return all data when multiselect is empty', () => {
      const { result } = renderHook(() => useFilters(mockUsers, multiselectConfig))
      expect(result.current.filteredData).toHaveLength(4)
    })

    it('should filter by single selected value', () => {
      const { result } = renderHook(() => useFilters(mockUsers, multiselectConfig))
      
      act(() => {
        result.current.setFilter('roles', ['ADMIN'])
      })

      expect(result.current.filteredData).toHaveLength(2)
      expect(result.current.filteredData.every(u => u.role === 'ADMIN')).toBe(true)
    })

    it('should filter by multiple selected values (OR logic)', () => {
      const { result } = renderHook(() => useFilters(mockUsers, multiselectConfig))
      
      act(() => {
        result.current.setFilter('roles', ['ADMIN', 'USER'])
      })

      expect(result.current.filteredData).toHaveLength(4) // All users
    })
  })
})
