/**
 * Responsive Improvements Components Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { Container } from '@/components/ui/responsive-layout'
import {
  MobileNavigation,
  ResponsiveGrid,
  TouchButton,
  ResponsiveTable,
  ResponsiveForm,
  ResponsiveImage,
  ResponsiveText,
  MobileInput,
} from '@/components/ui/responsive-improvements'

// Mock useBreakpoint hook
jest.mock('@/components/ui/responsive-layout', () => ({
  ...jest.requireActual('@/components/ui/responsive-layout'),
  useBreakpoint: () => ({
    breakpoint: 'md',
    isMobile: false,
    isDesktop: true,
  }),
}))

describe('Container (Enhanced)', () => {
  it('renders children with default classes', () => {
    render(
      <Container>
        <div>Test content</div>
      </Container>
    )
    
    expect(screen.getByText('Test content')).toBeInTheDocument()
    const container = screen.getByText('Test content').parentElement
    expect(container).toHaveClass('mx-auto', 'w-full', 'max-w-7xl')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(
      <Container size="sm">
        <div>Content</div>
      </Container>
    )
    
    let container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('max-w-2xl')
    
    rerender(
      <Container size="full">
        <div>Content</div>
      </Container>
    )
    
    container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('max-w-full')
  })

  it('applies correct padding classes', () => {
    const { rerender } = render(
      <Container padding="sm">
        <div>Content</div>
      </Container>
    )
    
    let container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('px-4', 'sm:px-6')
    
    rerender(
      <Container padding="none">
        <div>Content</div>
      </Container>
    )
    
    container = screen.getByText('Content').parentElement
    expect(container).not.toHaveClass('px-4')
  })
})

describe('MobileNavigation', () => {
  it('renders mobile menu button', () => {
    const onToggle = jest.fn()
    render(
      <MobileNavigation isOpen={false} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    const button = screen.getByRole('button', { name: /toggle navigation menu/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles menu visibility', () => {
    const onToggle = jest.fn()
    const { rerender } = render(
      <MobileNavigation isOpen={false} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    // When closed, the menu container should be hidden
    const menuContainer = screen.getByText('Menu content').closest('.md\\:hidden')
    expect(menuContainer).toHaveClass('hidden')
    
    rerender(
      <MobileNavigation isOpen={true} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    // When open, the menu container should be visible
    const openMenuContainer = screen.getByText('Menu content').closest('.md\\:hidden')
    expect(openMenuContainer).toHaveClass('block')
  })

  it('calls onToggle when button is clicked', () => {
    const onToggle = jest.fn()
    render(
      <MobileNavigation isOpen={false} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    const button = screen.getByRole('button', { name: /toggle navigation menu/i })
    fireEvent.click(button)
    
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows correct icon based on open state', () => {
    const onToggle = jest.fn()
    const { rerender } = render(
      <MobileNavigation isOpen={false} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    // Check for hamburger icon (3 lines)
    let svg = screen.getByRole('button').querySelector('svg')
    let paths = svg?.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths?.[0]).toHaveAttribute('d', 'M4 6h16M4 12h16M4 18h16')
    
    rerender(
      <MobileNavigation isOpen={true} onToggle={onToggle}>
        <div>Menu content</div>
      </MobileNavigation>
    )
    
    // Check for close icon (X)
    svg = screen.getByRole('button').querySelector('svg')
    paths = svg?.querySelectorAll('path')
    expect(paths).toHaveLength(1)
    expect(paths?.[0]).toHaveAttribute('d', 'M6 18L18 6M6 6l12 12')
  })
})

describe('ResponsiveGrid', () => {
  it('renders children in grid layout', () => {
    render(
      <ResponsiveGrid>
        <div>Item 1</div>
        <div>Item 2</div>
      </ResponsiveGrid>
    )
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
    
    const grid = screen.getByText('Item 1').parentElement
    expect(grid).toHaveClass('grid', 'w-full')
  })

  it('applies correct gap classes', () => {
    const { rerender } = render(
      <ResponsiveGrid gap="sm">
        <div>Item</div>
      </ResponsiveGrid>
    )
    
    let grid = screen.getByText('Item').parentElement
    expect(grid).toHaveClass('gap-3')
    
    rerender(
      <ResponsiveGrid gap="xl">
        <div>Item</div>
      </ResponsiveGrid>
    )
    
    grid = screen.getByText('Item').parentElement
    expect(grid).toHaveClass('gap-12')
  })

  it('applies custom grid template columns', () => {
    render(
      <ResponsiveGrid minItemWidth="200px">
        <div>Item</div>
      </ResponsiveGrid>
    )
    
    const grid = screen.getByText('Item').parentElement
    expect(grid).toHaveStyle({
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))',
    })
  })
})

describe('TouchButton', () => {
  it('renders button with touch-friendly sizing', () => {
    render(<TouchButton>Click me</TouchButton>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button).toHaveClass('min-h-[44px]', 'touch-manipulation')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<TouchButton size="sm">Small</TouchButton>)
    
    let button = screen.getByRole('button', { name: 'Small' })
    expect(button).toHaveClass('min-h-[40px]', 'text-sm')
    
    rerender(<TouchButton size="lg">Large</TouchButton>)
    
    button = screen.getByRole('button', { name: 'Large' })
    expect(button).toHaveClass('min-h-[48px]', 'text-lg')
  })

  it('applies correct variant classes', () => {
    const { rerender } = render(<TouchButton variant="primary">Primary</TouchButton>)
    
    let button = screen.getByRole('button', { name: 'Primary' })
    expect(button).toHaveClass('bg-blue-600', 'text-white')
    
    rerender(<TouchButton variant="outline">Outline</TouchButton>)
    
    button = screen.getByRole('button', { name: 'Outline' })
    expect(button).toHaveClass('border', 'border-gray-300')
  })

  it('handles click events', () => {
    const onClick = jest.fn()
    render(<TouchButton onClick={onClick}>Click me</TouchButton>)
    
    const button = screen.getByRole('button', { name: 'Click me' })
    fireEvent.click(button)
    
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('handles disabled state', () => {
    render(<TouchButton disabled>Disabled</TouchButton>)
    
    const button = screen.getByRole('button', { name: 'Disabled' })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50', 'disabled:pointer-events-none')
  })
})

describe('ResponsiveTable', () => {
  it('renders table with responsive wrapper', () => {
    render(
      <ResponsiveTable>
        <table>
          <tbody>
            <tr>
              <td>Cell content</td>
            </tr>
          </tbody>
        </table>
      </ResponsiveTable>
    )
    
    expect(screen.getByText('Cell content')).toBeInTheDocument()
    
    const wrapper = screen.getByText('Cell content').closest('.overflow-x-auto')
    expect(wrapper).toBeInTheDocument()
    expect(wrapper).toHaveClass('overflow-x-auto', '-mx-4', 'sm:mx-0')
  })
})

describe('ResponsiveForm', () => {
  it('renders form with responsive grid', () => {
    render(
      <ResponsiveForm>
        <div>Field 1</div>
        <div>Field 2</div>
      </ResponsiveForm>
    )
    
    expect(screen.getByText('Field 1')).toBeInTheDocument()
    expect(screen.getByText('Field 2')).toBeInTheDocument()
    
    const form = screen.getByText('Field 1').parentElement
    expect(form).toHaveClass('grid', 'w-full')
  })

  it('applies correct column classes', () => {
    const { rerender } = render(
      <ResponsiveForm columns={2}>
        <div>Field</div>
      </ResponsiveForm>
    )
    
    let form = screen.getByText('Field').parentElement
    expect(form).toHaveClass('grid-cols-1', 'md:grid-cols-2')
    
    rerender(
      <ResponsiveForm columns={3}>
        <div>Field</div>
      </ResponsiveForm>
    )
    
    form = screen.getByText('Field').parentElement
    expect(form).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3')
  })
})

describe('ResponsiveImage', () => {
  it('renders image with responsive wrapper', () => {
    render(
      <ResponsiveImage
        src="/test-image.jpg"
        alt="Test image"
      />
    )
    
    const img = screen.getByAltText('Test image')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', '/test-image.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    
    const wrapper = img.parentElement
    expect(wrapper).toHaveClass('relative', 'overflow-hidden', 'rounded-lg')
  })

  it('applies correct aspect ratio classes', () => {
    const { rerender } = render(
      <ResponsiveImage
        src="/test.jpg"
        alt="Test"
        aspectRatio="square"
      />
    )
    
    let wrapper = screen.getByAltText('Test').parentElement
    expect(wrapper).toHaveClass('aspect-square')
    
    rerender(
      <ResponsiveImage
        src="/test.jpg"
        alt="Test"
        aspectRatio="wide"
      />
    )
    
    wrapper = screen.getByAltText('Test').parentElement
    expect(wrapper).toHaveClass('aspect-[21/9]')
  })
})

describe('ResponsiveText', () => {
  it('renders text with responsive wrapper', () => {
    render(
      <ResponsiveText>
        This is responsive text content.
      </ResponsiveText>
    )
    
    expect(screen.getByText('This is responsive text content.')).toBeInTheDocument()
    
    const wrapper = screen.getByText('This is responsive text content.')
    expect(wrapper).toHaveClass('text-base', 'leading-relaxed')
  })

  it('applies correct max width classes', () => {
    const { rerender } = render(
      <ResponsiveText maxWidth="sm">
        Text content
      </ResponsiveText>
    )
    
    let wrapper = screen.getByText('Text content')
    expect(wrapper).toHaveClass('max-w-sm')
    
    rerender(
      <ResponsiveText maxWidth="none">
        Text content
      </ResponsiveText>
    )
    
    wrapper = screen.getByText('Text content')
    expect(wrapper).not.toHaveClass('max-w-sm')
  })
})

describe('MobileInput', () => {
  it('renders input with mobile styling', () => {
    render(
      <MobileInput
        label="Test Input"
        placeholder="Enter text"
      />
    )
    
    const input = screen.getByPlaceholderText('Enter text')
    expect(input).toBeInTheDocument()
    expect(input).toHaveClass('min-h-[44px]', 'text-base')
    
    const label = screen.getByText('Test Input')
    expect(label).toBeInTheDocument()
  })

  it('shows error message when provided', () => {
    render(
      <MobileInput
        label="Test Input"
        error="This field is required"
      />
    )
    
    const errorMessage = screen.getByText('This field is required')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveClass('text-red-600')
    expect(errorMessage).toHaveAttribute('role', 'alert')
    
    const input = screen.getByRole('textbox')
    expect(input).toHaveClass('border-red-300')
  })

  it('shows help text when provided and no error', () => {
    render(
      <MobileInput
        label="Test Input"
        helpText="This is helpful information"
      />
    )
    
    const helpText = screen.getByText('This is helpful information')
    expect(helpText).toBeInTheDocument()
    expect(helpText).toHaveClass('text-gray-500')
  })

  it('associates label with input correctly', () => {
    render(
      <MobileInput
        label="Test Input"
        id="test-input"
      />
    )
    
    const input = screen.getByRole('textbox')
    const label = screen.getByText('Test Input')
    
    expect(input).toHaveAttribute('id', 'test-input')
    expect(label).toHaveAttribute('for', 'test-input')
  })

  it('generates unique id when not provided', () => {
    render(<MobileInput label="Test Input" />)
    
    const input = screen.getByRole('textbox')
    const label = screen.getByText('Test Input')
    
    const inputId = input.getAttribute('id')
    const labelFor = label.getAttribute('for')
    
    expect(inputId).toBeTruthy()
    expect(inputId).toBe(labelFor)
  })
})