/**
 * Accessibility Hooks
 * Custom hooks for accessibility features and user preferences
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { accessibilityUtils, accessibilityChecker } from '@/lib/accessibility/accessibility-utils'

/**
 * Hook for managing focus
 */
export const useFocus = () => {
  const [isFocused, setIsFocused] = useState(false)
  const elementRef = useRef<HTMLElement>(null)

  const focus = useCallback(() => {
    elementRef.current?.focus()
  }, [])

  const blur = useCallback(() => {
    elementRef.current?.blur()
  }, [])

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const handleFocus = () => setIsFocused(true)
    const handleBlur = () => setIsFocused(false)

    element.addEventListener('focus', handleFocus)
    element.addEventListener('blur', handleBlur)

    return () => {
      element.removeEventListener('focus', handleFocus)
      element.removeEventListener('blur', handleBlur)
    }
  }, [])

  return {
    ref: elementRef,
    isFocused,
    focus,
    blur,
  }
}

/**
 * Hook for managing focus trap
 */
export const useFocusTrap = (isActive: boolean = true) => {
  const containerRef = useRef<HTMLElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    cleanupRef.current = accessibilityUtils.trapFocus(containerRef.current)

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [isActive])

  return containerRef
}

/**
 * Hook for managing roving tabindex
 */
export const useRovingTabindex = (isActive: boolean = true) => {
  const containerRef = useRef<HTMLElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Import keyboardUtils dynamically to avoid circular dependency
    import('@/lib/accessibility/accessibility-utils').then(({ keyboardUtils }) => {
      if (containerRef.current) {
        cleanupRef.current = keyboardUtils.createRovingTabindex(containerRef.current)
      }
    })

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [isActive])

  return containerRef
}

/**
 * Hook for user accessibility preferences
 */
export const useAccessibilityPreferences = () => {
  const [preferences, setPreferences] = useState({
    prefersReducedMotion: false,
    prefersHighContrast: false,
    colorScheme: 'no-preference' as 'light' | 'dark' | 'no-preference',
  })

  useEffect(() => {
    const updatePreferences = () => {
      setPreferences({
        prefersReducedMotion: accessibilityUtils.prefersReducedMotion(),
        prefersHighContrast: accessibilityUtils.prefersHighContrast(),
        colorScheme: accessibilityUtils.getColorSchemePreference(),
      })
    }

    // Initial check
    updatePreferences()

    // Listen for changes
    const mediaQueries = [
      window.matchMedia('(prefers-reduced-motion: reduce)'),
      window.matchMedia('(prefers-contrast: high)'),
      window.matchMedia('(prefers-color-scheme: dark)'),
      window.matchMedia('(prefers-color-scheme: light)'),
    ]

    mediaQueries.forEach(mq => {
      mq.addEventListener('change', updatePreferences)
    })

    return () => {
      mediaQueries.forEach(mq => {
        mq.removeEventListener('change', updatePreferences)
      })
    }
  }, [])

  return preferences
}

/**
 * Hook for screen reader announcements
 */
export const useScreenReader = () => {
  const announce = useCallback((
    message: string,
    priority: 'polite' | 'assertive' = 'polite'
  ) => {
    accessibilityUtils.announceToScreenReader(message, priority)
  }, [])

  const announceNavigation = useCallback((pageName: string) => {
    announce(`Navigated to ${pageName}`, 'polite')
  }, [announce])

  const announceError = useCallback((error: string) => {
    announce(`Error: ${error}`, 'assertive')
  }, [announce])

  const announceSuccess = useCallback((message: string) => {
    announce(`Success: ${message}`, 'polite')
  }, [announce])

  const announceLoading = useCallback((isLoading: boolean, context?: string) => {
    const message = isLoading 
      ? `Loading${context ? ` ${context}` : ''}...`
      : `Finished loading${context ? ` ${context}` : ''}`
    announce(message, 'polite')
  }, [announce])

  return {
    announce,
    announceNavigation,
    announceError,
    announceSuccess,
    announceLoading,
  }
}

/**
 * Hook for keyboard navigation
 */
