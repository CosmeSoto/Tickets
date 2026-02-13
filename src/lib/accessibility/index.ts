/**
 * Accessibility Module Index
 * Centralized exports for accessibility utilities and components
 */

// Utilities
export {
  ARIA_ROLES,
  accessibilityRules,
  AccessibilityChecker,
  accessibilityUtils,
  keyboardUtils,
  accessibilityChecker,
  type AriaRole,
  type AriaProps,
  type AccessibilityRule,
} from './accessibility-utils'

// Components
export {
  ScreenReaderOnly,
  SkipLink,
  AccessibleButton,
  AccessibleInput,
  AccessibleDialog,
  AccessibleTabs,
  AccessibleAlert,
  AccessibleDropdown,
} from '../../components/ui/accessibility-components'

// Hooks
export {
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
} from '../../hooks/use-accessibility'

// CSS classes for screen reader only content
export const srOnlyClasses = 'sr-only absolute -inset-px overflow-hidden whitespace-nowrap border-0 clip-path-inset-50 h-px w-px'

// Common ARIA patterns
export const commonAriaPatterns = {
  // Button patterns
  toggleButton: (isPressed: boolean) => ({
    'aria-pressed': isPressed,
    role: 'button' as const,
  }),
  
  menuButton: (isExpanded: boolean, menuId: string) => ({
    'aria-haspopup': 'menu' as const,
    'aria-expanded': isExpanded,
    'aria-controls': menuId,
  }),
  
  // Form patterns
  requiredField: {
    'aria-required': true,
  },
  
  invalidField: (errorId: string) => ({
    'aria-invalid': true,
    'aria-describedby': errorId,
  }),
  
  // Navigation patterns
  currentPage: {
    'aria-current': 'page' as const,
  },
  
  // Status patterns
  loading: {
    'aria-live': 'polite' as const,
    'aria-busy': true,
  },
  
  error: {
    role: 'alert' as const,
    'aria-live': 'assertive' as const,
  },
  
  success: {
    role: 'status' as const,
    'aria-live': 'polite' as const,
  },
}

// Accessibility testing helpers
export const a11yTestHelpers = {
  /**
   * Check if element has accessible name
   */
  hasAccessibleName: (element: Element): boolean => {
    const ariaLabel = element.getAttribute('aria-label')
    const ariaLabelledby = element.getAttribute('aria-labelledby')
    const title = element.getAttribute('title')
    
    if (ariaLabel || title) return true
    
    if (ariaLabelledby) {
      const labelElement = document.getElementById(ariaLabelledby)
      return !!labelElement?.textContent?.trim()
    }
    
    // Check for associated label
    const id = element.getAttribute('id')
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`)
      return !!label?.textContent?.trim()
    }
    
    // Check for text content
    return !!element.textContent?.trim()
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
   * Get accessibility tree information
   */
  getAccessibilityInfo: (element: Element) => {
    return {
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      name: element.getAttribute('aria-label') || element.textContent?.trim() || '',
      description: element.getAttribute('aria-describedby') ? 
        document.getElementById(element.getAttribute('aria-describedby')!)?.textContent?.trim() : '',
      state: {
        expanded: element.getAttribute('aria-expanded'),
        selected: element.getAttribute('aria-selected'),
        checked: element.getAttribute('aria-checked'),
        disabled: element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true',
        hidden: element.getAttribute('aria-hidden') === 'true' || 
                (typeof window !== 'undefined' ? getComputedStyle(element).display === 'none' : false),
      },
    }
  },
}

// WCAG compliance levels
export const WCAG_LEVELS = {
  A: 'A',
  AA: 'AA',
  AAA: 'AAA',
} as const

export type WCAGLevel = typeof WCAG_LEVELS[keyof typeof WCAG_LEVELS]

// Color contrast utilities
export const colorContrastUtils = {
  /**
   * Calculate relative luminance
   */
  getRelativeLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  },
  
  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio: (color1: [number, number, number], color2: [number, number, number]): number => {
    const l1 = colorContrastUtils.getRelativeLuminance(...color1)
    const l2 = colorContrastUtils.getRelativeLuminance(...color2)
    
    const lighter = Math.max(l1, l2)
    const darker = Math.min(l1, l2)
    
    return (lighter + 0.05) / (darker + 0.05)
  },
  
  /**
   * Check if contrast ratio meets WCAG standards
   */
  meetsWCAGContrast: (
    ratio: number, 
    level: WCAGLevel = 'AA', 
    isLargeText: boolean = false
  ): boolean => {
    const requirements = {
      A: { normal: 3, large: 3 },
      AA: { normal: 4.5, large: 3 },
      AAA: { normal: 7, large: 4.5 },
    }
    
    const required = requirements[level][isLargeText ? 'large' : 'normal']
    return ratio >= required
  },
}

// Accessibility documentation
export const accessibilityDocs = {
  guidelines: {
    'Use semantic HTML': 'Use appropriate HTML elements for their intended purpose (buttons for actions, links for navigation, etc.)',
    'Provide alternative text': 'All images must have descriptive alt text or be marked as decorative',
    'Ensure keyboard accessibility': 'All interactive elements must be accessible via keyboard navigation',
    'Use sufficient color contrast': 'Text must have a contrast ratio of at least 4.5:1 (3:1 for large text)',
    'Provide focus indicators': 'All focusable elements must have visible focus indicators',
    'Use ARIA appropriately': 'Use ARIA attributes to enhance semantics, not replace proper HTML',
    'Test with screen readers': 'Regularly test your application with screen reader software',
    'Support user preferences': 'Respect user preferences for reduced motion, high contrast, etc.',
  },
  
  resources: {
    'WCAG Guidelines': 'https://www.w3.org/WAI/WCAG21/quickref/',
    'ARIA Authoring Practices': 'https://www.w3.org/WAI/ARIA/apg/',
    'WebAIM': 'https://webaim.org/',
    'A11y Project': 'https://www.a11yproject.com/',
    'Color Contrast Checker': 'https://webaim.org/resources/contrastchecker/',
  },
  
  testingTools: {
    'axe-core': 'Automated accessibility testing library',
    'WAVE': 'Web accessibility evaluation tool',
    'Lighthouse': 'Built-in Chrome accessibility audit',
    'Screen readers': 'NVDA (Windows), JAWS (Windows), VoiceOver (Mac/iOS), TalkBack (Android)',
  },
}