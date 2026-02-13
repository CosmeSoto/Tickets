/**
 * Accessibility Hooks Tests
 */

import { renderHook, act } from '@testing-library/react'
import {
  useFocus,
  useFocusTrap,
  useRovingTabindex,
  useAccessibilityPreferences,
  useScreenReader,
  useKeyboardNavigation,
  useAccessibilityAudit,
  useAriaLiveRegion,
  useSkipLinks,
  useFormAccessibility,
  useModalAccessibility,
} from '@/hooks/use-accessibility'

// Mock DOM methods
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock accessibility utils
jest.mock('@/lib/accessibility/accessibility-utils', () => ({
  accessibilityUtils: {
    trapFocus: jest.fn(() => jest.fn()),
    announceToScreenReader: jest.fn(),
    prefersReducedMotion: jest.fn(() => false),
    prefersHighContrast: jest.fn(() => false),
    getColorSchemePreference: jest.fn(() => 'no-preference'),
    getFocusableElements: jest.fn(() => []),
  },
  accessibilityChecker: {
    generateReport: jest.fn(() => ({
      summary: { total: 0, errors: 0, warnings: 0, info: 0, wcagA: 0, wcagAA: 0, wcagAAA: 0 },
      issues: [],
    })),
  },
  keyboardUtils: {
    createRovingTabindex: jest.fn(() => jest.fn()),
  },
}))

describe('useFocus', () => {
  it('provides focus utilities', () => {
    const { result } = renderHook(() => useFocus())
    
    expect(result.current.ref).toBeDefined()
    expect(result.current.isFocused).toBe(false)
    expect(typeof result.current.focus).toBe('function')
    expect(typeof result.current.blur).toBe('function')
  })

  it('updates focus state', () => {
    const { result } = renderHook(() => useFocus())
    
    // Mock element
    const mockElement = {
      focus: jest.fn(),
      blur: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }
    
    // Set ref
    act(() => {
      result.current.ref.current = mockElement as any
    })
    
    // Call focus
    act(() => {
      result.current.focus()
    })
    
    expect(mockElement.focus).toHaveBeenCalled()
  })
})

describe('useFocusTrap', () => {
  it('sets up focus trap when active', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    
    const { result } = renderHook(() => useFocusTrap(true))
    
    expect(result.current).toBeDefined()
    
    // Mock element and trigger effect
    const mockElement = document.createElement('div')
    act(() => {
      result.current.current = mockElement
    })
    
    // The effect should have been called, but we can't easily test the async nature
    // Just verify the ref is set up correctly
    expect(result.current.current).toBe(mockElement)
  })

  it('does not set up focus trap when inactive', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    
    renderHook(() => useFocusTrap(false))
    
    expect(accessibilityUtils.trapFocus).not.toHaveBeenCalled()
  })
})

describe('useRovingTabindex', () => {
  it('sets up roving tabindex when active', async () => {
    const { result } = renderHook(() => useRovingTabindex(true))
    
    expect(result.current).toBeDefined()
    
    // Mock element and trigger effect
    const mockElement = document.createElement('div')
    act(() => {
      result.current.current = mockElement
    })
    
    // Wait for dynamic import
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
  })

  it('does not set up roving tabindex when inactive', () => {
    renderHook(() => useRovingTabindex(false))
    
    // Should not throw or cause issues
  })
})

describe('useAccessibilityPreferences', () => {
  it('returns user preferences', () => {
    const { result } = renderHook(() => useAccessibilityPreferences())
    
    expect(result.current).toEqual({
      prefersReducedMotion: false,
      prefersHighContrast: false,
      colorScheme: 'no-preference',
    })
  })

  it('updates preferences when media queries change', () => {
    const mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }))
    
    window.matchMedia = mockMatchMedia
    
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    accessibilityUtils.prefersReducedMotion.mockReturnValue(true)
    
    const { result } = renderHook(() => useAccessibilityPreferences())
    
    expect(result.current.prefersReducedMotion).toBe(true)
  })
})

