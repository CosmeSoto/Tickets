/**
 * Responsive Design Audit and Utilities
 * Tools for auditing and improving responsive design
 */

// Breakpoint definitions (matching Tailwind CSS)
export const breakpoints = {
  sm: 640,   // Small devices (landscape phones, 640px and up)
  md: 768,   // Medium devices (tablets, 768px and up)
  lg: 1024,  // Large devices (desktops, 1024px and up)
  xl: 1280,  // Extra large devices (large desktops, 1280px and up)
  '2xl': 1536, // 2X Large devices (larger desktops, 1536px and up)
} as const

export type Breakpoint = keyof typeof breakpoints

// Common responsive patterns
export const responsivePatterns = {
  // Grid patterns
  grid: {
    // 1 column on mobile, 2 on tablet, 3 on desktop
    responsive3Col: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    // 1 column on mobile, 2 on tablet, 4 on desktop
    responsive4Col: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    // 1 column on mobile, 3 on desktop
    responsive3ColSimple: 'grid-cols-1 lg:grid-cols-3',
    // 2 columns on all sizes except mobile
    responsive2Col: 'grid-cols-1 sm:grid-cols-2',
  },
  
  // Flex patterns
  flex: {
    // Stack on mobile, row on desktop
    stackToRow: 'flex-col sm:flex-row',
    // Row on mobile, reverse on desktop
    rowToReverse: 'flex-row sm:flex-row-reverse',
    // Center on mobile, justify between on desktop
    centerToSpaceBetween: 'justify-center sm:justify-between',
  },
  
  // Spacing patterns
  spacing: {
    // Responsive padding
    containerPadding: 'px-4 sm:px-6 lg:px-8',
    // Responsive margin
    sectionMargin: 'my-8 sm:my-12 lg:my-16',
    // Responsive gap
    gridGap: 'gap-4 sm:gap-6 lg:gap-8',
  },
  
  // Typography patterns
  typography: {
    // Responsive headings
    h1: 'text-2xl sm:text-3xl lg:text-4xl xl:text-5xl',
    h2: 'text-xl sm:text-2xl lg:text-3xl',
    h3: 'text-lg sm:text-xl lg:text-2xl',
    // Responsive body text
    body: 'text-sm sm:text-base',
    caption: 'text-xs sm:text-sm',
  },
  
  // Component patterns
  components: {
    // Responsive buttons
    buttonGroup: 'flex flex-col sm:flex-row gap-2 sm:gap-4',
    // Responsive cards
    cardGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6',
    // Responsive forms
    formGrid: 'grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6',
  },
} as const

// Responsive design audit rules
export interface ResponsiveAuditRule {
  name: string
  description: string
  check: (element: Element) => boolean
  fix?: string
  severity: 'error' | 'warning' | 'info'
}

export const responsiveAuditRules: ResponsiveAuditRule[] = [
  {
    name: 'missing-responsive-grid',
    description: 'Grid containers should have responsive column classes',
    check: (element) => {
      const classes = element.className
      return classes.includes('grid') && 
             !classes.includes('grid-cols-1') && 
             !(classes.includes('md:') || classes.includes('lg:') || classes.includes('sm:'))
    },
    fix: 'Add responsive grid classes like "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"',
    severity: 'warning',
  },
  
  {
    name: 'fixed-width-without-responsive',
    description: 'Fixed width elements should have responsive alternatives',
    check: (element) => {
      const classes = element.className
      return classes.includes('w-') && 
             !classes.includes('w-full') && 
             !classes.includes('w-auto') &&
             !(classes.includes('sm:w-') || classes.includes('md:w-') || classes.includes('lg:w-'))
    },
    fix: 'Consider adding responsive width classes or using w-full for mobile',
    severity: 'info',
  },
  
  {
    name: 'missing-mobile-padding',
    description: 'Containers should have appropriate mobile padding',
    check: (element) => {
      const classes = element.className
      return (classes.includes('container') || classes.includes('max-w-')) &&
             !(classes.includes('px-') || classes.includes('p-'))
    },
    fix: 'Add responsive padding like "px-4 sm:px-6 lg:px-8"',
    severity: 'warning',
  },
  
  {
    name: 'small-touch-targets',
    description: 'Interactive elements should be at least 44px for touch',
    check: (element) => {
      const isInteractive = element.tagName === 'BUTTON' || 
                           element.tagName === 'A' || 
                           element.getAttribute('role') === 'button'
      if (!isInteractive) return false
      
      const classes = element.className
      return !classes.includes('h-10') && 
             !classes.includes('h-11') && 
             !classes.includes('h-12') &&
             !classes.includes('min-h-')
    },
    fix: 'Ensure interactive elements have minimum height of h-10 (40px) or h-11 (44px)',
    severity: 'error',
  },
  
  {
    name: 'horizontal-scroll-risk',
    description: 'Elements might cause horizontal scrolling on mobile',
    check: (element) => {
      const classes = element.className
      return classes.includes('min-w-') && 
             !classes.includes('overflow-x-auto') &&
             !classes.includes('overflow-x-scroll')
    },
    fix: 'Add overflow-x-auto or make element responsive',
    severity: 'warning',
  },
]

// Responsive design checker
export class ResponsiveDesignChecker {
  private issues: Array<{
    element: Element
    rule: ResponsiveAuditRule
    location: string
  }> = []

