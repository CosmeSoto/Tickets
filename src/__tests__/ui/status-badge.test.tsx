/**
 * Status Badge Components Tests
 */

import { render, screen } from '@testing-library/react'
import { StatusBadge, PriorityBadge, CategoryBadge, UserBadge } from '@/components/ui/status-badge'

describe('StatusBadge', () => {
  it('renders status badge with correct label', () => {
    render(<StatusBadge status="OPEN" />)
    expect(screen.getByText('Abierto')).toBeInTheDocument()
  })

  it('renders all status variants correctly', () => {
    const statuses = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const
    const labels = ['Abierto', 'En Progreso', 'Resuelto', 'Cerrado']
    
    statuses.forEach((status, index) => {
      const { rerender } = render(<StatusBadge status={status} />)
      expect(screen.getByText(labels[index])).toBeInTheDocument()
      rerender(<div />)
    })
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<StatusBadge status="OPEN" size="sm" />)
    expect(screen.getByText('Abierto')).toHaveClass('px-2', 'py-0.5', 'text-xs')
    
    rerender(<StatusBadge status="OPEN" size="lg" />)
    expect(screen.getByText('Abierto')).toHaveClass('px-3', 'py-1', 'text-sm')
  })

  it('includes status indicator dot', () => {
    render(<StatusBadge status="OPEN" />)
    const badge = screen.getByText('Abierto').parentElement
    const dot = badge?.querySelector('.w-1\\.5')
    expect(dot).toBeInTheDocument()
  })
})

describe('PriorityBadge', () => {
  it('renders priority badge with correct label', () => {
    render(<PriorityBadge priority="HIGH" />)
    expect(screen.getByText('Alta')).toBeInTheDocument()
  })

  it('renders all priority variants correctly', () => {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
    const labels = ['Baja', 'Media', 'Alta', 'Urgente']
    
    priorities.forEach((priority, index) => {
      const { rerender } = render(<PriorityBadge priority={priority} />)
      expect(screen.getByText(labels[index])).toBeInTheDocument()
      rerender(<div />)
    })
  })

  it('includes priority icons', () => {
    const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
    const icons = ['↓', '→', '↑', '⚠']
    
    priorities.forEach((priority, index) => {
      const { rerender } = render(<PriorityBadge priority={priority} />)
      expect(screen.getByText(icons[index])).toBeInTheDocument()
      rerender(<div />)
    })
  })
})

describe('CategoryBadge', () => {
  it('renders category badge with name', () => {
    const category = { name: 'Technical Support' }
    render(<CategoryBadge category={category} />)
    expect(screen.getByText('Technical Support')).toBeInTheDocument()
  })

  it('applies custom color when provided', () => {
    const category = { name: 'Bug Report', color: '#ff0000' }
    render(<CategoryBadge category={category} />)
    
    const badge = screen.getByText('Bug Report')
    expect(badge).toHaveStyle({ backgroundColor: '#ff0000' })
  })

  it('uses default styling when no color provided', () => {
    const category = { name: 'General' }
    render(<CategoryBadge category={category} />)
    
    const badge = screen.getByText('General')
    expect(badge).toBeInTheDocument()
  })
})

describe('UserBadge', () => {
  it('renders user badge with name', () => {
    const user = { name: 'John Doe', email: 'john@example.com' }
    render(<UserBadge user={user} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('shows role when showRole is true', () => {
    const user = { name: 'Admin User', email: 'admin@example.com', role: 'ADMIN' }
    render(<UserBadge user={user} showRole={true} />)
    expect(screen.getByText('(admin)')).toBeInTheDocument()
  })

  it('includes online indicator dot', () => {
    const user = { name: 'Jane Doe' }
    render(<UserBadge user={user} />)
    
    const badge = screen.getByText('Jane Doe').parentElement
    const dot = badge?.querySelector('.bg-green-500')
    expect(dot).toBeInTheDocument()
  })

  it('sets email as title attribute', () => {
    const user = { name: 'Test User', email: 'test@example.com' }
    render(<UserBadge user={user} />)
    
    const badge = screen.getByText('Test User').closest('[title]')
    expect(badge).toHaveAttribute('title', 'test@example.com')
  })
})