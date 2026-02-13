/**
 * Accessibility Components Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ScreenReaderOnly,
  SkipLink,
  AccessibleButton,
  AccessibleInput,
  AccessibleDialog,
  AccessibleTabs,
  AccessibleAlert,
  AccessibleDropdown,
} from '@/components/ui/accessibility-components'

describe('ScreenReaderOnly', () => {
  it('renders content with sr-only class', () => {
    render(<ScreenReaderOnly>Screen reader content</ScreenReaderOnly>)
    
    const element = screen.getByText('Screen reader content')
    expect(element).toHaveClass('sr-only')
  })

  it('renders with custom component', () => {
    render(
      <ScreenReaderOnly as="div">
        Screen reader content
      </ScreenReaderOnly>
    )
    
    const element = screen.getByText('Screen reader content')
    expect(element.tagName).toBe('DIV')
  })

  it('applies custom className', () => {
    render(
      <ScreenReaderOnly className="custom-class">
        Screen reader content
      </ScreenReaderOnly>
    )
    
    const element = screen.getByText('Screen reader content')
    expect(element).toHaveClass('sr-only', 'custom-class')
  })
})

describe('SkipLink', () => {
  it('renders skip link with correct attributes', () => {
    render(<SkipLink href="#main">Skip to main content</SkipLink>)
    
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveAttribute('href', '#main')
    expect(link).toHaveClass('sr-only')
  })

  it('becomes visible on focus', () => {
    render(<SkipLink href="#main">Skip to main content</SkipLink>)
    
    const link = screen.getByRole('link', { name: 'Skip to main content' })
    expect(link).toHaveClass('focus:not-sr-only')
  })
})

describe('AccessibleButton', () => {
  it('renders button with correct attributes', () => {
    render(<AccessibleButton>Click me</AccessibleButton>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('min-h-[44px]') // Touch-friendly
  })

  it('applies correct variant classes', () => {
    const { rerender } = render(
      <AccessibleButton variant="primary">Primary</AccessibleButton>
    )
    
    let button = screen.getByRole('button', { name: 'Primary' })
    expect(button).toHaveClass('bg-blue-600', 'text-white')
    
    rerender(<AccessibleButton variant="outline">Outline</AccessibleButton>)
    
    button = screen.getByRole('button', { name: 'Outline' })
    expect(button).toHaveClass('border', 'border-gray-300')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(
      <AccessibleButton size="sm">Small</AccessibleButton>
    )
    
    let button = screen.getByRole('button', { name: 'Small' })
    expect(button).toHaveClass('h-8', 'px-3', 'text-sm')
    
    rerender(<AccessibleButton size="lg">Large</AccessibleButton>)
    
    button = screen.getByRole('button', { name: 'Large' })
    expect(button).toHaveClass('h-12', 'px-6', 'text-lg')
  })

  it('handles loading state', () => {
    render(
      <AccessibleButton loading loadingText="Saving...">
        Save
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText('Saving...')).toBeInTheDocument()
    expect(screen.getByText('Loading, please wait')).toBeInTheDocument()
  })

  it('handles disabled state', () => {
    render(<AccessibleButton disabled>Disabled</AccessibleButton>)
    
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn()
    render(<AccessibleButton onClick={onClick}>Click me</AccessibleButton>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    await userEvent.click(button)
    
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', async () => {
    const onClick = jest.fn()
    render(
      <AccessibleButton onClick={onClick} disabled>
        Disabled
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button', { name: 'Disabled' })
    await userEvent.click(button)
    
    expect(onClick).not.toHaveBeenCalled()
  })

  it('does not call onClick when loading', async () => {
    const onClick = jest.fn()
    render(
      <AccessibleButton onClick={onClick} loading>
        Loading
      </AccessibleButton>
    )
    
    const button = screen.getByRole('button')
    await userEvent.click(button)
    
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('AccessibleInput', () => {
  it('renders input with label', () => {
    render(<AccessibleInput label="Test Input" />)
    
    const input = screen.getByRole('textbox', { name: 'Test Input' })
    const label = screen.getByText('Test Input')
    
    expect(input).toBeInTheDocument()
    expect(label).toBeInTheDocument()
    expect(input).toHaveClass('min-h-[44px]') // Touch-friendly
  })

  it('shows required indicator', () => {
    render(<AccessibleInput label="Required Field" required />)
    
    const requiredIndicator = screen.getByText('*')
    expect(requiredIndicator).toBeInTheDocument()
    expect(requiredIndicator).toHaveAttribute('aria-label', 'required')
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('displays error message', () => {
    render(
      <AccessibleInput 
        label="Test Input" 
        error="This field is required" 
      />
    )
    
    const input = screen.getByRole('textbox')
    const errorMessage = screen.getByRole('alert')
    
    expect(errorMessage).toHaveTextContent('This field is required')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby')
    expect(input).toHaveClass('border-red-300')
  })

  it('displays help text', () => {
    render(
      <AccessibleInput 
        label="Test Input" 
        helpText="This is helpful information" 
      />
    )
    
    const input = screen.getByRole('textbox')
    const helpText = screen.getByText('This is helpful information')
    
    expect(helpText).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-describedby')
  })

  it('associates label with input correctly', () => {
    render(<AccessibleInput label="Test Input" id="test-input" />)
    
    const input = screen.getByRole('textbox')
    const label = screen.getByText('Test Input')
    
    expect(input).toHaveAttribute('id', 'test-input')
    expect(label).toHaveAttribute('for', 'test-input')
  })

  it('generates unique id when not provided', () => {
    render(<AccessibleInput label="Test Input" />)
    
    const input = screen.getByRole('textbox')
    const label = screen.getByText('Test Input')
    
    const inputId = input.getAttribute('id')
    const labelFor = label.getAttribute('for')
    
    expect(inputId).toBeTruthy()
    expect(inputId).toBe(labelFor)
  })
})

describe('AccessibleDialog', () => {
  it('renders dialog when open', () => {
    render(
      <AccessibleDialog 
        isOpen={true} 
        onClose={jest.fn()} 
        title="Test Dialog"
      >
        Dialog content
      </AccessibleDialog>
    )
    
    const dialog = screen.getByRole('dialog', { name: 'Test Dialog' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('Dialog content')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(
      <AccessibleDialog 
        isOpen={false} 
        onClose={jest.fn()} 
        title="Test Dialog"
      >
        Dialog content
      </AccessibleDialog>
    )
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders with description', () => {
    render(
      <AccessibleDialog 
        isOpen={true} 
        onClose={jest.fn()} 
        title="Test Dialog"
        description="This is a test dialog"
      >
        Dialog content
      </AccessibleDialog>
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-describedby')
    expect(screen.getByText('This is a test dialog')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = jest.fn()
    render(
      <AccessibleDialog 
        isOpen={true} 
        onClose={onClose} 
        title="Test Dialog"
      >
        Dialog content
      </AccessibleDialog>
    )
    
    const closeButton = screen.getByRole('button', { name: 'Close dialog' })
    await userEvent.click(closeButton)
    
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when overlay clicked', async () => {
    const onClose = jest.fn()
    const { container } = render(
      <AccessibleDialog 
        isOpen={true} 
        onClose={onClose} 
        title="Test Dialog"
        closeOnOverlayClick={true}
      >
        Dialog content
      </AccessibleDialog>
    )
    
    // Click on the overlay (the fixed inset-0 div)
    const overlay = container.querySelector('.fixed.inset-0.bg-black')!
    fireEvent.click(overlay)
    
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on overlay click when disabled', async () => {
    const onClose = jest.fn()
    const { container } = render(
      <AccessibleDialog 
        isOpen={true} 
        onClose={onClose} 
        title="Test Dialog"
        closeOnOverlayClick={false}
      >
        Dialog content
      </AccessibleDialog>
    )
    
    const overlay = container.querySelector('.fixed.inset-0.bg-black')!
    fireEvent.click(overlay)
    
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('AccessibleTabs', () => {
  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: <div>Content 1</div> },
    { id: 'tab2', label: 'Tab 2', content: <div>Content 2</div> },
    { id: 'tab3', label: 'Tab 3', content: <div>Content 3</div>, disabled: true },
  ]

  it('renders tabs with correct ARIA attributes', () => {
    render(<AccessibleTabs tabs={tabs} />)
    
    const tabList = screen.getByRole('tablist')
    const tabButtons = screen.getAllByRole('tab')
    const tabPanels = screen.getAllByRole('tabpanel', { hidden: true })
    
    expect(tabList).toBeInTheDocument()
    expect(tabButtons).toHaveLength(3)
    expect(tabPanels).toHaveLength(3)
    
    // Check first tab is selected by default
    expect(tabButtons[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabButtons[0]).toHaveAttribute('tabindex', '0')
    expect(tabButtons[1]).toHaveAttribute('aria-selected', 'false')
    expect(tabButtons[1]).toHaveAttribute('tabindex', '-1')
  })

  it('shows correct content for active tab', () => {
    render(<AccessibleTabs tabs={tabs} />)
    
    expect(screen.getByText('Content 1')).toBeVisible()
    expect(screen.queryByText('Content 2')).not.toBeVisible()
  })

  it('switches tabs when clicked', async () => {
    render(<AccessibleTabs tabs={tabs} />)
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
    await userEvent.click(tab2)
    
    expect(tab2).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Content 2')).toBeVisible()
    expect(screen.queryByText('Content 1')).not.toBeVisible()
  })

  it('handles disabled tabs', async () => {
    render(<AccessibleTabs tabs={tabs} />)
    
    const tab3 = screen.getByRole('tab', { name: 'Tab 3' })
    expect(tab3).toBeDisabled()
    
    await userEvent.click(tab3)
    
    // Should still show first tab content
    expect(screen.getByText('Content 1')).toBeVisible()
  })

  it('calls onTabChange when tab changes', async () => {
    const onTabChange = jest.fn()
    render(<AccessibleTabs tabs={tabs} onTabChange={onTabChange} />)
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
    await userEvent.click(tab2)
    
    expect(onTabChange).toHaveBeenCalledWith('tab2')
  })

  it('uses default tab when specified', () => {
    render(<AccessibleTabs tabs={tabs} defaultTab="tab2" />)
    
    const tab2 = screen.getByRole('tab', { name: 'Tab 2' })
    expect(tab2).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Content 2')).toBeVisible()
  })
})

describe('AccessibleAlert', () => {
  it('renders alert with correct role', () => {
    render(
      <AccessibleAlert type="info">
        This is an info alert
      </AccessibleAlert>
    )
    
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('This is an info alert')
    expect(alert).toHaveAttribute('aria-live', 'polite')
  })

  it('renders different alert types', () => {
    const { rerender } = render(
      <AccessibleAlert type="success">Success message</AccessibleAlert>
    )
    
    let alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-green-50', 'text-green-800')
    
    rerender(<AccessibleAlert type="error">Error message</AccessibleAlert>)
    
    alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-red-50', 'text-red-800')
    
    rerender(<AccessibleAlert type="warning">Warning message</AccessibleAlert>)
    
    alert = screen.getByRole('alert')
    expect(alert).toHaveClass('bg-yellow-50', 'text-yellow-800')
  })

  it('renders with title', () => {
    render(
      <AccessibleAlert type="info" title="Information">
        Alert content
      </AccessibleAlert>
    )
    
    expect(screen.getByText('Information')).toBeInTheDocument()
    expect(screen.getByText('Alert content')).toBeInTheDocument()
  })

  it('renders dismissible alert', async () => {
    const onDismiss = jest.fn()
    render(
      <AccessibleAlert 
        type="info" 
        dismissible 
        onDismiss={onDismiss}
      >
        Dismissible alert
      </AccessibleAlert>
    )
    
    const dismissButton = screen.getByRole('button', { name: 'Dismiss alert' })
    expect(dismissButton).toBeInTheDocument()
    
    await userEvent.click(dismissButton)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not render dismiss button when not dismissible', () => {
    render(
      <AccessibleAlert type="info">
        Non-dismissible alert
      </AccessibleAlert>
    )
    
    expect(screen.queryByRole('button', { name: 'Dismiss alert' })).not.toBeInTheDocument()
  })
})

describe('AccessibleDropdown', () => {
  const items = [
    { id: 'item1', label: 'Item 1', onClick: jest.fn() },
    { id: 'item2', label: 'Item 2', onClick: jest.fn() },
    { id: 'separator', label: '', onClick: jest.fn(), separator: true },
    { id: 'item3', label: 'Item 3', onClick: jest.fn(), disabled: true },
  ]

  beforeEach(() => {
    items.forEach(item => item.onClick.mockClear())
  })

  it('renders trigger with correct ARIA attributes', () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')
    expect(triggerContainer).toHaveAttribute('aria-haspopup', 'menu')
    expect(triggerContainer).toHaveAttribute('aria-expanded', 'false')
  })

  it('opens menu when trigger clicked', async () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')!
    await userEvent.click(triggerContainer)
    
    expect(triggerContainer).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('calls item onClick when clicked', async () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')!
    await userEvent.click(triggerContainer)
    
    const menuItem = screen.getByRole('menuitem', { name: 'Item 1' })
    await userEvent.click(menuItem)
    
    expect(items[0].onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick for disabled items', async () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')!
    await userEvent.click(triggerContainer)
    
    const disabledItem = screen.getByText('Item 3')
    await userEvent.click(disabledItem)
    
    expect(items[3].onClick).not.toHaveBeenCalled()
  })

  it('closes menu after item selection', async () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')!
    await userEvent.click(triggerContainer)
    
    const menuItem = screen.getByRole('menuitem', { name: 'Item 1' })
    await userEvent.click(menuItem)
    
    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    })
  })

  it('renders separator', async () => {
    const { container } = render(
      <AccessibleDropdown 
        trigger={<span>Menu Trigger</span>} 
        items={items} 
      />
    )
    
    const triggerContainer = container.querySelector('[role="button"]')!
    await userEvent.click(triggerContainer)
    
    const menu = screen.getByRole('menu')
    const separator = menu.querySelector('.border-t')
    expect(separator).toBeInTheDocument()
  })
})