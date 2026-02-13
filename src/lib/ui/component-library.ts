/**
 * Component Library Documentation and Standards
 * Central registry of all UI components with usage guidelines
 */

import { designSystem } from './design-system'

// Component Categories
export const componentCategories = {
  // Base Components
  base: [
    'Button',
    'Input',
    'Label',
    'Textarea',
    'Select',
    'Checkbox',
    'Radio',
    'Switch',
  ],
  
  // Layout Components
  layout: [
    'Container',
    'Grid',
    'Flex',
    'Stack',
    'Section',
    'SidebarLayout',
    'CardGrid',
    'Responsive',
  ],
  
  // Display Components
  display: [
    'Card',
    'Badge',
    'Avatar',
    'Alert',
    'Table',
    'Tabs',
    'Separator',
  ],
  
  // Feedback Components
  feedback: [
    'LoadingSpinner',
    'LoadingButton',
    'PageLoading',
    'Skeleton',
    'ErrorDisplay',
    'InlineError',
    'EmptyState',
    'Toast',
  ],
  
  // Navigation Components
  navigation: [
    'Breadcrumb',
    'Sidebar',
    'Header',
    'DropdownMenu',
    'Dialog',
  ],
  
  // Specialized Components
  specialized: [
    'StatusBadge',
    'PriorityBadge',
    'CategoryBadge',
    'UserBadge',
    'TicketForm',
    'TicketTable',
    'FileUpload',
    'AutoAssignment',
  ],
} as const

// Component Usage Guidelines
export const componentGuidelines = {
  // Button Guidelines
  Button: {
    description: 'Interactive element for user actions',
    variants: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    sizes: ['sm', 'default', 'lg', 'icon'],
    usage: {
      primary: 'Use default variant for primary actions',
      secondary: 'Use outline or secondary for secondary actions',
      destructive: 'Use destructive for dangerous actions (delete, remove)',
      loading: 'Use LoadingButton component for async actions',
    },
    examples: [
      'Primary action: Save, Submit, Create',
      'Secondary action: Cancel, Back, Edit',
      'Destructive action: Delete, Remove, Clear',
    ],
  },

  // Badge Guidelines
  Badge: {
    description: 'Small status indicators and labels',
    variants: ['default', 'secondary', 'destructive', 'outline'],
    usage: {
      status: 'Use StatusBadge for ticket status',
      priority: 'Use PriorityBadge for ticket priority',
      category: 'Use CategoryBadge for ticket categories',
      user: 'Use UserBadge for user information',
      generic: 'Use base Badge for generic labels',
    },
    colors: {
      success: 'Green for positive states',
      warning: 'Amber for warning states',
      error: 'Red for error states',
      info: 'Blue for informational states',
    },
  },

  // Card Guidelines
  Card: {
    description: 'Container for grouping related content',
    components: ['Card', 'CardHeader', 'CardTitle', 'CardDescription', 'CardContent', 'CardFooter'],
    usage: {
      content: 'Use for displaying related information',
      forms: 'Use as container for forms',
      lists: 'Use for list items with rich content',
      dashboards: 'Use for dashboard widgets',
    },
    structure: 'Header (optional) → Content → Footer (optional)',
  },

  // Loading States Guidelines
  LoadingStates: {
    description: 'Feedback for async operations',
    components: ['LoadingSpinner', 'LoadingButton', 'PageLoading', 'Skeleton'],
    usage: {
      spinner: 'Use for small loading indicators',
      button: 'Use LoadingButton for form submissions',
      page: 'Use PageLoading for full page loads',
      skeleton: 'Use Skeleton for content placeholders',
    },
    timing: 'Show loading states for operations > 200ms',
  },

  // Error States Guidelines
  ErrorStates: {
    description: 'Error handling and display',
    components: ['ErrorDisplay', 'InlineError', 'FieldError', 'ErrorBoundary'],
    usage: {
      page: 'Use ErrorDisplay for page-level errors',
      inline: 'Use InlineError for contextual errors',
      form: 'Use FieldError for form validation',
      boundary: 'Use ErrorBoundary to catch React errors',
    },
    types: ['NetworkError', 'ServerError', 'NotFoundError', 'PermissionError', 'TimeoutError'],
  },

  // Empty States Guidelines
  EmptyStates: {
    description: 'Feedback when no content is available',
    components: ['EmptyState', 'NoTickets', 'NoSearchResults', 'NoComments'],
    usage: {
      first_use: 'Guide users to create their first item',
      no_results: 'Provide alternative actions when searches fail',
      no_data: 'Explain why content is missing',
    },
    elements: 'Icon + Title + Description + Action (optional)',
  },
} as const

