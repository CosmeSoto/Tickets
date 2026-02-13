/**
 * Accessibility Utilities
 * Comprehensive accessibility helpers and utilities
 */

// ARIA role definitions
export const ARIA_ROLES = {
  // Landmark roles
  banner: 'banner',
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
  search: 'search',
  form: 'form',
  
  // Widget roles
  button: 'button',
  checkbox: 'checkbox',
  dialog: 'dialog',
  menubar: 'menubar',
  menu: 'menu',
  menuitem: 'menuitem',
  option: 'option',
  radio: 'radio',
  slider: 'slider',
  spinbutton: 'spinbutton',
  textbox: 'textbox',
  
  // Document structure roles
  article: 'article',
  columnheader: 'columnheader',
  definition: 'definition',
  directory: 'directory',
  document: 'document',
  group: 'group',
  heading: 'heading',
  img: 'img',
  list: 'list',
  listitem: 'listitem',
  math: 'math',
  note: 'note',
  presentation: 'presentation',
  region: 'region',
  separator: 'separator',
  toolbar: 'toolbar',
  
  // Live region roles
  alert: 'alert',
  log: 'log',
  marquee: 'marquee',
  status: 'status',
  timer: 'timer',
} as const

export type AriaRole = typeof ARIA_ROLES[keyof typeof ARIA_ROLES]

// ARIA properties and states
export interface AriaProps {
  // Global ARIA properties
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  'aria-hidden'?: boolean
  'aria-live'?: 'off' | 'polite' | 'assertive'
  'aria-atomic'?: boolean
  'aria-relevant'?: string
  
  // Widget properties
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both'
  'aria-checked'?: boolean | 'mixed'
  'aria-disabled'?: boolean
  'aria-expanded'?: boolean
  'aria-haspopup'?: boolean | 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog'
  'aria-level'?: number
  'aria-multiline'?: boolean
  'aria-multiselectable'?: boolean
  'aria-orientation'?: 'horizontal' | 'vertical'
  'aria-placeholder'?: string
  'aria-pressed'?: boolean | 'mixed'
  'aria-readonly'?: boolean
  'aria-required'?: boolean
  'aria-selected'?: boolean
  'aria-sort'?: 'none' | 'ascending' | 'descending' | 'other'
  'aria-valuemax'?: number
  'aria-valuemin'?: number
  'aria-valuenow'?: number
  'aria-valuetext'?: string
  
  // Relationship properties
  'aria-activedescendant'?: string
  'aria-controls'?: string
  'aria-flowto'?: string
  'aria-owns'?: string
  'aria-posinset'?: number
  'aria-setsize'?: number
}

// Accessibility validation rules
export interface AccessibilityRule {
  name: string
  description: string
  check: (element: Element) => boolean
  fix?: string
  severity: 'error' | 'warning' | 'info'
  wcagLevel: 'A' | 'AA' | 'AAA'
}

