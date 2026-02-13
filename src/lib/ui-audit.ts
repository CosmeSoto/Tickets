/**
 * UI Component Standardization Audit System
 * 
 * This module provides tools to audit and ensure consistency across UI components.
 * It validates design tokens, component patterns, and accessibility standards.
 */

import { z } from 'zod'

// Design Token Standards
export const DesignTokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      900: '#1e3a8a',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      500: '#6b7280',
      600: '#4b5563',
      900: '#111827',
    },
    success: {
      50: '#f0fdf4',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    warning: {
      50: '#fffbeb',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    error: {
      50: '#fef2f2',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
  },
  spacing: {
    xs: '0.25rem',   // 4px
    sm: '0.5rem',    // 8px
    md: '1rem',      // 16px
    lg: '1.5rem',    // 24px
    xl: '2rem',      // 32px
    '2xl': '3rem',   // 48px
  },
  typography: {
    fontSizes: {
      xs: '0.75rem',   // 12px
      sm: '0.875rem',  // 14px
      base: '1rem',    // 16px
      lg: '1.125rem',  // 18px
      xl: '1.25rem',   // 20px
      '2xl': '1.5rem', // 24px
      '3xl': '1.875rem', // 30px
    },
    fontWeights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
    lineHeights: {
      tight: '1.25',
      normal: '1.5',
      relaxed: '1.75',
    },
  },
  borderRadius: {
    none: '0',
    sm: '0.125rem',  // 2px
    md: '0.375rem',  // 6px
    lg: '0.5rem',    // 8px
    xl: '0.75rem',   // 12px
    full: '9999px',
  },
  shadows: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
} as const

// Component Pattern Standards
export const ComponentPatterns = {
  // Standard props that all components should accept
  baseProps: z.object({
    className: z.string().optional(),
    id: z.string().optional(),
    'data-testid': z.string().optional(),
  }),

  // Accessibility requirements
  accessibility: {
    requiredAriaLabels: [
      'aria-label',
      'aria-labelledby',
      'aria-describedby',
    ],
    interactiveElements: [
      'button',
      'input',
      'select',
      'textarea',
      'a',
    ],
    focusableElements: [
      'button',
      'input',
      'select',
      'textarea',
      'a',
      '[tabindex]',
    ],
  },

  // Naming conventions
  naming: {
    componentName: /^[A-Z][a-zA-Z0-9]*$/,
    propName: /^[a-z][a-zA-Z0-9]*$/,
    variantName: /^[a-z][a-zA-Z0-9]*$/,
    className: /^[a-z][a-z0-9-]*$/,
  },

  // Size variants standard
  sizeVariants: ['xs', 'sm', 'md', 'lg', 'xl'] as const,
  
  // Color variants standard
  colorVariants: ['primary', 'secondary', 'success', 'warning', 'error', 'gray'] as const,
} as const

// Audit Rules
export interface AuditRule {
  id: string
  name: string
  description: string
  severity: 'error' | 'warning' | 'info'
  check: (component: ComponentInfo) => AuditResult
}

export interface ComponentInfo {
  name: string
  filePath: string
  props: Record<string, any>
  variants?: Record<string, any>
  className?: string
  hasForwardRef: boolean
  hasDisplayName: boolean
  hasAccessibilityProps: boolean
}

export interface AuditResult {
  passed: boolean
  message: string
  suggestions?: string[]
}

export interface AuditReport {
  componentName: string
  filePath: string
  results: Array<{
    rule: string
    severity: 'error' | 'warning' | 'info'
    passed: boolean
    message: string
    suggestions?: string[]
  }>
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

// Standard Audit Rules
export const auditRules: AuditRule[] = [
  {
    id: 'naming-convention',
    name: 'Component Naming Convention',
    description: 'Component names should follow PascalCase convention',
    severity: 'error',
    check: (component) => ({
      passed: ComponentPatterns.naming.componentName.test(component.name),
      message: component.name.match(ComponentPatterns.naming.componentName) 
        ? 'Component name follows PascalCase convention'
        : 'Component name should follow PascalCase convention',
      suggestions: ['Use PascalCase for component names (e.g., MyComponent)'],
    }),
  },
  {
    id: 'forward-ref',
    name: 'Forward Ref Implementation',
    description: 'Interactive components should use forwardRef for proper ref handling',
    severity: 'warning',
    check: (component) => ({
      passed: component.hasForwardRef,
      message: component.hasForwardRef 
        ? 'Component properly implements forwardRef'
        : 'Component should implement forwardRef for better ref handling',
      suggestions: ['Use React.forwardRef for interactive components'],
    }),
  },
  {
    id: 'display-name',
    name: 'Display Name',
    description: 'Components should have displayName for better debugging',
    severity: 'info',
    check: (component) => ({
      passed: component.hasDisplayName,
      message: component.hasDisplayName 
        ? 'Component has displayName set'
        : 'Component should have displayName for better debugging',
      suggestions: ['Add Component.displayName = "ComponentName"'],
    }),
  },
  {
    id: 'accessibility-props',
    name: 'Accessibility Props',
    description: 'Interactive components should support accessibility props',
    severity: 'error',
    check: (component) => ({
      passed: component.hasAccessibilityProps,
      message: component.hasAccessibilityProps 
        ? 'Component supports accessibility props'
        : 'Component should support accessibility props (aria-label, role, etc.)',
      suggestions: [
        'Add aria-label prop support',
        'Add role prop support',
        'Ensure keyboard navigation support',
      ],
    }),
  },
  {
    id: 'consistent-styling',
    name: 'Consistent Styling Approach',
    description: 'Components should use consistent styling approach (CVA + cn utility)',
    severity: 'warning',
    check: (component) => {
      const hasConsistentStyling = component.className?.includes('cn(') || 
                                  component.variants !== undefined
      return {
        passed: hasConsistentStyling,
        message: hasConsistentStyling 
          ? 'Component uses consistent styling approach'
          : 'Component should use cn() utility and/or CVA for styling',
        suggestions: [
          'Use cn() utility for className merging',
          'Consider using class-variance-authority (CVA) for variants',
        ],
      }
    },
  },
]

// UI Audit Service
export class UIAuditService {
  private rules: AuditRule[]

  constructor(customRules: AuditRule[] = []) {
    this.rules = [...auditRules, ...customRules]
  }

  /**
   * Audit a single component
   */
  auditComponent(component: ComponentInfo): AuditReport {
    const results = this.rules.map(rule => ({
      rule: rule.id,
      severity: rule.severity,
      ...rule.check(component),
    }))

    const score = this.calculateScore(results)
    const grade = this.calculateGrade(score)

    return {
      componentName: component.name,
      filePath: component.filePath,
      results,
      score,
      grade,
    }
  }

  /**
   * Audit multiple components
   */
  auditComponents(components: ComponentInfo[]): AuditReport[] {
    return components.map(component => this.auditComponent(component))
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(reports: AuditReport[]) {
    const totalComponents = reports.length
    const averageScore = reports.reduce((sum, report) => sum + report.score, 0) / totalComponents
    
    const gradeDistribution = reports.reduce((acc, report) => {
      acc[report.grade] = (acc[report.grade] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const issuesByRule = reports.flatMap(report => report.results)
      .filter(result => !result.passed)
      .reduce((acc, result) => {
        acc[result.rule] = (acc[result.rule] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    const criticalIssues = reports.flatMap(report => 
      report.results.filter(result => !result.passed && result.severity === 'error')
    ).length

    return {
      summary: {
        totalComponents,
        averageScore: Math.round(averageScore * 100) / 100,
        gradeDistribution,
        criticalIssues,
      },
      topIssues: Object.entries(issuesByRule)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([rule, count]) => ({ rule, count })),
      recommendations: this.generateRecommendations(reports),
    }
  }

  private calculateScore(results: Array<{ passed: boolean; severity: string }>): number {
    const weights = { error: 3, warning: 2, info: 1 }
    const totalWeight = results.reduce((sum, result) => sum + weights[result.severity as keyof typeof weights], 0)
    const passedWeight = results
      .filter(result => result.passed)
      .reduce((sum, result) => sum + weights[result.severity as keyof typeof weights], 0)
    
    return totalWeight > 0 ? passedWeight / totalWeight : 1
  }

  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 0.9) return 'A'
    if (score >= 0.8) return 'B'
    if (score >= 0.7) return 'C'
    if (score >= 0.6) return 'D'
    return 'F'
  }

  private generateRecommendations(reports: AuditReport[]): string[] {
    const recommendations: string[] = []
    
    const commonIssues = reports.flatMap(report => report.results)
      .filter(result => !result.passed)
      .reduce((acc, result) => {
        acc[result.rule] = (acc[result.rule] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    // Generate recommendations based on most common issues
    Object.entries(commonIssues)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([rule, count]) => {
        const ruleInfo = this.rules.find(r => r.id === rule)
        if (ruleInfo && count > reports.length * 0.3) {
          recommendations.push(
            `Address ${rule} issues across ${count} components: ${ruleInfo.description}`
          )
        }
      })

    return recommendations
  }
}

// Component Library Documentation Generator
export class ComponentLibraryDocs {
  /**
   * Generate component documentation
   */
  generateComponentDocs(component: ComponentInfo): string {
    return `
# ${component.name}

**File**: \`${component.filePath}\`

## Props

${Object.entries(component.props || {}).map(([name, type]) => 
  `- **${name}**: \`${type}\``
).join('\n')}

## Variants

${component.variants ? Object.entries(component.variants).map(([name, options]) => 
  `- **${name}**: ${Array.isArray(options) ? options.join(', ') : 'custom'}`
).join('\n') : 'No variants defined'}

## Usage

\`\`\`tsx
import { ${component.name} } from '@/components/ui'

<${component.name} />
\`\`\`

## Accessibility

${component.hasAccessibilityProps ? '✅ Supports accessibility props' : '❌ Missing accessibility support'}

## Best Practices

- Use semantic HTML elements when possible
- Provide meaningful labels and descriptions
- Ensure keyboard navigation support
- Test with screen readers
    `.trim()
  }

  /**
   * Generate complete component library documentation
   */
  generateLibraryDocs(components: ComponentInfo[]): string {
    const categories = this.categorizeComponents(components)
    
    let docs = `# Component Library Documentation

This documentation provides a comprehensive guide to all UI components in the system.

## Design System

Our components follow a consistent design system based on:
- **Colors**: Primary, secondary, success, warning, error palettes
- **Typography**: Consistent font sizes, weights, and line heights  
- **Spacing**: Standardized spacing scale
- **Accessibility**: WCAG 2.1 AA compliance

## Component Categories

`

    Object.entries(categories).forEach(([category, categoryComponents]) => {
      docs += `\n### ${category}\n\n`
      categoryComponents.forEach(component => {
        docs += `- [${component.name}](#${component.name.toLowerCase()})\n`
      })
    })

    docs += '\n## Components\n\n'
    
    components.forEach(component => {
      docs += this.generateComponentDocs(component) + '\n\n---\n\n'
    })

    return docs
  }

  private categorizeComponents(components: ComponentInfo[]): Record<string, ComponentInfo[]> {
    const categories: Record<string, ComponentInfo[]> = {
      'Base Components': [],
      'Layout Components': [],
      'Interactive Components': [],
      'Feedback Components': [],
      'Specialized Components': [],
    }

    components.forEach(component => {
      const name = component.name.toLowerCase()
      
      if (name.includes('button') || name.includes('input') || name.includes('select')) {
        categories['Base Components'].push(component)
      } else if (name.includes('card') || name.includes('container') || name.includes('grid')) {
        categories['Layout Components'].push(component)
      } else if (name.includes('dialog') || name.includes('dropdown') || name.includes('modal')) {
        categories['Interactive Components'].push(component)
      } else if (name.includes('alert') || name.includes('toast') || name.includes('loading')) {
        categories['Feedback Components'].push(component)
      } else {
        categories['Specialized Components'].push(component)
      }
    })

    return categories
  }
}

// Export singleton instances
export const uiAudit = new UIAuditService()
export const componentDocs = new ComponentLibraryDocs()