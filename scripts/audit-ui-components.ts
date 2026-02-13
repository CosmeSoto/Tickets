#!/usr/bin/env tsx

/**
 * UI Components Audit Script
 * 
 * This script audits all UI components for consistency, accessibility,
 * and adherence to design system standards.
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'
import { uiAudit, componentDocs, type ComponentInfo } from '../src/lib/ui-audit'

const COMPONENTS_DIR = path.join(process.cwd(), 'src/components')
const OUTPUT_DIR = path.join(process.cwd(), 'docs/ui-audit')

async function extractComponentInfo(filePath: string): Promise<ComponentInfo | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const fileName = path.basename(filePath, '.tsx')
    const componentName = fileName.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('')

    // Basic analysis of component structure
    const hasForwardRef = content.includes('forwardRef')
    const hasDisplayName = content.includes('.displayName')
    const hasAccessibilityProps = /aria-|role=|tabIndex/.test(content)
    const hasClassName = content.includes('className')
    const hasCVA = content.includes('cva(') || content.includes('VariantProps')

    // Extract props (simplified analysis)
    const propsMatch = content.match(/interface\s+\w+Props[^{]*{([^}]*)}/)
    const props: Record<string, string> = {}
    
    if (propsMatch) {
      const propsContent = propsMatch[1]
      const propLines = propsContent.split('\n').filter(line => line.trim())
      
      propLines.forEach(line => {
        const propMatch = line.match(/^\s*(\w+)[\?:]?\s*:\s*([^;,\n]+)/)
        if (propMatch) {
          props[propMatch[1]] = propMatch[2].trim()
        }
      })
    }

    // Extract variants (simplified analysis)
    let variants: Record<string, any> | undefined
    const variantsMatch = content.match(/variants:\s*{([^}]+)}/)
    if (variantsMatch) {
      variants = {}
      const variantContent = variantsMatch[1]
      const variantMatches = variantContent.match(/(\w+):\s*{[^}]*}/g)
      
      if (variantMatches) {
        variantMatches.forEach(match => {
          const nameMatch = match.match(/^(\w+):/)
          if (nameMatch) {
            variants![nameMatch[1]] = 'variant'
          }
        })
      }
    }

    return {
      name: componentName,
      filePath: path.relative(process.cwd(), filePath),
      props,
      variants,
      className: hasClassName ? 'uses-className' : undefined,
      hasForwardRef,
      hasDisplayName,
      hasAccessibilityProps,
    }
  } catch (error) {
    console.warn(`Failed to analyze ${filePath}:`, error)
    return null
  }
}

async function auditAllComponents() {
  console.log('🔍 Starting UI Components Audit...\n')

  // Find all component files
  const componentFiles = await glob('**/*.tsx', {
    cwd: COMPONENTS_DIR,
    absolute: true,
  }) as string[]

  if (!componentFiles || componentFiles.length === 0) {
    console.log('No component files found')
    return
  }

  console.log(`Found ${componentFiles.length} component files`)

  // Extract component information
  const components: ComponentInfo[] = []
  for (const filePath of componentFiles) {
    const componentInfo = await extractComponentInfo(filePath)
    if (componentInfo) {
      components.push(componentInfo)
    }
  }

  console.log(`Analyzed ${components.length} components\n`)

  // Run audit
  const reports = uiAudit.auditComponents(components)
  const summary = uiAudit.generateSummaryReport(reports)

  // Display results
  console.log('📊 AUDIT SUMMARY')
  console.log('================')
  console.log(`Total Components: ${summary.summary.totalComponents}`)
  console.log(`Average Score: ${summary.summary.averageScore}/1.0`)
  console.log(`Critical Issues: ${summary.summary.criticalIssues}`)
  console.log()

  console.log('Grade Distribution:')
  Object.entries(summary.summary.gradeDistribution).forEach(([grade, count]) => {
    const percentage = Math.round((count / summary.summary.totalComponents) * 100)
    console.log(`  ${grade}: ${count} components (${percentage}%)`)
  })
  console.log()

  console.log('Top Issues:')
  summary.topIssues.forEach(({ rule, count }, index) => {
    console.log(`  ${index + 1}. ${rule}: ${count} components`)
  })
  console.log()

  console.log('Recommendations:')
  summary.recommendations.forEach((rec, index) => {
    console.log(`  ${index + 1}. ${rec}`)
  })
  console.log()

  // Show detailed results for components with issues
  const componentsWithIssues = reports.filter(report => 
    report.results.some(result => !result.passed && result.severity === 'error')
  )

  if (componentsWithIssues.length > 0) {
    console.log('🚨 COMPONENTS WITH CRITICAL ISSUES')
    console.log('==================================')
    
    componentsWithIssues.forEach(report => {
      console.log(`\n${report.componentName} (${report.filePath}) - Grade: ${report.grade}`)
      
      const criticalIssues = report.results.filter(result => 
        !result.passed && result.severity === 'error'
      )
      
      criticalIssues.forEach(issue => {
        console.log(`  ❌ ${issue.rule}: ${issue.message}`)
        if (issue.suggestions) {
          issue.suggestions.forEach(suggestion => {
            console.log(`     💡 ${suggestion}`)
          })
        }
      })
    })
  }

  // Save detailed reports
  await ensureDir(OUTPUT_DIR)
  
  // Save individual component reports
  for (const report of reports) {
    const reportPath = path.join(OUTPUT_DIR, `${report.componentName.toLowerCase()}-audit.json`)
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
  }

  // Save summary report
  const summaryPath = path.join(OUTPUT_DIR, 'summary.json')
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))

  // Generate component library documentation
  const libraryDocs = componentDocs.generateLibraryDocs(components)
  const docsPath = path.join(OUTPUT_DIR, 'component-library.md')
  await fs.writeFile(docsPath, libraryDocs)

  console.log(`\n📁 Reports saved to: ${OUTPUT_DIR}`)
  console.log('   - summary.json: Overall audit summary')
  console.log('   - component-library.md: Complete component documentation')
  console.log('   - [component]-audit.json: Individual component reports')

  // Exit with error code if there are critical issues
  if (summary.summary.criticalIssues > 0) {
    console.log('\n❌ Audit completed with critical issues')
    process.exit(1)
  } else {
    console.log('\n✅ Audit completed successfully')
  }
}

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

// Run the audit
if (require.main === module) {
  auditAllComponents().catch(error => {
    console.error('Audit failed:', error)
    process.exit(1)
  })
}

export { auditAllComponents }