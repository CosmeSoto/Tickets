#!/usr/bin/env tsx

/**
 * UI Components Fix Script
 * 
 * This script automatically fixes common UI component issues identified
 * by the audit, including accessibility props, forwardRef, and displayName.
 */

import fs from 'fs/promises'
import path from 'path'
import { glob } from 'glob'

const COMPONENTS_DIR = path.join(process.cwd(), 'src/components')

interface ComponentFix {
  filePath: string
  originalContent: string
  fixedContent: string
  fixes: string[]
}

async function fixComponent(filePath: string): Promise<ComponentFix | null> {
  try {
    const originalContent = await fs.readFile(filePath, 'utf-8')
    let fixedContent = originalContent
    const fixes: string[] = []

    // Skip if it's an index file or already has standard props
    if (filePath.includes('index.ts') || originalContent.includes('StandardComponentProps')) {
      return null
    }

    // Fix 1: Add StandardComponentProps import if missing
    if (!originalContent.includes('StandardComponentProps') && 
        !originalContent.includes('React.HTMLAttributes') &&
        originalContent.includes('interface ') &&
        originalContent.includes('Props')) {
      
      const importMatch = originalContent.match(/import.*from ['"]@\/lib\/utils['"]/)
      if (importMatch) {
        fixedContent = fixedContent.replace(
          importMatch[0],
          `${importMatch[0]}\nimport { type StandardComponentProps } from '@/lib/ui-standards'`
        )
        fixes.push('Added StandardComponentProps import')
      }
    }

    // Fix 2: Add accessibility props to component interfaces
    const interfaceRegex = /interface\s+(\w+Props)[^{]*{([^}]*)}/g
    const interfaceMatches = [...originalContent.matchAll(interfaceRegex)]
    
    for (const match of interfaceMatches) {
      const interfaceName = match[1]
      const interfaceContent = match[2]
      
      // Skip if already extends StandardComponentProps or HTMLAttributes
      if (interfaceContent.includes('StandardComponentProps') || 
          interfaceContent.includes('HTMLAttributes') ||
          interfaceContent.includes('ButtonHTMLAttributes')) {
        continue
      }

      const newInterface = match[0].replace(
        `interface ${interfaceName}`,
        `interface ${interfaceName}\n  extends StandardComponentProps`
      )
      
      fixedContent = fixedContent.replace(match[0], newInterface)
      fixes.push(`Added StandardComponentProps to ${interfaceName}`)
    }

    // Fix 3: Add forwardRef if component is interactive and doesn't have it
    const isInteractive = /onClick|onKeyDown|onFocus|onBlur|button|input|select|textarea/i.test(originalContent)
    const hasForwardRef = originalContent.includes('forwardRef')
    
    if (isInteractive && !hasForwardRef) {
      // Look for component definition
      const componentRegex = /export const (\w+):\s*React\.FC<([^>]+)>\s*=\s*\(([^)]*)\)\s*=>\s*{/
      const componentMatch = originalContent.match(componentRegex)
      
      if (componentMatch) {
        const componentName = componentMatch[1]
        const propsType = componentMatch[2]
        const params = componentMatch[3]
        
        const newComponent = `export const ${componentName} = React.forwardRef<HTMLElement, ${propsType}>(
  (${params}, ref) => {`
        
        fixedContent = fixedContent.replace(componentMatch[0], newComponent)
        
        // Add ref to the main element
        const elementRegex = /<(\w+)([^>]*?)>/
        const elementMatch = fixedContent.match(elementRegex)
        if (elementMatch && !elementMatch[2].includes('ref=')) {
          fixedContent = fixedContent.replace(
            elementMatch[0],
            `<${elementMatch[1]}${elementMatch[2]} ref={ref}>`
          )
        }
        
        // Close the forwardRef
        const lastBraceIndex = fixedContent.lastIndexOf('}')
        if (lastBraceIndex !== -1) {
          fixedContent = fixedContent.substring(0, lastBraceIndex + 1) + 
            `\n)\n${componentName}.displayName = '${componentName}'`
        }
        
        fixes.push(`Added forwardRef to ${componentName}`)
        fixes.push(`Added displayName to ${componentName}`)
      }
    }

    // Fix 4: Add displayName if missing
    const componentNameRegex = /export const (\w+)\s*=/
    const componentNameMatch = originalContent.match(componentNameRegex)
    
    if (componentNameMatch && !originalContent.includes('.displayName')) {
      const componentName = componentNameMatch[1]
      
      // Add displayName at the end
      if (!fixedContent.includes('.displayName')) {
        fixedContent += `\n${componentName}.displayName = '${componentName}'`
        fixes.push(`Added displayName to ${componentName}`)
      }
    }

    // Fix 5: Ensure proper accessibility props are spread
    if (fixes.some(fix => fix.includes('StandardComponentProps'))) {
      // Look for props spreading and ensure accessibility props are included
      const propsSpreadRegex = /{\s*\.\.\.props\s*}/
      if (!propsSpreadRegex.test(fixedContent)) {
        // Find the main element and add props spreading
        const elementRegex = /<(\w+)([^>]*?)>/
        const elementMatch = fixedContent.match(elementRegex)
        if (elementMatch && !elementMatch[2].includes('...props')) {
          fixedContent = fixedContent.replace(
            elementMatch[0],
            `<${elementMatch[1]}${elementMatch[2]} {...props}>`
          )
          fixes.push('Added props spreading for accessibility')
        }
      }
    }

    return fixes.length > 0 ? {
      filePath,
      originalContent,
      fixedContent,
      fixes
    } : null

  } catch (error) {
    console.warn(`Failed to fix ${filePath}:`, error)
    return null
  }
}

async function fixAllComponents() {
  console.log('🔧 Starting UI Components Fix...\n')

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

  const fixes: ComponentFix[] = []
  let fixedCount = 0

  // Process each component
  for (const filePath of componentFiles) {
    const fix = await fixComponent(filePath)
    if (fix) {
      fixes.push(fix)
      fixedCount++
    }
  }

  console.log(`\n📊 FIX SUMMARY`)
  console.log('===============')
  console.log(`Total Files Processed: ${componentFiles.length}`)
  console.log(`Files Fixed: ${fixedCount}`)
  console.log(`Files Unchanged: ${componentFiles.length - fixedCount}`)

  if (fixes.length > 0) {
    console.log('\n🔧 APPLIED FIXES')
    console.log('================')
    
    for (const fix of fixes) {
      const relativePath = path.relative(process.cwd(), fix.filePath)
      console.log(`\n${relativePath}:`)
      fix.fixes.forEach(fixDescription => {
        console.log(`  ✅ ${fixDescription}`)
      })
    }

    // Ask for confirmation before applying changes
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const question = (query: string): Promise<string> => {
      return new Promise(resolve => readline.question(query, resolve))
    }

    try {
      const confirm = await question('\nApply these fixes? (y/n): ')
      
      if (confirm.toLowerCase() === 'y') {
        // Apply all fixes
        for (const fix of fixes) {
          await fs.writeFile(fix.filePath, fix.fixedContent)
        }
        
        console.log(`\n✅ Successfully applied fixes to ${fixes.length} components!`)
        console.log('\n📋 NEXT STEPS:')
        console.log('1. Run the audit again to verify fixes: npm run audit:ui')
        console.log('2. Test the components to ensure they still work correctly')
        console.log('3. Run the test suite: npm test')
        console.log('4. Review the changes and commit them')
      } else {
        console.log('\n❌ Fixes cancelled. No changes were made.')
      }
    } finally {
      readline.close()
    }
  } else {
    console.log('\n✅ No fixes needed. All components are already compliant!')
  }
}

// Specific component fixes
async function fixSpecificComponents() {
  console.log('🎯 Applying specific component fixes...\n')

  // Fix Button component to extend StandardComponentProps
  const buttonPath = path.join(COMPONENTS_DIR, 'ui/button.tsx')
  try {
    let buttonContent = await fs.readFile(buttonPath, 'utf-8')
    
    if (!buttonContent.includes('StandardComponentProps')) {
      // Add import
      buttonContent = buttonContent.replace(
        "import { cn } from '@/lib/utils'",
        "import { cn } from '@/lib/utils'\nimport { type StandardComponentProps } from '@/lib/ui-standards'"
      )
      
      // Update interface
      buttonContent = buttonContent.replace(
        'export interface ButtonProps\n  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants>',
        'export interface ButtonProps\n  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants>, StandardComponentProps'
      )
      
      await fs.writeFile(buttonPath, buttonContent)
      console.log('✅ Fixed Button component')
    }
  } catch (error) {
    console.warn('Failed to fix Button component:', error)
  }

  // Fix Input component
  const inputPath = path.join(COMPONENTS_DIR, 'ui/input.tsx')
  try {
    let inputContent = await fs.readFile(inputPath, 'utf-8')
    
    if (!inputContent.includes('StandardComponentProps')) {
      // Add import
      inputContent = inputContent.replace(
        "import { cn } from '@/lib/utils'",
        "import { cn } from '@/lib/utils'\nimport { type StandardComponentProps } from '@/lib/ui-standards'"
      )
      
      // Update interface
      inputContent = inputContent.replace(
        'export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>',
        'export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, StandardComponentProps'
      )
      
      await fs.writeFile(inputPath, inputContent)
      console.log('✅ Fixed Input component')
    }
  } catch (error) {
    console.warn('Failed to fix Input component:', error)
  }

  console.log('\n✅ Specific component fixes completed!')
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--specific')) {
    await fixSpecificComponents()
  } else {
    await fixAllComponents()
  }
}

// Run the fixer
if (require.main === module) {
  main().catch(error => {
    console.error('Fix failed:', error)
    process.exit(1)
  })
}

export { fixAllComponents, fixSpecificComponents }