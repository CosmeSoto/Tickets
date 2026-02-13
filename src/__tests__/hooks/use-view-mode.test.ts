/**
 * Unit tests for useViewMode hook
 * Tests view mode switching, localStorage persistence, and responsive behavior
 */

import { renderHook, act } from '@testing-library/react'
import { useViewMode, ViewMode } from '@/hooks/common/use-view-mode'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    }
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock window.innerWidth for responsive tests
const setWindowWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width
  })
}

describe('useViewMode', () => {
  beforeEach(() => {
    localStorageMock.clear()
    setWindowWidth(1024) // Desktop by default
  })

  describe('Basic Functionality', () => {
    it('should initialize with default mode', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      expect(result.current.viewMode).toBe('cards')
    })

    it('should initialize with list mode when no default provided', () => {
      const { result } = renderHook(() => useViewMode())
      expect(result.current.viewMode).toBe('list')
    })

    it('should change view mode', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      
      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })

    it('should change to table mode', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      
      act(() => {
        result.current.setViewMode('table')
      })

      expect(result.current.viewMode).toBe('table')
    })

    it('should return available modes', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      expect(result.current.availableModes).toEqual(['cards', 'list', 'table'])
    })
  })

  describe('localStorage Persistence', () => {
    it('should persist view mode to localStorage', () => {
      const { result } = renderHook(() => useViewMode('cards', {
        storageKey: 'test-view-mode'
      }))
      
      act(() => {
        result.current.setViewMode('list')
      })

      expect(localStorageMock.getItem('test-view-mode')).toBe('list')
    })

    it('should load view mode from localStorage', () => {
      localStorageMock.setItem('test-view-mode', 'table')
      
      const { result } = renderHook(() => useViewMode('cards', {
        storageKey: 'test-view-mode'
      }))

      expect(result.current.viewMode).toBe('table')
    })

    it('should use default mode if localStorage is empty', () => {
      const { result } = renderHook(() => useViewMode('cards', {
        storageKey: 'empty-key'
      }))

      expect(result.current.viewMode).toBe('cards')
    })

    it('should use default storage key when not provided', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      
      act(() => {
        result.current.setViewMode('list')
      })

      expect(localStorageMock.getItem('view-mode')).toBe('list')
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Mock localStorage.setItem to throw error
      const originalSetItem = localStorageMock.setItem
      localStorageMock.setItem = () => {
        throw new Error('Storage quota exceeded')
      }

      const { result } = renderHook(() => useViewMode('cards'))
      
      act(() => {
        result.current.setViewMode('list')
      })

      expect(consoleErrorSpy).toHaveBeenCalled()
      
      // Restore
      localStorageMock.setItem = originalSetItem
      consoleErrorSpy.mockRestore()
    })
  })

  describe('Available Modes Configuration', () => {
    it('should respect custom available modes', () => {
      const { result } = renderHook(() => useViewMode('cards', {
        availableModes: ['cards', 'list']
      }))

      expect(result.current.availableModes).toEqual(['cards', 'list'])
    })

    it('should warn when setting unavailable mode', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      const { result } = renderHook(() => useViewMode('cards', {
        availableModes: ['cards', 'list']
      }))
      
      act(() => {
        result.current.setViewMode('table')
      })

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Mode "table" is not available'),
        ['cards', 'list']
      )
      expect(result.current.viewMode).toBe('cards') // Should not change

      consoleWarnSpy.mockRestore()
    })

    it('should not persist unavailable mode', () => {
      const { result } = renderHook(() => useViewMode('cards', {
        availableModes: ['cards', 'list'],
        storageKey: 'test-key'
      }))
      
      act(() => {
        result.current.setViewMode('table' as ViewMode)
      })

      expect(localStorageMock.getItem('test-key')).toBeNull()
    })

    it('should ignore invalid mode from localStorage', () => {
      localStorageMock.setItem('test-key', 'invalid-mode')
      
      const { result } = renderHook(() => useViewMode('cards', {
        availableModes: ['cards', 'list'],
        storageKey: 'test-key'
      }))

      expect(result.current.viewMode).toBe('cards') // Should use default
    })
  })

  describe('Responsive Behavior', () => {
    it('should detect mobile viewport', () => {
      setWindowWidth(500) // Mobile width
      
      const { result } = renderHook(() => useViewMode('cards'))
      
      // Trigger resize event
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.isMobile).toBe(true)
    })

    it('should detect desktop viewport', () => {
      setWindowWidth(1024) // Desktop width
      
      const { result } = renderHook(() => useViewMode('cards'))
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.isMobile).toBe(false)
    })

    it('should auto-switch to mobile mode on mobile viewport', () => {
      setWindowWidth(500) // Mobile width
      
      const { result } = renderHook(() => useViewMode('cards', {
        responsive: true,
        mobileMode: 'list'
      }))
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.viewMode).toBe('list')
    })

    it('should not auto-switch when responsive is false', () => {
      setWindowWidth(500) // Mobile width
      
      const { result } = renderHook(() => useViewMode('cards', {
        responsive: false
      }))
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.viewMode).toBe('cards')
    })

    it('should use custom mobile mode', () => {
      setWindowWidth(500) // Mobile width
      
      const { result } = renderHook(() => useViewMode('cards', {
        responsive: true,
        mobileMode: 'table'
      }))
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.viewMode).toBe('table')
    })

    it('should switch back to desktop mode when resizing', () => {
      setWindowWidth(500) // Start mobile
      
      const { result } = renderHook(() => useViewMode('cards', {
        responsive: true
      }))
      
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.viewMode).toBe('list') // Mobile mode

      // Resize to desktop
      setWindowWidth(1024)
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })

      expect(result.current.viewMode).toBe('cards') // Back to original
    })

    it('should handle window resize events', () => {
      const { result } = renderHook(() => useViewMode('cards'))
      
      setWindowWidth(500)
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.isMobile).toBe(true)

      setWindowWidth(1024)
      act(() => {
        window.dispatchEvent(new Event('resize'))
      })
      expect(result.current.isMobile).toBe(false)
    })
  })

  describe('Edge Cases', () => {
    it('should handle SSR (no window)', () => {
      const originalWindow = global.window
      // @ts-ignore
      delete global.window

      const { result } = renderHook(() => useViewMode('cards'))
      expect(result.current.viewMode).toBe('cards')

      // Restore
      global.window = originalWindow
    })

    it('should handle multiple instances with different storage keys', () => {
      const { result: result1 } = renderHook(() => useViewMode('cards', {
        storageKey: 'view-1'
      }))
      
      const { result: result2 } = renderHook(() => useViewMode('list', {
        storageKey: 'view-2'
      }))

      act(() => {
        result1.current.setViewMode('table')
      })

      act(() => {
        result2.current.setViewMode('cards')
      })

      expect(result1.current.viewMode).toBe('table')
      expect(result2.current.viewMode).toBe('cards')
      expect(localStorageMock.getItem('view-1')).toBe('table')
      expect(localStorageMock.getItem('view-2')).toBe('cards')
    })

    it('should handle tree view mode', () => {
      const { result } = renderHook(() => useViewMode('tree', {
        availableModes: ['cards', 'list', 'tree']
      }))

      expect(result.current.viewMode).toBe('tree')
      
      act(() => {
        result.current.setViewMode('list')
      })

      expect(result.current.viewMode).toBe('list')
    })
  })

  describe('Persistence Across Remounts', () => {
    it('should persist mode across hook remounts', () => {
      const { result, unmount } = renderHook(() => useViewMode('cards', {
        storageKey: 'persist-test'
      }))
      
      act(() => {
        result.current.setViewMode('table')
      })

      unmount()

      // Remount
      const { result: result2 } = renderHook(() => useViewMode('cards', {
        storageKey: 'persist-test'
      }))

      expect(result2.current.viewMode).toBe('table')
    })
  })

  describe('Cleanup', () => {
    it('should cleanup resize listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')
      
      const { unmount } = renderHook(() => useViewMode('cards'))
      
      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      
      removeEventListenerSpy.mockRestore()
    })
  })
})
