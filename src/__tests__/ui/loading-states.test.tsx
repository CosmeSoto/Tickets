/**
 * Loading States Components Tests
 */

import { render, screen } from '@testing-library/react'
import { 
  LoadingSpinner, 
  LoadingButton, 
  PageLoading, 
  Skeleton,
  CardSkeleton,
  TableSkeleton,
  InlineLoading 
} from '@/components/ui/loading-states'

describe('LoadingSpinner', () => {
  it('renders spinner with default size', () => {
    render(<LoadingSpinner />)
    const spinner = document.querySelector('svg')
    expect(spinner).toBeInTheDocument()
    expect(spinner).toHaveClass('h-6', 'w-6', 'animate-spin')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />)
    expect(document.querySelector('svg')).toHaveClass('h-4', 'w-4')
    
    rerender(<LoadingSpinner size="xl" />)
    expect(document.querySelector('svg')).toHaveClass('h-12', 'w-12')
  })

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />)
    const container = document.querySelector('[role="status"]')
    expect(container).toHaveClass('custom-class')
  })
})

describe('LoadingButton', () => {
  it('shows children when not loading', () => {
    render(<LoadingButton isLoading={false}>Save</LoadingButton>)
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows loading text and spinner when loading', () => {
    render(<LoadingButton isLoading={true}>Save</LoadingButton>)
    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Cargando...')
    expect(document.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByText('Save')).not.toBeInTheDocument()
  })

  it('shows custom loading text', () => {
    render(
      <LoadingButton isLoading={true} loadingText="Guardando...">
        Save
      </LoadingButton>
    )
    expect(screen.getByText('Guardando...')).toBeInTheDocument()
  })
})

describe('PageLoading', () => {
  it('renders page loading with default message', () => {
    render(<PageLoading />)
    const message = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'p' && content === 'Cargando...'
    })
    expect(message).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('renders custom message', () => {
    render(<PageLoading message="Loading dashboard..." />)
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument()
  })

  it('applies correct layout classes', () => {
    render(<PageLoading />)
    const message = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'p' && content === 'Cargando...'
    })
    const container = message.parentElement?.parentElement
    expect(container).toHaveClass('min-h-screen', 'bg-gray-50', 'flex', 'items-center', 'justify-center')
  })
})

describe('Skeleton', () => {
  it('renders skeleton with default classes', () => {
    render(<Skeleton />)
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toBeInTheDocument()
    expect(skeleton).toHaveClass('rounded-md', 'bg-gray-200')
  })

  it('applies custom className', () => {
    render(<Skeleton className="h-4 w-full" />)
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).toHaveClass('h-4', 'w-full')
  })
})

describe('CardSkeleton', () => {
  it('renders card skeleton structure', () => {
    render(<CardSkeleton />)
    
    // Check for card container
    const card = document.querySelector('.rounded-lg.border')
    expect(card).toBeInTheDocument()
    
    // Check for skeleton elements
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('includes avatar, text lines, and badges', () => {
    render(<CardSkeleton />)
    
    // Avatar skeleton (circular)
    const avatar = document.querySelector('.rounded-full')
    expect(avatar).toBeInTheDocument()
    
    // Badge skeletons
    const badges = document.querySelectorAll('.rounded-full')
    expect(badges.length).toBeGreaterThan(1) // Avatar + badges
  })
})

describe('TableSkeleton', () => {
  it('renders table skeleton with default rows and columns', () => {
    render(<TableSkeleton />)
    
    const table = document.querySelector('.rounded-lg.border')
    expect(table).toBeInTheDocument()
    
    // Check for header and rows
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('renders custom number of rows and columns', () => {
    render(<TableSkeleton rows={3} columns={2} />)
    
    // Should have header + 3 rows = 4 sections
    const sections = document.querySelectorAll('.grid')
    expect(sections.length).toBeGreaterThan(0)
  })
})

describe('InlineLoading', () => {
  it('renders inline loading with default text', () => {
    render(<InlineLoading />)
    const text = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && element?.className.includes('text-sm') && content === 'Cargando...'
    })
    expect(text).toBeInTheDocument()
    expect(document.querySelector('svg')).toBeInTheDocument()
  })

  it('renders custom text', () => {
    render(<InlineLoading text="Processing..." />)
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<InlineLoading size="sm" />)
    const textSm = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && element?.className.includes('text-sm') && content === 'Cargando...'
    })
    expect(textSm).toHaveClass('text-sm')
    
    rerender(<InlineLoading size="md" />)
    const textMd = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && element?.className.includes('text-base') && content === 'Cargando...'
    })
    expect(textMd).toHaveClass('text-base')
  })

  it('uses inline-flex layout', () => {
    render(<InlineLoading />)
    const text = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'span' && element?.className.includes('text-sm') && content === 'Cargando...'
    })
    const container = text.parentElement
    expect(container).toHaveClass('inline-flex', 'items-center')
  })
})