import { render, screen, fireEvent } from '@testing-library/react'
import { PublicEquipmentCard, PublicEquipmentItem } from './PublicEquipmentCard'

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}))

const mockItem: PublicEquipmentItem = {
  id: '1',
  code: 'TECH-LAP-OWN-2024-0001',
  brand: 'Dell',
  model: 'Latitude 5420',
  condition: 'GOOD',
  photoUrl: 'https://example.com/photo.jpg',
  specifications: {
    Procesador: 'Intel Core i5',
    RAM: '16GB',
    Almacenamiento: '512GB SSD',
  },
  accessories: ['Cargador', 'Mouse', 'Maletín'],
  notes: 'Equipo en excelente estado, poco uso.',
  saleListingPrice: 850.5,
  updatedAt: '2024-01-15T10:00:00Z',
  type: {
    id: 'type-1',
    name: 'Laptop',
    family: {
      id: 'family-1',
      name: 'Tecnología',
      icon: 'laptop',
      color: '#3b82f6',
    },
  },
  contactWhatsapp: '593987654321',
}

describe('PublicEquipmentCard', () => {
  it('renders equipment basic information', () => {
    render(<PublicEquipmentCard item={mockItem} />)

    expect(screen.getByText('Dell Latitude 5420')).toBeInTheDocument()
    expect(screen.getByText('Laptop')).toBeInTheDocument()
    expect(screen.getByText('Tecnología')).toBeInTheDocument()
    expect(screen.getByText('Bueno')).toBeInTheDocument()
  })

  it('displays price when saleListingPrice is provided', () => {
    render(<PublicEquipmentCard item={mockItem} />)

    expect(screen.getByText(/850/)).toBeInTheDocument()
  })

  it('displays "Consultar precio" when saleListingPrice is null', () => {
    const itemWithoutPrice = { ...mockItem, saleListingPrice: null }
    render(<PublicEquipmentCard item={itemWithoutPrice} />)

    expect(screen.getByText('Consultar precio')).toBeInTheDocument()
  })

  it('shows WhatsApp contact button when contactWhatsapp is provided', () => {
    render(<PublicEquipmentCard item={mockItem} />)

    const whatsappLink = screen.getByRole('link', { name: /Contactar por WhatsApp/i })
    expect(whatsappLink).toBeInTheDocument()
    expect(whatsappLink).toHaveAttribute('href', expect.stringContaining('wa.me'))
    expect(whatsappLink).toHaveAttribute('target', '_blank')
  })

  it('shows login link when contactWhatsapp is null', () => {
    const itemWithoutWhatsapp = { ...mockItem, contactWhatsapp: null }
    render(<PublicEquipmentCard item={itemWithoutWhatsapp} />)

    const loginLink = screen.getByRole('link', { name: /Contactar/i })
    expect(loginLink).toBeInTheDocument()
    expect(loginLink).toHaveAttribute('href', '/login')
  })

  it('expands to show specifications when toggle is clicked', () => {
    const onToggleExpand = jest.fn()
    render(<PublicEquipmentCard item={mockItem} onToggleExpand={onToggleExpand} />)

    const expandButton = screen.getByRole('button', { name: /Ver detalles/i })
    fireEvent.click(expandButton)

    expect(onToggleExpand).toHaveBeenCalledTimes(1)
  })

  it('shows specifications in expanded mode', () => {
    render(<PublicEquipmentCard item={mockItem} expanded={true} />)

    expect(screen.getByText('Especificaciones')).toBeInTheDocument()
    expect(screen.getByText('Procesador:')).toBeInTheDocument()
    expect(screen.getByText('Intel Core i5')).toBeInTheDocument()
    expect(screen.getByText('RAM:')).toBeInTheDocument()
    expect(screen.getByText('16GB')).toBeInTheDocument()
  })

  it('shows accessories in expanded mode', () => {
    render(<PublicEquipmentCard item={mockItem} expanded={true} />)

    expect(screen.getByText('Accesorios incluidos')).toBeInTheDocument()
    expect(screen.getByText('Cargador')).toBeInTheDocument()
    expect(screen.getByText('Mouse')).toBeInTheDocument()
    expect(screen.getByText('Maletín')).toBeInTheDocument()
  })

  it('shows notes in expanded mode', () => {
    render(<PublicEquipmentCard item={mockItem} expanded={true} />)

    expect(screen.getByText('Observaciones')).toBeInTheDocument()
    expect(screen.getByText('Equipo en excelente estado, poco uso.')).toBeInTheDocument()
  })

  it('does not show expand button when no expandable content', () => {
    const itemWithoutDetails = {
      ...mockItem,
      specifications: null,
      accessories: null,
      notes: null,
    }
    render(<PublicEquipmentCard item={itemWithoutDetails} onToggleExpand={jest.fn()} />)

    expect(screen.queryByRole('button', { name: /Ver detalles/i })).not.toBeInTheDocument()
  })

  it('renders placeholder when no photo is available', () => {
    const itemWithoutPhoto = { ...mockItem, photoUrl: null }
    const { container } = render(<PublicEquipmentCard item={itemWithoutPhoto} />)

    // Check for the Package icon (placeholder)
    const packageIcon = container.querySelector('svg')
    expect(packageIcon).toBeInTheDocument()
  })

  it('applies correct condition badge styling', () => {
    const { rerender } = render(<PublicEquipmentCard item={mockItem} />)
    expect(screen.getByText('Bueno')).toBeInTheDocument()

    const newItem = { ...mockItem, condition: 'NEW' as const }
    rerender(<PublicEquipmentCard item={newItem} />)
    expect(screen.getByText('Nuevo')).toBeInTheDocument()

    const likeNewItem = { ...mockItem, condition: 'LIKE_NEW' as const }
    rerender(<PublicEquipmentCard item={likeNewItem} />)
    expect(screen.getByText('Como Nuevo')).toBeInTheDocument()

    const fairItem = { ...mockItem, condition: 'FAIR' as const }
    rerender(<PublicEquipmentCard item={fairItem} />)
    expect(screen.getByText('Regular')).toBeInTheDocument()

    const poorItem = { ...mockItem, condition: 'POOR' as const }
    rerender(<PublicEquipmentCard item={poorItem} />)
    expect(screen.getByText('Malo')).toBeInTheDocument()
  })

  it('displays "En venta" badge', () => {
    render(<PublicEquipmentCard item={mockItem} />)

    expect(screen.getByText('En venta')).toBeInTheDocument()
  })
})
