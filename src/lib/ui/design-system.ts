/**
 * Design System Configuration
 * Centralizes all design tokens, patterns, and UI standards
 */

// Color Palette
export const colors = {
  // Primary Colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6', // Main blue
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  
  // Status Colors
  status: {
    success: {
      light: '#dcfce7',
      main: '#16a34a',
      dark: '#15803d',
    },
    warning: {
      light: '#fef3c7',
      main: '#d97706',
      dark: '#92400e',
    },
    error: {
      light: '#fee2e2',
      main: '#dc2626',
      dark: '#991b1b',
    },
    info: {
      light: '#dbeafe',
      main: '#2563eb',
      dark: '#1d4ed8',
    },
  },
  
  // Priority Colors
  priority: {
    low: '#10b981',     // green-500
    medium: '#f59e0b',  // amber-500
    high: '#ef4444',    // red-500
    urgent: '#dc2626',  // red-600
  },
  
  // Ticket Status Colors
  ticketStatus: {
    open: '#3b82f6',      // blue-500
    in_progress: '#f59e0b', // amber-500
    resolved: '#10b981',   // green-500
    closed: '#6b7280',     // gray-500
  },
  
  // Neutral Colors
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
} as const

// Typography Scale
export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    mono: ['JetBrains Mono', 'Consolas', 'monospace'],
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const

// Spacing Scale
export const spacing = {
  0: '0px',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
} as const

// Border Radius
export const borderRadius = {
  none: '0px',
  sm: '0.125rem',   // 2px
  base: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  full: '9999px',
} as const

// Shadows
export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const

// Animation Durations
export const animation = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },
  
  easing: {
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },
} as const

// Component Variants
export const componentVariants = {
  button: {
    sizes: ['sm', 'md', 'lg'] as const,
    variants: ['primary', 'secondary', 'outline', 'ghost', 'destructive'] as const,
  },
  
  badge: {
    sizes: ['sm', 'md', 'lg'] as const,
    variants: ['default', 'secondary', 'outline', 'destructive'] as const,
  },
  
  card: {
    variants: ['default', 'outlined', 'elevated'] as const,
  },
  
  input: {
    sizes: ['sm', 'md', 'lg'] as const,
    variants: ['default', 'error', 'success'] as const,
  },
} as const

// Layout Constants
export const layout = {
  sidebar: {
    width: '16rem',      // 256px
    collapsedWidth: '4rem', // 64px
  },
  
  header: {
    height: '4rem',      // 64px
  },
  
  container: {
    maxWidth: '80rem',   // 1280px
    padding: '1.5rem',   // 24px
  },
  
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
} as const

// Z-Index Scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const

// Utility Functions
export const getStatusColor = (status: string) => {
  const statusMap: Record<string, string> = {
    'OPEN': colors.ticketStatus.open,
    'IN_PROGRESS': colors.ticketStatus.in_progress,
    'RESOLVED': colors.ticketStatus.resolved,
    'CLOSED': colors.ticketStatus.closed,
  }
  return statusMap[status] || colors.gray[500]
}

export const getPriorityColor = (priority: string) => {
  const priorityMap: Record<string, string> = {
    'LOW': colors.priority.low,
    'MEDIUM': colors.priority.medium,
    'HIGH': colors.priority.high,
    'URGENT': colors.priority.urgent,
  }
  return priorityMap[priority] || colors.gray[500]
}

export const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const statusMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'OPEN': 'default',
    'IN_PROGRESS': 'secondary',
    'RESOLVED': 'outline',
    'CLOSED': 'secondary',
  }
  return statusMap[status] || 'outline'
}

export const getPriorityBadgeVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  const priorityMap: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    'LOW': 'outline',
    'MEDIUM': 'secondary',
    'HIGH': 'default',
    'URGENT': 'destructive',
  }
  return priorityMap[priority] || 'outline'
}

// Design System Export
export const designSystem = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  animation,
  componentVariants,
  layout,
  zIndex,
  utils: {
    getStatusColor,
    getPriorityColor,
    getStatusBadgeVariant,
    getPriorityBadgeVariant,
  },
} as const

export type DesignSystem = typeof designSystem