// Design Patterns
export const designPatterns = {
  // Form Patterns
  forms: {
    structure: [
      'Form container (Card)',
      'Form header with title and description',
      'Form fields with labels and validation',
      'Form actions (Submit, Cancel)',
    ],
    validation: [
      'Show field errors inline',
      'Use FieldError component',
      'Disable submit button during submission',
      'Show loading state on submit button',
    ],
    accessibility: [
      'Associate labels with inputs',
      'Use proper ARIA attributes',
      'Provide clear error messages',
      'Support keyboard navigation',
    ],
  },

  // List Patterns
  lists: {
    structure: [
      'List container',
      'List header with title and actions',
      'List items with consistent structure',
      'Empty state when no items',
      'Loading state during fetch',
    ],
    interactions: [
      'Hover states for interactive items',
      'Selection states for multi-select',
      'Action buttons (edit, delete, view)',
      'Pagination for large lists',
    ],
  },

  // Dashboard Patterns
  dashboard: {
    layout: [
      'Grid layout for widgets',
      'Consistent card structure',
      'Responsive breakpoints',
      'Proper spacing and alignment',
    ],
    widgets: [
      'Stat cards with icon, value, and description',
      'Chart cards with title and data visualization',
      'Activity feeds with timestamps',
      'Quick action cards',
    ],
  },

  // Navigation Patterns
  navigation: {
    sidebar: [
      'Logo/brand at top',
      'Navigation items with icons',
      'Active state indication',
      'User profile at bottom',
      'Collapsible on mobile',
    ],
    breadcrumb: [
      'Show current location',
      'Clickable parent levels',
      'Separator between levels',
      'Home icon for root',
    ],
  },
} as const

// Accessibility Standards
export const accessibilityStandards = {
  // Color and Contrast
  color: {
    contrast: 'Minimum 4.5:1 for normal text, 3:1 for large text',
    meaning: 'Do not rely solely on color to convey information',
    states: 'Use multiple indicators for states (color + icon + text)',
  },

  // Keyboard Navigation
  keyboard: {
    focus: 'All interactive elements must be keyboard accessible',
    order: 'Logical tab order through the interface',
    shortcuts: 'Provide keyboard shortcuts for common actions',
    escape: 'ESC key should close modals and dropdowns',
  },

  // Screen Readers
  screenReader: {
    labels: 'All form inputs must have associated labels',
    headings: 'Use proper heading hierarchy (h1, h2, h3)',
    landmarks: 'Use semantic HTML and ARIA landmarks',
    descriptions: 'Provide descriptions for complex interactions',
  },

  // ARIA Attributes
  aria: {
    required: 'aria-required for required form fields',
    invalid: 'aria-invalid for fields with errors',
    expanded: 'aria-expanded for collapsible content',
    hidden: 'aria-hidden for decorative elements',
    live: 'aria-live for dynamic content updates',
  },
} as const

// Performance Guidelines
export const performanceGuidelines = {
  // Component Loading
  loading: {
    lazy: 'Use React.lazy() for large components',
    suspense: 'Wrap lazy components in Suspense',
    skeleton: 'Show skeleton screens during loading',
    progressive: 'Load critical content first',
  },

  // Image Optimization
  images: {
    formats: 'Use WebP with fallbacks',
    sizes: 'Provide multiple sizes for responsive images',
    lazy: 'Lazy load images below the fold',
    optimization: 'Use Next.js Image component',
  },

  // Bundle Optimization
  bundle: {
    splitting: 'Split code by routes and features',
    treeshaking: 'Import only needed functions',
    compression: 'Enable gzip/brotli compression',
    caching: 'Use proper cache headers',
  },
} as const

// Testing Standards
export const testingStandards = {
  // Unit Testing
  unit: {
    coverage: 'Aim for 80%+ test coverage',
    components: 'Test component rendering and interactions',
    utilities: 'Test utility functions thoroughly',
    edge_cases: 'Test error conditions and edge cases',
  },

  // Integration Testing
  integration: {
    api: 'Test API integrations',
    forms: 'Test form submissions and validation',
    navigation: 'Test routing and navigation',
    state: 'Test state management',
  },

  // Accessibility Testing
  a11y: {
    automated: 'Use jest-axe for automated testing',
    keyboard: 'Test keyboard navigation',
    screen_reader: 'Test with screen reader tools',
    contrast: 'Verify color contrast ratios',
  },
} as const

// Component Library Export
export const componentLibrary = {
  designSystem,
  componentCategories,
  componentGuidelines,
  designPatterns,
  accessibilityStandards,
  performanceGuidelines,
  testingStandards,
} as const

export type ComponentLibrary = typeof componentLibrary

// Utility Functions
export const getComponentsByCategory = (category: keyof typeof componentCategories) => {
  return componentCategories[category]
}

export const getComponentGuideline = (component: string) => {
  return componentGuidelines[component as keyof typeof componentGuidelines]
}

export const validateComponentUsage = (component: string, props: Record<string, any>) => {
  const guideline = getComponentGuideline(component)
  if (!guideline) return { valid: true, warnings: [] }

  const warnings: string[] = []

  // Add validation logic based on guidelines
  // This is a simplified example
  if (component === 'Button' && props.variant === 'destructive' && !props.children?.includes('Delete')) {
    warnings.push('Destructive buttons should typically be used for delete actions')
  }

  return {
    valid: warnings.length === 0,
    warnings,
  }
}