#!/usr/bin/env tsx

/**
 * Component Generator Script
 * 
 * This script generates standardized UI components with proper structure,
 * tests, and documentation following the established patterns.
 */

import fs from 'fs/promises'
import path from 'path'
import { ComponentTemplate } from '../src/lib/ui-standards'

interface ComponentConfig {
  name: string
  element: string
  hasVariants: boolean
  isInteractive: boolean
  hasChildren: boolean
  category: 'base' | 'layout' | 'interactive' | 'feedback' | 'specialized'
}

const COMPONENTS_DIR = path.join(process.cwd(), 'src/components/ui')
const TESTS_DIR = path.join(process.cwd(), 'src/__tests__/components')
const STORIES_DIR = path.join(process.cwd(), 'src/stories')

async function generateComponent(config: ComponentConfig) {
  const { name, category } = config
  const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase().slice(1)
  
  console.log(`🔧 Generating ${name} component...`)

  // Generate component file
  const componentCode = ComponentTemplate.generateComponent(config)
  const componentPath = path.join(COMPONENTS_DIR, `${kebabName}.tsx`)
  await fs.writeFile(componentPath, componentCode)
  console.log(`   ✅ Component: ${componentPath}`)

  // Generate test file
  const testCode = ComponentTemplate.generateTest(name)
  const testPath = path.join(TESTS_DIR, `${kebabName}.test.tsx`)
  await ensureDir(path.dirname(testPath))
  await fs.writeFile(testPath, testCode)
  console.log(`   ✅ Test: ${testPath}`)

  // Generate Storybook story
  const storyCode = ComponentTemplate.generateStory(name)
  const storyPath = path.join(STORIES_DIR, `${kebabName}.stories.tsx`)
  await ensureDir(path.dirname(storyPath))
  await fs.writeFile(storyPath, storyCode)
  console.log(`   ✅ Story: ${storyPath}`)

  // Update index.ts
  await updateIndexFile(name, kebabName)
  console.log(`   ✅ Updated index.ts`)

  console.log(`✨ ${name} component generated successfully!\n`)
}

async function updateIndexFile(componentName: string, kebabName: string) {
  const indexPath = path.join(COMPONENTS_DIR, 'index.ts')
  
  try {
    let content = await fs.readFile(indexPath, 'utf-8')
    
    // Add export line
    const exportLine = `export { ${componentName} } from './${kebabName}'`
    
    if (!content.includes(exportLine)) {
      content += `\n${exportLine}`
      await fs.writeFile(indexPath, content)
    }
  } catch (error) {
    // If index.ts doesn't exist, create it
    const exportLine = `export { ${componentName} } from './${kebabName}'`
    await fs.writeFile(indexPath, exportLine)
  }
}

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath)
  } catch {
    await fs.mkdir(dirPath, { recursive: true })
  }
}

// Interactive component generation
async function promptForComponent(): Promise<ComponentConfig> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (query: string): Promise<string> => {
    return new Promise(resolve => readline.question(query, resolve))
  }

  try {
    console.log('🎨 Component Generator')
    console.log('=====================\n')

    const name = await question('Component name (PascalCase): ')
    if (!name || !/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      throw new Error('Component name must be in PascalCase (e.g., MyComponent)')
    }

    const element = await question('HTML element (div, button, input, etc.): ')
    if (!element) {
      throw new Error('HTML element is required')
    }

    const hasVariantsInput = await question('Has variants? (y/n): ')
    const hasVariants = hasVariantsInput.toLowerCase() === 'y'

    const isInteractiveInput = await question('Is interactive? (y/n): ')
    const isInteractive = isInteractiveInput.toLowerCase() === 'y'

    const hasChildrenInput = await question('Has children? (y/n): ')
    const hasChildren = hasChildrenInput.toLowerCase() === 'y'

    console.log('\nCategories:')
    console.log('1. base - Basic components (Button, Input, etc.)')
    console.log('2. layout - Layout components (Card, Container, etc.)')
    console.log('3. interactive - Interactive components (Dialog, Dropdown, etc.)')
    console.log('4. feedback - Feedback components (Alert, Toast, etc.)')
    console.log('5. specialized - Specialized components')

    const categoryInput = await question('Category (1-5): ')
    const categories = ['base', 'layout', 'interactive', 'feedback', 'specialized'] as const
    const categoryIndex = parseInt(categoryInput) - 1
    
    if (categoryIndex < 0 || categoryIndex >= categories.length) {
      throw new Error('Invalid category selection')
    }

    const category = categories[categoryIndex]

    return {
      name,
      element,
      hasVariants,
      isInteractive,
      hasChildren,
      category,
    }
  } finally {
    readline.close()
  }
}

// Predefined component templates
const COMPONENT_TEMPLATES: Record<string, ComponentConfig> = {
  'loading-spinner': {
    name: 'LoadingSpinner',
    element: 'div',
    hasVariants: true,
    isInteractive: false,
    hasChildren: false,
    category: 'feedback',
  },
  'icon-button': {
    name: 'IconButton',
    element: 'button',
    hasVariants: true,
    isInteractive: true,
    hasChildren: true,
    category: 'base',
  },
  'status-indicator': {
    name: 'StatusIndicator',
    element: 'span',
    hasVariants: true,
    isInteractive: false,
    hasChildren: true,
    category: 'feedback',
  },
  'form-field': {
    name: 'FormField',
    element: 'div',
    hasVariants: false,
    isInteractive: false,
    hasChildren: true,
    category: 'layout',
  },
  'tooltip': {
    name: 'Tooltip',
    element: 'div',
    hasVariants: true,
    isInteractive: true,
    hasChildren: true,
    category: 'interactive',
  },
}

async function main() {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    // Interactive mode
    try {
      const config = await promptForComponent()
      await generateComponent(config)
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  } else if (args[0] === '--template' && args[1]) {
    // Template mode
    const templateName = args[1]
    const template = COMPONENT_TEMPLATES[templateName]
    
    if (!template) {
      console.error(`❌ Template "${templateName}" not found`)
      console.log('\nAvailable templates:')
      Object.keys(COMPONENT_TEMPLATES).forEach(name => {
        console.log(`  - ${name}`)
      })
      process.exit(1)
    }
    
    await generateComponent(template)
  } else if (args[0] === '--list-templates') {
    // List templates
    console.log('📋 Available Component Templates:')
    console.log('================================\n')
    
    Object.entries(COMPONENT_TEMPLATES).forEach(([key, config]) => {
      console.log(`${key}:`)
      console.log(`  Name: ${config.name}`)
      console.log(`  Element: ${config.element}`)
      console.log(`  Category: ${config.category}`)
      console.log(`  Features: ${[
        config.hasVariants && 'variants',
        config.isInteractive && 'interactive',
        config.hasChildren && 'children'
      ].filter(Boolean).join(', ') || 'basic'}`)
      console.log()
    })
  } else {
    // Help
    console.log('🎨 Component Generator')
    console.log('=====================\n')
    console.log('Usage:')
    console.log('  npm run generate:component                    # Interactive mode')
    console.log('  npm run generate:component --template <name>  # Use predefined template')
    console.log('  npm run generate:component --list-templates   # List available templates')
    console.log()
    console.log('Examples:')
    console.log('  npm run generate:component --template loading-spinner')
    console.log('  npm run generate:component --template icon-button')
  }
}

// Run the generator
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Generation failed:', error)
    process.exit(1)
  })
}

export { generateComponent, COMPONENT_TEMPLATES }