export const accessibilityRules: AccessibilityRule[] = [
  {
    name: 'missing-alt-text',
    description: 'Images must have alternative text',
    check: (element) => {
      if (element.tagName === 'IMG') {
        const alt = element.getAttribute('alt')
        return alt === null || alt === ''
      }
      return false
    },
    fix: 'Add descriptive alt attribute to images',
    severity: 'error',
    wcagLevel: 'A',
  },
  
  {
    name: 'missing-form-labels',
    description: 'Form inputs must have associated labels',
    check: (element) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)) {
        const id = element.getAttribute('id')
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledby = element.getAttribute('aria-labelledby')
        
        if (ariaLabel || ariaLabelledby) return false
        
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`)
          return !label
        }
        
        return true
      }
      return false
    },
    fix: 'Add label element or aria-label attribute',
    severity: 'error',
    wcagLevel: 'A',
  },
  
  {
    name: 'insufficient-color-contrast',
    description: 'Text must have sufficient color contrast',
    check: (element) => {
      // This would require color contrast calculation
      // For now, we'll check for common low-contrast patterns
      const style = getComputedStyle(element)
      const color = style.color
      const backgroundColor = style.backgroundColor
      
      // Basic check for light gray on white (common low contrast)
      return (color === 'rgb(204, 204, 204)' && backgroundColor === 'rgb(255, 255, 255)')
    },
    fix: 'Ensure color contrast ratio is at least 4.5:1 for normal text',
    severity: 'error',
    wcagLevel: 'AA',
  },
  
  {
    name: 'missing-focus-indicators',
    description: 'Interactive elements must have visible focus indicators',
    check: (element) => {
      const isInteractive = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) ||
                           element.getAttribute('tabindex') !== null ||
                           element.getAttribute('role') === 'button'
      
      if (isInteractive) {
        const style = getComputedStyle(element, ':focus')
        return style.outline === 'none' && !style.boxShadow.includes('focus')
      }
      return false
    },
    fix: 'Add visible focus indicators using outline or box-shadow',
    severity: 'warning',
    wcagLevel: 'AA',
  },
  
  {
    name: 'missing-heading-structure',
    description: 'Headings must follow proper hierarchical structure',
    check: (element) => {
      if (element.tagName.match(/^H[1-6]$/)) {
        const level = parseInt(element.tagName.charAt(1))
        const prevHeading = element.previousElementSibling
        
        if (prevHeading && prevHeading.tagName.match(/^H[1-6]$/)) {
          const prevLevel = parseInt(prevHeading.tagName.charAt(1))
          return level > prevLevel + 1
        }
      }
      return false
    },
    fix: 'Ensure heading levels follow sequential order (h1, h2, h3, etc.)',
    severity: 'warning',
    wcagLevel: 'AA',
  },
  
  {
    name: 'missing-skip-links',
    description: 'Pages should have skip navigation links',
    check: (element) => {
      if (element === document.body) {
        const skipLink = document.querySelector('a[href^="#"][class*="skip"]')
        return !skipLink
      }
      return false
    },
    fix: 'Add skip navigation links at the beginning of the page',
    severity: 'info',
    wcagLevel: 'A',
  },
  
  {
    name: 'missing-landmark-roles',
    description: 'Page sections should use appropriate landmark roles',
    check: (element) => {
      const isMainContent = element.tagName === 'MAIN' || 
                           element.getAttribute('role') === 'main' ||
                           element.id === 'main-content'
      
      if (isMainContent) return false
      
      // Check if page has main landmark
      const hasMain = document.querySelector('main, [role="main"]')
      return !hasMain && element === document.body
    },
    fix: 'Add main landmark role to primary content area',
    severity: 'warning',
    wcagLevel: 'A',
  },
]

// Accessibility checker class
export class AccessibilityChecker {
  private issues: Array<{
    element: Element
    rule: AccessibilityRule
    location: string
  }> = []

  /**
   * Audit the current page for accessibility issues
   */
  auditPage(): Array<{
    element: Element
    rule: AccessibilityRule
    location: string
  }> {
    this.issues = []
    
    // Get all elements
    const elements = document.querySelectorAll('*')
    
    elements.forEach((element, index) => {
      accessibilityRules.forEach(rule => {
        if (rule.check(element)) {
          this.issues.push({
            element,
            rule,
            location: this.getElementLocation(element, index),
          })
        }
      })
    })
    
    return this.issues
  }

  /**
   * Get a human-readable location for an element
   */
  private getElementLocation(element: Element, index: number): string {
    const tagName = element.tagName.toLowerCase()
    const id = element.id ? `#${element.id}` : ''
    const classes = element.className ? `.${element.className.split(' ')[0]}` : ''
    
    return `${tagName}${id}${classes} (element ${index})`
  }

  /**
   * Generate accessibility report
   */
  generateReport(): {
    summary: {
      total: number
      errors: number
      warnings: number
      info: number
      wcagA: number
      wcagAA: number
      wcagAAA: number
    }
    issues: Array<{
      severity: string
      wcagLevel: string
      rule: string
      description: string
      location: string
      fix?: string
    }>
  } {
    const issues = this.auditPage()
    
    const summary = {
      total: issues.length,
      errors: issues.filter(i => i.rule.severity === 'error').length,
      warnings: issues.filter(i => i.rule.severity === 'warning').length,
      info: issues.filter(i => i.rule.severity === 'info').length,
      wcagA: issues.filter(i => i.rule.wcagLevel === 'A').length,
      wcagAA: issues.filter(i => i.rule.wcagLevel === 'AA').length,
      wcagAAA: issues.filter(i => i.rule.wcagLevel === 'AAA').length,
    }
    
    const issueList = issues.map(issue => ({
      severity: issue.rule.severity,
      wcagLevel: issue.rule.wcagLevel,
      rule: issue.rule.name,
      description: issue.rule.description,
      location: issue.location,
      fix: issue.rule.fix,
    }))
    
    return { summary, issues: issueList }
  }
}