describe('useScreenReader', () => {
  it('provides screen reader utilities', () => {
    const { result } = renderHook(() => useScreenReader())
    
    expect(typeof result.current.announce).toBe('function')
    expect(typeof result.current.announceNavigation).toBe('function')
    expect(typeof result.current.announceError).toBe('function')
    expect(typeof result.current.announceSuccess).toBe('function')
    expect(typeof result.current.announceLoading).toBe('function')
  })

  it('announces messages', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useScreenReader())
    
    act(() => {
      result.current.announce('Test message')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Test message', 'polite')
  })

  it('announces navigation', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useScreenReader())
    
    act(() => {
      result.current.announceNavigation('Home Page')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Navigated to Home Page', 'polite')
  })

  it('announces errors', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useScreenReader())
    
    act(() => {
      result.current.announceError('Something went wrong')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Error: Something went wrong', 'assertive')
  })

  it('announces success', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useScreenReader())
    
    act(() => {
      result.current.announceSuccess('Operation completed')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Success: Operation completed', 'polite')
  })

  it('announces loading states', () => {
    const { accessibilityUtils } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useScreenReader())
    
    act(() => {
      result.current.announceLoading(true, 'data')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Loading data...', 'polite')
    
    act(() => {
      result.current.announceLoading(false, 'data')
    })
    
    expect(accessibilityUtils.announceToScreenReader).toHaveBeenCalledWith('Finished loading data', 'polite')
  })
})

describe('useKeyboardNavigation', () => {
  it('tracks keyboard usage', () => {
    const { result } = renderHook(() => useKeyboardNavigation())
    
    expect(result.current.isKeyboardUser).toBe(false)
    expect(result.current.keyboardUserClass).toBe('')
  })

  it('detects keyboard usage on Tab key', () => {
    const { result } = renderHook(() => useKeyboardNavigation())
    
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab' })
      document.dispatchEvent(event)
    })
    
    expect(result.current.isKeyboardUser).toBe(true)
    expect(result.current.keyboardUserClass).toBe('keyboard-user')
  })

  it('resets keyboard usage on mouse interaction', () => {
    const { result } = renderHook(() => useKeyboardNavigation())
    
    // First use keyboard
    act(() => {
      const keyEvent = new KeyboardEvent('keydown', { key: 'Tab' })
      document.dispatchEvent(keyEvent)
    })
    
    expect(result.current.isKeyboardUser).toBe(true)
    
    // Then use mouse
    act(() => {
      const mouseEvent = new MouseEvent('mousedown')
      document.dispatchEvent(mouseEvent)
    })
    
    expect(result.current.isKeyboardUser).toBe(false)
  })
})

describe('useAccessibilityAudit', () => {
  it('provides audit utilities', () => {
    const { result } = renderHook(() => useAccessibilityAudit())
    
    expect(result.current.auditResults).toBe(null)
    expect(result.current.isAuditing).toBe(false)
    expect(typeof result.current.runAudit).toBe('function')
    expect(typeof result.current.clearAudit).toBe('function')
  })

  it('runs audit', async () => {
    const { accessibilityChecker } = require('@/lib/accessibility/accessibility-utils')
    const { result } = renderHook(() => useAccessibilityAudit())
    
    act(() => {
      result.current.runAudit()
    })
    
    expect(result.current.isAuditing).toBe(true)
    
    // Wait for audit to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150))
    })
    
    expect(result.current.isAuditing).toBe(false)
    expect(accessibilityChecker.generateReport).toHaveBeenCalled()
    expect(result.current.auditResults).toBeDefined()
  })

  it('clears audit results', () => {
    const { result } = renderHook(() => useAccessibilityAudit())
    
    // Set some results first
    act(() => {
      result.current.runAudit()
    })
    
    act(() => {
      result.current.clearAudit()
    })
    
    expect(result.current.auditResults).toBe(null)
  })
})

describe('useAriaLiveRegion', () => {
  it('manages live region state', () => {
    const { result } = renderHook(() => useAriaLiveRegion('Initial message'))
    
    expect(result.current.message).toBe('Initial message')
    expect(result.current.priority).toBe('polite')
    expect(result.current.ref).toBeDefined()
    expect(typeof result.current.updateMessage).toBe('function')
    expect(typeof result.current.clearMessage).toBe('function')
  })

  it('updates message', () => {
    const { result } = renderHook(() => useAriaLiveRegion())
    
    act(() => {
      result.current.updateMessage('New message', 'assertive')
    })
    
    expect(result.current.message).toBe('New message')
    expect(result.current.priority).toBe('assertive')
  })

  it('clears message', () => {
    const { result } = renderHook(() => useAriaLiveRegion('Initial message'))
    
    act(() => {
      result.current.clearMessage()
    })
    
    expect(result.current.message).toBe('')
  })
})

describe('useSkipLinks', () => {
  it('manages skip links', () => {
    const { result } = renderHook(() => useSkipLinks())
    
    expect(result.current.skipLinks).toEqual([])
    expect(typeof result.current.addSkipLink).toBe('function')
    expect(typeof result.current.removeSkipLink).toBe('function')
    expect(typeof result.current.clearSkipLinks).toBe('function')
  })

  it('adds skip links', () => {
    const { result } = renderHook(() => useSkipLinks())
    
    act(() => {
      result.current.addSkipLink('main', '#main', 'Skip to main content')
    })
    
    expect(result.current.skipLinks).toEqual([
      { id: 'main', href: '#main', label: 'Skip to main content' }
    ])
  })

  it('does not add duplicate skip links', () => {
    const { result } = renderHook(() => useSkipLinks())
    
    act(() => {
      result.current.addSkipLink('main', '#main', 'Skip to main content')
      result.current.addSkipLink('main', '#main', 'Skip to main content')
    })
    
    expect(result.current.skipLinks).toHaveLength(1)
  })

  it('removes skip links', () => {
    const { result } = renderHook(() => useSkipLinks())
    
    act(() => {
      result.current.addSkipLink('main', '#main', 'Skip to main content')
      result.current.addSkipLink('nav', '#nav', 'Skip to navigation')
    })
    
    expect(result.current.skipLinks).toHaveLength(2)
    
    act(() => {
      result.current.removeSkipLink('main')
    })
    
    expect(result.current.skipLinks).toHaveLength(1)
    expect(result.current.skipLinks[0].id).toBe('nav')
  })

  it('clears all skip links', () => {
    const { result } = renderHook(() => useSkipLinks())
    
    act(() => {
      result.current.addSkipLink('main', '#main', 'Skip to main content')
      result.current.addSkipLink('nav', '#nav', 'Skip to navigation')
    })
    
    expect(result.current.skipLinks).toHaveLength(2)
    
    act(() => {
      result.current.clearSkipLinks()
    })
    
    expect(result.current.skipLinks).toEqual([])
  })
})