export const useKeyboardNavigation = () => {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false)

  useEffect(() => {
    let keyboardUsed = false

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        keyboardUsed = true
        setIsKeyboardUser(true)
      }
    }

    const handleMouseDown = () => {
      if (keyboardUsed) {
        keyboardUsed = false
        setIsKeyboardUser(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  return {
    isKeyboardUser,
    // Add keyboard-user class to body for CSS styling
    keyboardUserClass: isKeyboardUser ? 'keyboard-user' : '',
  }
}

/**
 * Hook for accessibility audit
 */
export const useAccessibilityAudit = () => {
  const [auditResults, setAuditResults] = useState<ReturnType<typeof accessibilityChecker.generateReport> | null>(null)
  const [isAuditing, setIsAuditing] = useState(false)

  const runAudit = useCallback(async () => {
    setIsAuditing(true)
    
    // Run audit after a short delay to ensure DOM is ready
    setTimeout(() => {
      const results = accessibilityChecker.generateReport()
      setAuditResults(results)
      setIsAuditing(false)
    }, 100)
  }, [])

  const clearAudit = useCallback(() => {
    setAuditResults(null)
  }, [])

  return {
    auditResults,
    isAuditing,
    runAudit,
    clearAudit,
  }
}

/**
 * Hook for managing ARIA live regions
 */
export const useAriaLiveRegion = (initialMessage: string = '') => {
  const [message, setMessage] = useState(initialMessage)
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite')
  const regionRef = useRef<HTMLDivElement>(null)

  const updateMessage = useCallback((
    newMessage: string,
    newPriority: 'polite' | 'assertive' = 'polite'
  ) => {
    setMessage(newMessage)
    setPriority(newPriority)
  }, [])

  const clearMessage = useCallback(() => {
    setMessage('')
  }, [])

  // Create the live region element
  useEffect(() => {
    const region = regionRef.current
    if (!region) return

    region.setAttribute('aria-live', priority)
    region.setAttribute('aria-atomic', 'true')
    region.className = 'sr-only'
    region.textContent = message
  }, [message, priority])

  return {
    ref: regionRef,
    message,
    priority,
    updateMessage,
    clearMessage,
  }
}

/**
 * Hook for managing skip links
 */
export const useSkipLinks = () => {
  const [skipLinks, setSkipLinks] = useState<Array<{
    id: string
    href: string
    label: string
  }>>([])

  const addSkipLink = useCallback((id: string, href: string, label: string) => {
    setSkipLinks(prev => {
      const exists = prev.find(link => link.id === id)
      if (exists) return prev
      
      return [...prev, { id, href, label }]
    })
  }, [])

  const removeSkipLink = useCallback((id: string) => {
    setSkipLinks(prev => prev.filter(link => link.id !== id))
  }, [])

  const clearSkipLinks = useCallback(() => {
    setSkipLinks([])
  }, [])

  return {
    skipLinks,
    addSkipLink,
    removeSkipLink,
    clearSkipLinks,
  }
}

/**
 * Hook for managing form accessibility
 */
export const useFormAccessibility = () => {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }))
  }, [])

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[fieldName]
      return newErrors
    })
  }, [])

  const setFieldTouched = useCallback((fieldName: string, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [fieldName]: isTouched }))
  }, [])

  const getFieldProps = useCallback((fieldName: string) => {
    const hasError = errors[fieldName] && touched[fieldName]
    const errorId = hasError ? `${fieldName}-error` : undefined

    return {
      'aria-invalid': hasError,
      'aria-describedby': errorId,
      onBlur: () => setFieldTouched(fieldName, true),
    }
  }, [errors, touched, setFieldTouched])

  const getErrorProps = useCallback((fieldName: string) => {
    const hasError = errors[fieldName] && touched[fieldName]
    
    return hasError ? {
      id: `${fieldName}-error`,
      role: 'alert' as const,
      'aria-live': 'polite' as const,
    } : {}
  }, [errors, touched])

  const clearAllErrors = useCallback(() => {
    setErrors({})
    setTouched({})
  }, [])

  return {
    errors,
    touched,
    setFieldError,
    clearFieldError,
    setFieldTouched,
    getFieldProps,
    getErrorProps,
    clearAllErrors,
    hasErrors: Object.keys(errors).length > 0,
  }
}

/**
 * Hook for managing modal accessibility
 */
export const useModalAccessibility = (isOpen: boolean) => {
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const modalRef = useRef<HTMLElement>(null)

  // Store previous focus and restore on close
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      
      // Focus the modal after a short delay
      setTimeout(() => {
        const modal = modalRef.current
        if (modal) {
          const focusableElement = accessibilityUtils.getFocusableElements(modal)[0] as HTMLElement
          focusableElement?.focus()
        }
      }, 100)
    } else {
      // Restore focus when modal closes
      previousFocusRef.current?.focus()
    }
  }, [isOpen])

  // Prevent body scroll and manage aria-hidden
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.body.setAttribute('aria-hidden', 'true')
    } else {
      document.body.style.overflow = ''
      document.body.removeAttribute('aria-hidden')
    }

    return () => {
      document.body.style.overflow = ''
      document.body.removeAttribute('aria-hidden')
    }
  }, [isOpen])

  return {
    modalRef,
    modalProps: {
      role: 'dialog' as const,
      'aria-modal': true,
      tabIndex: -1,
    },
  }
}