  /**
   * Audit the current page for responsive design issues
   */
  auditPage(): Array<{
    element: Element
    rule: ResponsiveAuditRule
    location: string
  }> {
    this.issues = []
    
    // Get all elements with classes
    const elements = document.querySelectorAll('[class]')
    
    elements.forEach((element, index) => {
      responsiveAuditRules.forEach(rule => {
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
   * Generate a report of responsive design issues
   */
  generateReport(): {
    summary: {
      total: number
      errors: number
      warnings: number
      info: number
    }
    issues: Array<{
      severity: string
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
    }
    
    const issueList = issues.map(issue => ({
      severity: issue.rule.severity,
      rule: issue.rule.name,
      description: issue.rule.description,
      location: issue.location,
      fix: issue.rule.fix,
    }))
    
    return { summary, issues: issueList }
  }
}

// Responsive utilities
export const responsiveUtils = {
  /**
   * Get current breakpoint
   */
  getCurrentBreakpoint(): Breakpoint | null {
    if (typeof window === 'undefined') return null
    
    const width = window.innerWidth
    
    if (width >= breakpoints['2xl']) return '2xl'
    if (width >= breakpoints.xl) return 'xl'
    if (width >= breakpoints.lg) return 'lg'
    if (width >= breakpoints.md) return 'md'
    if (width >= breakpoints.sm) return 'sm'
    
    return null // Below sm breakpoint
  },

  /**
   * Check if current viewport matches breakpoint
   */
  matchesBreakpoint(breakpoint: Breakpoint): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= breakpoints[breakpoint]
  },

  /**
   * Get responsive class for current breakpoint
   */
  getResponsiveClass(classes: Partial<Record<Breakpoint | 'base', string>>): string {
    if (typeof window === 'undefined') return classes.base || ''
    
    const currentBreakpoint = this.getCurrentBreakpoint()
    
    // Return the most specific class that matches
    if (currentBreakpoint === '2xl' && classes['2xl']) return classes['2xl']
    if ((currentBreakpoint === '2xl' || currentBreakpoint === 'xl') && classes.xl) return classes.xl
    if ((currentBreakpoint && ['2xl', 'xl', 'lg'].includes(currentBreakpoint)) && classes.lg) return classes.lg
    if ((currentBreakpoint && ['2xl', 'xl', 'lg', 'md'].includes(currentBreakpoint)) && classes.md) return classes.md
    if (currentBreakpoint && classes.sm) return classes.sm
    
    return classes.base || ''
  },

  /**
   * Generate responsive classes for common patterns
   */
  generateResponsiveClasses: {
    grid: (cols: { base?: number; sm?: number; md?: number; lg?: number; xl?: number }) => {
      const classes: string[] = []
      
      if (cols.base) classes.push(`grid-cols-${cols.base}`)
      if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`)
      if (cols.md) classes.push(`md:grid-cols-${cols.md}`)
      if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`)
      if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`)
      
      return classes.join(' ')
    },
    
    spacing: (spacing: { base?: string; sm?: string; md?: string; lg?: string }) => {
      const classes: string[] = []
      
      if (spacing.base) classes.push(spacing.base)
      if (spacing.sm) classes.push(`sm:${spacing.sm}`)
      if (spacing.md) classes.push(`md:${spacing.md}`)
      if (spacing.lg) classes.push(`lg:${spacing.lg}`)
      
      return classes.join(' ')
    },
    
    typography: (sizes: { base?: string; sm?: string; md?: string; lg?: string }) => {
      const classes: string[] = []
      
      if (sizes.base) classes.push(sizes.base)
      if (sizes.sm) classes.push(`sm:${sizes.sm}`)
      if (sizes.md) classes.push(`md:${sizes.md}`)
      if (sizes.lg) classes.push(`lg:${sizes.lg}`)
      
      return classes.join(' ')
    },
  },
}

// Mobile-first design helpers
export const mobileFirst = {
  /**
   * Common mobile-first patterns
   */
  patterns: {
    // Navigation
    mobileMenu: 'block md:hidden',
    desktopMenu: 'hidden md:block',
    
    // Layout
    stackOnMobile: 'flex flex-col md:flex-row',
    hideOnMobile: 'hidden sm:block',
    showOnMobile: 'block sm:hidden',
    
    // Sizing
    fullWidthOnMobile: 'w-full md:w-auto',
    responsiveContainer: 'w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    
    // Spacing
    responsivePadding: 'p-4 sm:p-6 lg:p-8',
    responsiveMargin: 'm-4 sm:m-6 lg:m-8',
    responsiveGap: 'gap-4 sm:gap-6 lg:gap-8',
  },

  /**
   * Touch-friendly sizing
   */
  touchTargets: {
    minimum: 'min-h-[44px] min-w-[44px]', // 44px minimum for accessibility
    button: 'h-10 px-4 py-2', // Standard button size
    iconButton: 'h-10 w-10', // Square icon button
    input: 'h-10 px-3 py-2', // Standard input size
  },

  /**
   * Mobile-optimized typography
   */
  typography: {
    heading1: 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold',
    heading2: 'text-xl sm:text-2xl md:text-3xl font-semibold',
    heading3: 'text-lg sm:text-xl md:text-2xl font-medium',
    body: 'text-sm sm:text-base',
    caption: 'text-xs sm:text-sm',
  },
}

// Export the checker instance
export const responsiveChecker = new ResponsiveDesignChecker()