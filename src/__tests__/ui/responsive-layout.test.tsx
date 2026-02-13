/**
 * Responsive Layout Components Tests
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { renderHook, act } from '@testing-library/react'
import { 
  Container,
  Grid,
  Flex,
  Stack,
  Responsive,
  Section,
  useBreakpoint,
  useMediaQuery
} from '@/components/ui/responsive-layout'

// Mock window.matchMedia for useMediaQuery tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

describe('Container', () => {
  it('renders children with default size', () => {
    render(
      <Container>
        <div>Test content</div>
      </Container>
    )
    expect(screen.getByText('Test content')).toBeInTheDocument()
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

  it('applies responsive padding classes', () => {
    render(
      <Container>
        <div>Content</div>
      </Container>
    )
    
    const container = screen.getByText('Content').parentElement
    expect(container).toHaveClass('mx-auto', 'px-4', 'sm:px-6', 'lg:px-8')
  })
})

describe('Grid', () => {
  it('renders children in grid layout', () => {
    render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    )
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('applies correct column classes', () => {
    const { rerender } = render(
      <Grid cols={2}>
        <div>Content</div>
      </Grid>
    )
    
    let grid = screen.getByText('Content').parentElement
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2')
    
    rerender(
      <Grid cols={4}>
        <div>Content</div>
      </Grid>
    )
    
    grid = screen.getByText('Content').parentElement
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-4')
  })

  it('applies correct gap classes', () => {
    const { rerender } = render(
      <Grid gap="sm">
        <div>Content</div>
      </Grid>
    )
    
    let grid = screen.getByText('Content').parentElement
    expect(grid).toHaveClass('gap-3')
    
    rerender(
      <Grid gap="xl">
        <div>Content</div>
      </Grid>
    )
    
    grid = screen.getByText('Content').parentElement
    expect(grid).toHaveClass('gap-12')
  })
})

describe('Flex', () => {
  it('renders children in flex layout', () => {
    render(
      <Flex>
        <div>Item 1</div>
        <div>Item 2</div>
      </Flex>
    )
    
    const flex = screen.getByText('Item 1').parentElement
    expect(flex).toHaveClass('flex')
  })

  it('applies direction classes', () => {
    const { rerender } = render(
      <Flex direction="col">
        <div>Content</div>
      </Flex>
    )
    
    let flex = screen.getByText('Content').parentElement
    expect(flex).toHaveClass('flex-col')
    
    rerender(
      <Flex direction="row">
        <div>Content</div>
      </Flex>
    )
    
    flex = screen.getByText('Content').parentElement
    expect(flex).toHaveClass('flex-row')
  })

  it('applies alignment classes', () => {
    render(
      <Flex align="center" justify="between">
        <div>Content</div>
      </Flex>
    )
    
    const flex = screen.getByText('Content').parentElement
    expect(flex).toHaveClass('items-center', 'justify-between')
  })

  it('applies wrap class when wrap is true', () => {
    render(
      <Flex wrap={true}>
        <div>Content</div>
      </Flex>
    )
    
    const flex = screen.getByText('Content').parentElement
    expect(flex).toHaveClass('flex-wrap')
  })
})

describe('Stack', () => {
  it('renders children with vertical spacing', () => {
    render(
      <Stack>
        <div>Item 1</div>
        <div>Item 2</div>
      </Stack>
    )
    
    const stack = screen.getByText('Item 1').parentElement
    expect(stack).toHaveClass('space-y-4') // default md spacing
  })

  it('applies correct spacing classes', () => {
    const { rerender } = render(
      <Stack space="sm">
        <div>Content</div>
      </Stack>
    )
    
    let stack = screen.getByText('Content').parentElement
    expect(stack).toHaveClass('space-y-2')
    
    rerender(
      <Stack space="xl">
        <div>Content</div>
      </Stack>
    )
    
    stack = screen.getByText('Content').parentElement
    expect(stack).toHaveClass('space-y-8')
  })
})

describe('Responsive', () => {
  it('applies show classes correctly', () => {
    render(
      <Responsive show="md">
        <div>Content</div>
      </Responsive>
    )
    
    const responsive = screen.getByText('Content').parentElement
    expect(responsive).toHaveClass('hidden', 'md:block')
  })

  it('applies hide classes correctly', () => {
    render(
      <Responsive hide="sm">
        <div>Content</div>
      </Responsive>
    )
    
    const responsive = screen.getByText('Content').parentElement
    expect(responsive).toHaveClass('sm:hidden')
  })
})

describe('Section', () => {
  it('renders children with default spacing', () => {
    render(
      <Section>
        <div>Section content</div>
      </Section>
    )
    
    expect(screen.getByText('Section content')).toBeInTheDocument()
    const section = screen.getByText('Section content').parentElement
    expect(section).toHaveClass('space-y-6')
  })

  it('renders title and subtitle when provided', () => {
    render(
      <Section title="Section Title" subtitle="Section subtitle">
        <div>Content</div>
      </Section>
    )
    
    expect(screen.getByText('Section Title')).toBeInTheDocument()
    expect(screen.getByText('Section subtitle')).toBeInTheDocument()
  })

  it('renders actions when provided', () => {
    const actions = <button>Action Button</button>
    render(
      <Section actions={actions}>
        <div>Content</div>
      </Section>
    )
    
    expect(screen.getByText('Action Button')).toBeInTheDocument()
  })

  it('applies correct title styling', () => {
    render(
      <Section title="Test Title">
        <div>Content</div>
      </Section>
    )
    
    const title = screen.getByText('Test Title')
    expect(title).toHaveClass('text-2xl', 'font-bold', 'tracking-tight', 'text-gray-900')
  })
})

describe('useBreakpoint', () => {
  // Mock window.innerWidth
  const mockInnerWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    })
  }

  it('returns correct breakpoint for different screen sizes', () => {
    // Test small screen
    mockInnerWidth(500)
    const { result: smallResult } = renderHook(() => useBreakpoint())
    expect(smallResult.current.breakpoint).toBe('sm')
    expect(smallResult.current.isSm).toBe(true)
    expect(smallResult.current.isMobile).toBe(true)
    expect(smallResult.current.isDesktop).toBe(false)
  })

  it('provides utility boolean properties', () => {
    // Test with default values (should be md by default in test environment)
    const { result } = renderHook(() => useBreakpoint())
    
    // Check that the hook returns the expected structure
    expect(typeof result.current.breakpoint).toBe('string')
    expect(typeof result.current.isSm).toBe('boolean')
    expect(typeof result.current.isMd).toBe('boolean')
    expect(typeof result.current.isLg).toBe('boolean')
    expect(typeof result.current.isXl).toBe('boolean')
    expect(typeof result.current.is2Xl).toBe('boolean')
    expect(typeof result.current.isMobile).toBe('boolean')
    expect(typeof result.current.isDesktop).toBe('boolean')
  })
})

describe('useMediaQuery', () => {
  it('returns false by default', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(result.current).toBe(false)
  })

  it('uses matchMedia to determine matches', () => {
    const mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(min-width: 768px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))

    window.matchMedia = mockMatchMedia

    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'))
    expect(mockMatchMedia).toHaveBeenCalledWith('(min-width: 768px)')
  })
})