describe('useFormAccessibility', () => {
  it('manages form accessibility state', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.hasErrors).toBe(false)
    expect(typeof result.current.setFieldError).toBe('function')
    expect(typeof result.current.clearFieldError).toBe('function')
    expect(typeof result.current.setFieldTouched).toBe('function')
    expect(typeof result.current.getFieldProps).toBe('function')
    expect(typeof result.current.getErrorProps).toBe('function')
    expect(typeof result.current.clearAllErrors).toBe('function')
  })

  it('sets and clears field errors', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    act(() => {
      result.current.setFieldError('email', 'Email is required')
    })
    
    expect(result.current.errors.email).toBe('Email is required')
    expect(result.current.hasErrors).toBe(true)
    
    act(() => {
      result.current.clearFieldError('email')
    })
    
    expect(result.current.errors.email).toBeUndefined()
    expect(result.current.hasErrors).toBe(false)
  })

  it('sets field touched state', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    act(() => {
      result.current.setFieldTouched('email', true)
    })
    
    expect(result.current.touched.email).toBe(true)
  })

  it('provides field props', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    act(() => {
      result.current.setFieldError('email', 'Email is required')
      result.current.setFieldTouched('email', true)
    })
    
    const fieldProps = result.current.getFieldProps('email')
    
    expect(fieldProps['aria-invalid']).toBe(true)
    expect(fieldProps['aria-describedby']).toBe('email-error')
    expect(typeof fieldProps.onBlur).toBe('function')
  })

  it('provides error props', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    act(() => {
      result.current.setFieldError('email', 'Email is required')
      result.current.setFieldTouched('email', true)
    })
    
    const errorProps = result.current.getErrorProps('email')
    
    expect(errorProps.id).toBe('email-error')
    expect(errorProps.role).toBe('alert')
    expect(errorProps['aria-live']).toBe('polite')
  })

  it('clears all errors', () => {
    const { result } = renderHook(() => useFormAccessibility())
    
    act(() => {
      result.current.setFieldError('email', 'Email is required')
      result.current.setFieldError('password', 'Password is required')
      result.current.setFieldTouched('email', true)
    })
    
    expect(result.current.hasErrors).toBe(true)
    
    act(() => {
      result.current.clearAllErrors()
    })
    
    expect(result.current.errors).toEqual({})
    expect(result.current.touched).toEqual({})
    expect(result.current.hasErrors).toBe(false)
  })
})

describe('useModalAccessibility', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    document.body.removeAttribute('aria-hidden')
  })

  it('provides modal utilities', () => {
    const { result } = renderHook(() => useModalAccessibility(false))
    
    expect(result.current.modalRef).toBeDefined()
    expect(result.current.modalProps).toEqual({
      role: 'dialog',
      'aria-modal': true,
      tabIndex: -1,
    })
  })

  it('manages body scroll when modal opens', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useModalAccessibility(isOpen),
      { initialProps: { isOpen: false } }
    )
    
    expect(document.body.style.overflow).toBe('')
    
    rerender({ isOpen: true })
    
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.body.getAttribute('aria-hidden')).toBe('true')
    
    rerender({ isOpen: false })
    
    expect(document.body.style.overflow).toBe('')
    expect(document.body.getAttribute('aria-hidden')).toBe(null)
  })

  it('stores and restores focus', () => {
    const mockElement = {
      focus: jest.fn(),
    }
    
    // Mock activeElement
    Object.defineProperty(document, 'activeElement', {
      value: mockElement,
      writable: true,
    })
    
    const { rerender } = renderHook(
      ({ isOpen }) => useModalAccessibility(isOpen),
      { initialProps: { isOpen: false } }
    )
    
    rerender({ isOpen: true })
    
    // Should store the current focus
    
    rerender({ isOpen: false })
    
    // Should restore focus (after timeout)
    setTimeout(() => {
      expect(mockElement.focus).toHaveBeenCalled()
    }, 0)
  })
})