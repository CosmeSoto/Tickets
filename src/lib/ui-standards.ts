/**
 * UI Component Standards and Templates
 * 
 * This module provides standardized templates and utilities for creating
 * consistent UI components across the application.
 */

import { type VariantProps } from 'class-variance-authority'
import { type ComponentPropsWithoutRef, type ElementRef } from 'react'

// Standard Component Props Interface
export interface StandardComponentProps {
  className?: string
  id?: string
  'data-testid'?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  role?: string
}

// Size Variant Type
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

// Color Variant Type  
export type ColorVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'gray'

// Standard Variant Props
export interface StandardVariantProps {
  size?: SizeVariant
  variant?: ColorVariant
}

// Component Template Generator
export class ComponentTemplate {
  /**
   * Generate a standard component template
   */
  static generateComponent(config: {
    name: string
    element: string
    hasVariants?: boolean
    isInteractive?: boolean
    hasChildren?: boolean
  }): string {
    const { name, element, hasVariants = false, isInteractive = false, hasChildren = true } = config

    const imports = [
      "import * as React from 'react'",
      hasVariants ? "import { cva, type VariantProps } from 'class-variance-authority'" : null,
      "import { cn } from '@/lib/utils'",
      isInteractive ? "import { type StandardComponentProps } from '@/lib/ui-standards'" : null,
    ].filter(Boolean).join('\n')

    const variantsCode = hasVariants ? `
const ${name.toLowerCase()}Variants = cva(
  // Base styles
  'inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        success: 'bg-green-600 text-white hover:bg-green-700',
        warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
        error: 'bg-red-600 text-white hover:bg-red-700',
        gray: 'bg-gray-600 text-white hover:bg-gray-700',
      },
      size: {
        xs: 'h-8 px-2 text-xs',
        sm: 'h-9 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
)` : ''

    const propsInterface = `
export interface ${name}Props
  extends React.${element === 'button' ? 'ButtonHTMLAttributes' : 'HTMLAttributes'}<HTML${element.charAt(0).toUpperCase() + element.slice(1)}Element>${hasVariants ? `, VariantProps<typeof ${name.toLowerCase()}Variants>` : ''}${isInteractive ? ', StandardComponentProps' : ''} {
  ${hasChildren ? 'children?: React.ReactNode' : ''}
}`

    const componentCode = `
const ${name} = React.forwardRef<HTML${element.charAt(0).toUpperCase() + element.slice(1)}Element, ${name}Props>(
  ({ className${hasVariants ? ', variant, size' : ''}${hasChildren ? ', children' : ''}, ...props }, ref) => {
    return (
      <${element}
        className={cn(${hasVariants ? `${name.toLowerCase()}Variants({ variant, size, className })` : `'/* Add your base styles here */', className`})}
        ref={ref}
        {...props}
      >
        ${hasChildren ? '{children}' : ''}
      </${element}>
    )
  }
)
${name}.displayName = '${name}'`

    const exports = hasVariants 
      ? `export { ${name}, ${name.toLowerCase()}Variants }`
      : `export { ${name} }`

    return [
      imports,
      variantsCode,
      propsInterface,
      componentCode,
      exports,
    ].filter(Boolean).join('\n\n')
  }

  /**
   * Generate component test template
   */
  static generateTest(componentName: string): string {
    return `
import { render, screen } from '@testing-library/react'
import { ${componentName} } from './${componentName.toLowerCase()}'

describe('${componentName}', () => {
  it('renders correctly', () => {
    render(<${componentName}>Test content</${componentName}>)
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    render(<${componentName} className="custom-class">Test</${componentName}>)
    expect(screen.getByText('Test')).toHaveClass('custom-class')
  })

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLDivElement>()
    render(<${componentName} ref={ref}>Test</${componentName}>)
    expect(ref.current).toBeInTheDocument()
  })

  it('supports accessibility props', () => {
    render(
      <${componentName} 
        aria-label="Test label"
        data-testid="test-component"
      >
        Test
      </${componentName}>
    )
    
    const element = screen.getByTestId('test-component')
    expect(element).toHaveAttribute('aria-label', 'Test label')
  })
})
    `.trim()
  }

  /**
   * Generate Storybook story template
   */
  static generateStory(componentName: string): string {
    return `
import type { Meta, StoryObj } from '@storybook/react'
import { ${componentName} } from './${componentName.toLowerCase()}'

const meta: Meta<typeof ${componentName}> = {
  title: 'UI/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: { type: 'select' },
      options: ['primary', 'secondary', 'success', 'warning', 'error', 'gray'],
    },
    size: {
      control: { type: 'select' },
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: '${componentName}',
  },
}

export const Variants: Story = {
  render: () => (
    <div className="flex gap-2">
      <${componentName} variant="primary">Primary</${componentName}>
      <${componentName} variant="secondary">Secondary</${componentName}>
      <${componentName} variant="success">Success</${componentName}>
      <${componentName} variant="warning">Warning</${componentName}>
      <${componentName} variant="error">Error</${componentName}>
      <${componentName} variant="gray">Gray</${componentName}>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <${componentName} size="xs">XS</${componentName}>
      <${componentName} size="sm">SM</${componentName}>
      <${componentName} size="md">MD</${componentName}>
      <${componentName} size="lg">LG</${componentName}>
      <${componentName} size="xl">XL</${componentName}>
    </div>
  ),
}
    `.trim()
  }
}