// Accessibility utilities
export const accessibilityUtils = {
  /**
   * Generate unique ID for accessibility
   */
  generateId: (prefix: string = 'a11y'): string => {
    return `${prefix}-${Math.random().toString(36).substr(2, 9)}`
  },

  /**
   * Create ARIA attributes object
   */
  createAriaProps: (props: Partial<AriaProps>): AriaProps => {
    return Object.fromEntries(
      Object.entries(props).filter(([_, value]) => value !== undefined)
    ) as AriaProps
  },

  /**
   * Announce message to screen readers
   */
  announceToScreenReader: (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
    const announcement = document.createElement('div')
    announcement.setAttribute('aria-live', priority)
    announcement.setAttribute('aria-atomic', 'true')
    announcement.className = 'sr-only'
    announcement.textContent = message
    
    document.body.appendChild(announcement)
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement)
    }, 1000)
  },

  /**
   * Check if element is focusable
   */
  isFocusable: (element: Element): boolean => {
    const focusableElements = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ]
    
    return focusableElements.some(selector => element.matches(selector))
  },

  /**
   * Get all focusable elements within a container
   */
  getFocusableElements: (container: Element): Element[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ')
    
    return Array.from(container.querySelectorAll(focusableSelectors))
  },

  /**
   * Trap focus within a container
   */
  trapFocus: (container: Element): (() => void) => {
    const focusableElements = accessibilityUtils.getFocusableElements(container)
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement
    
    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent
      if (keyboardEvent.key === 'Tab') {
        if (keyboardEvent.shiftKey) {
          if (document.activeElement === firstElement) {
            keyboardEvent.preventDefault()
            lastElement?.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            keyboardEvent.preventDefault()
            firstElement?.focus()
          }
        }
      }
    }
    
    container.addEventListener('keydown', handleKeyDown)
    firstElement?.focus()
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  },

  /**
   * Create screen reader only text
   */
  createScreenReaderText: (text: string): HTMLElement => {
    const element = document.createElement('span')
    element.className = 'sr-only'
    element.textContent = text
    return element
  },

  /**
   * Check if user prefers reduced motion
   */
  prefersReducedMotion: (): boolean => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  /**
   * Check if user prefers high contrast
   */
  prefersHighContrast: (): boolean => {
    return window.matchMedia('(prefers-contrast: high)').matches
  },

  /**
   * Get color scheme preference
   */
  getColorSchemePreference: (): 'light' | 'dark' | 'no-preference' => {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light'
    }
    return 'no-preference'
  },
}

// Keyboard navigation utilities
export const keyboardUtils = {
  /**
   * Common keyboard event handlers
   */
  handleEnterOrSpace: (callback: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      callback()
    }
  },

  handleEscape: (callback: () => void) => (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      callback()
    }
  },

  handleArrowKeys: (callbacks: {
    up?: () => void
    down?: () => void
    left?: () => void
    right?: () => void
  }) => (event: KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        callbacks.up?.()
        break
      case 'ArrowDown':
        event.preventDefault()
        callbacks.down?.()
        break
      case 'ArrowLeft':
        event.preventDefault()
        callbacks.left?.()
        break
      case 'ArrowRight':
        event.preventDefault()
        callbacks.right?.()
        break
    }
  },

  /**
   * Roving tabindex implementation
   */
  createRovingTabindex: (container: Element): (() => void) => {
    const items = accessibilityUtils.getFocusableElements(container)
    let currentIndex = 0
    
    // Set initial tabindex
    items.forEach((item, index) => {
      item.setAttribute('tabindex', index === 0 ? '0' : '-1')
    })
    
    const handleKeyDown = (event: Event) => {
      const keyboardEvent = event as KeyboardEvent
      const target = keyboardEvent.target as Element
      const currentItemIndex = items.indexOf(target)
      
      if (currentItemIndex === -1) return
      
      let newIndex = currentItemIndex
      
      switch (keyboardEvent.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          keyboardEvent.preventDefault()
          newIndex = (currentItemIndex + 1) % items.length
          break
        case 'ArrowLeft':
        case 'ArrowUp':
          keyboardEvent.preventDefault()
          newIndex = currentItemIndex === 0 ? items.length - 1 : currentItemIndex - 1
          break
        case 'Home':
          keyboardEvent.preventDefault()
          newIndex = 0
          break
        case 'End':
          keyboardEvent.preventDefault()
          newIndex = items.length - 1
          break
        default:
          return
      }
      
      // Update tabindex
      items[currentItemIndex].setAttribute('tabindex', '-1')
      items[newIndex].setAttribute('tabindex', '0')
      ;(items[newIndex] as HTMLElement).focus()
      
      currentIndex = newIndex
    }
    
    container.addEventListener('keydown', handleKeyDown)
    
    return () => {
      container.removeEventListener('keydown', handleKeyDown)
    }
  },
}

// Export the checker instance
export const accessibilityChecker = new AccessibilityChecker()