// Standard CSS Classes
export const StandardClasses = {
  // Focus styles
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  
  // Disabled styles
  disabled: 'disabled:pointer-events-none disabled:opacity-50',
  
  // Transition styles
  transition: 'transition-colors duration-200',
  
  // Interactive styles
  interactive: 'cursor-pointer hover:opacity-80',
  
  // Layout utilities
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  
  // Spacing utilities
  padding: {
    xs: 'p-1',
    sm: 'p-2', 
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  },
  
  margin: {
    xs: 'm-1',
    sm: 'm-2',
    md: 'm-4', 
    lg: 'm-6',
    xl: 'm-8',
  },
  
  // Border radius utilities
  rounded: {
    none: 'rounded-none',
    sm: 'rounded-sm',
    md: 'rounded-md',
    lg: 'rounded-lg',
    xl: 'rounded-xl',
    full: 'rounded-full',
  },
  
  // Shadow utilities
  shadow: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  },
} as const

// Component Validation Utilities
export class ComponentValidator {
  /**
   * Validate component props against standards
   */
  static validateProps(props: Record<string, any>): {
    isValid: boolean
    errors: string[]
    warnings: string[]
  } {
    const errors: string[] = []
    const warnings: string[] = []

    // Check for required accessibility props on interactive elements
    if (props.onClick || props.onKeyDown) {
      if (!props['aria-label'] && !props['aria-labelledby']) {
        errors.push('Interactive elements must have aria-label or aria-labelledby')
      }
    }

    // Check for proper className usage
    if (props.className && typeof props.className !== 'string') {
      errors.push('className must be a string')
    }

    // Check for data-testid in test environment
    if (process.env.NODE_ENV === 'test' && !props['data-testid']) {
      warnings.push('Consider adding data-testid for testing')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate component styling consistency
   */
  static validateStyling(className: string): {
    isValid: boolean
    suggestions: string[]
  } {
    const suggestions: string[] = []

    // Check for focus styles
    if (!className.includes('focus-visible:')) {
      suggestions.push('Add focus-visible styles for accessibility')
    }

    // Check for transition styles
    if (!className.includes('transition')) {
      suggestions.push('Consider adding transition styles for smooth interactions')
    }

    // Check for disabled styles
    if (className.includes('disabled:') && !className.includes('disabled:opacity-50')) {
      suggestions.push('Use standard disabled:opacity-50 for consistency')
    }

    return {
      isValid: suggestions.length === 0,
      suggestions,
    }
  }
}

// Accessibility Utilities
export class AccessibilityUtils {
  /**
   * Generate accessible props for interactive elements
   */
  static getInteractiveProps(config: {
    label?: string
    description?: string
    role?: string
    disabled?: boolean
  }) {
    const { label, description, role, disabled } = config

    return {
      'aria-label': label,
      'aria-describedby': description ? `${label}-description` : undefined,
      role,
      'aria-disabled': disabled,
      tabIndex: disabled ? -1 : 0,
    }
  }

  /**
   * Generate ARIA attributes for form elements
   */
  static getFormProps(config: {
    label?: string
    error?: string
    required?: boolean
    invalid?: boolean
  }) {
    const { label, error, required, invalid } = config

    return {
      'aria-label': label,
      'aria-required': required,
      'aria-invalid': invalid,
      'aria-describedby': error ? `${label}-error` : undefined,
    }
  }

  /**
   * Generate keyboard navigation props
   */
  static getKeyboardProps(config: {
    onEnter?: () => void
    onEscape?: () => void
    onArrowUp?: () => void
    onArrowDown?: () => void
  }) {
    const { onEnter, onEscape, onArrowUp, onArrowDown } = config

    return {
      onKeyDown: (event: React.KeyboardEvent) => {
        switch (event.key) {
          case 'Enter':
            onEnter?.()
            break
          case 'Escape':
            onEscape?.()
            break
          case 'ArrowUp':
            onArrowUp?.()
            break
          case 'ArrowDown':
            onArrowDown?.()
            break
        }
      },
    }
  }
}

// Export utilities
export const componentTemplate = ComponentTemplate
export const standardClasses = StandardClasses
export const componentValidator = ComponentValidator
export const accessibilityUtils = AccessibilityUtils