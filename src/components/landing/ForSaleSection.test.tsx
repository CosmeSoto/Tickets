import { render, screen } from '@testing-library/react'
import { ForSaleSection } from './ForSaleSection'
import { PublicEquipmentItem } from '@/components/inventory/public/PublicEquipmentCard'

// Mock the PublicEquipmentCard component
jest.mock('@/components/inventory/public/PublicEquipmentCard', () => ({
  PublicEquipmentCard: ({ item }: { item: PublicEquipmentItem }) => (
    <div data-testid={`equipment-card-${item.id}`}>
      {item.brand} {item.model}
    </div>
  ),
}))

// Mock Next.js Link component
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('ForSaleSection', () => {
  const mockItems: PublicEquipmentItem[] = [
    {
      id: '1',
      code: 'TECH-001',
      brand: 'Dell',
      model: 'Latitude 5420',
      condition: 'GOOD',
      photoUrl: null,
      specifications: { RAM: '16GB', CPU: 'i7' },
      accessories: ['Cargador'],
      notes: 'Equipo en buen estado',
      saleListingPrice: 850.0,
      updatedAt: '2024-01-01T00:00:00Z',
      type: {
        id: 'type-1',
        name: 'Laptop',
        family: {
          id: 'family-1',
          name: 'Tecnología',
          icon: 'Laptop',
          color: 'blue',
        },
      },
      contactWhatsapp: '593987654321',
    },
    {
      id: '2',
      code: 'TECH-002',
      brand: 'HP',
      model: 'EliteBook 840',
      condition: 'LIKE_NEW',
      photoUrl: null,
      specifications: { RAM: '32GB', CPU: 'i9' },
      accessories: ['Cargador', 'Mouse'],
      notes: null,
      saleListingPrice: 1200.0,
      updatedAt: '2024-01-02T00:00:00Z',
      type: {
        id: 'type-1',
        name: 'Laptop',
        family: {
          id: 'family-1',
          name: 'Tecnología',
          icon: 'Laptop',
          color: 'blue',
        },
      },
      contactWhatsapp: '593987654321',
    },
    {
      id: '3',
      code: 'VEH-001',
      brand: 'Toyota',
      model: 'Hilux 2020',
      condition: 'GOOD',
      photoUrl: null,
      specifications: { Motor: '2.8L', Transmisión: 'Automática' },
      accessories: ['Llantas de repuesto'],
      notes: 'Vehículo en excelente estado',
      saleListingPrice: 35000.0,
      updatedAt: '2024-01-03T00:00:00Z',
      type: {
        id: 'type-2',
        name: 'Camioneta',
        family: {
          id: 'family-2',
          name: 'Vehículos',
          icon: 'Truck',
          color: 'green',
        },
      },
      contactWhatsapp: '593987654322',
    },
  ]

  it('renders nothing when items array is empty', () => {
    const { container } = render(<ForSaleSection items={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders section header with correct title', () => {
    render(<ForSaleSection items={mockItems} />)
    expect(screen.getByText('Equipos en Venta')).toBeInTheDocument()
    expect(screen.getByText('Activos Disponibles')).toBeInTheDocument()
    expect(screen.getByText('Equipos de calidad disponibles para la venta')).toBeInTheDocument()
  })

  it('renders all equipment cards', () => {
    render(<ForSaleSection items={mockItems} />)
    expect(screen.getByTestId('equipment-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('equipment-card-2')).toBeInTheDocument()
    expect(screen.getByTestId('equipment-card-3')).toBeInTheDocument()
  })

  it('groups equipment by family when multiple families exist', () => {
    render(<ForSaleSection items={mockItems} />)

    // Should show family headers when there are multiple families
    expect(screen.getByText('Tecnología')).toBeInTheDocument()
    expect(screen.getByText('Vehículos')).toBeInTheDocument()
  })

  it('does not show family headers when only one family exists', () => {
    const singleFamilyItems = mockItems.slice(0, 2) // Only Tecnología items
    render(<ForSaleSection items={singleFamilyItems} />)

    // Should not show family header when there's only one family
    expect(screen.queryByText('Tecnología')).not.toBeInTheDocument()
  })

  it('renders "Ver todos" link with correct href', () => {
    render(<ForSaleSection items={mockItems} />)
    const link = screen.getByText('Ver todos los equipos →').closest('a')
    expect(link).toHaveAttribute('href', '/verify/equipment/for-sale')
  })

  it('groups items correctly by family', () => {
    render(<ForSaleSection items={mockItems} />)

    // Verify that items are grouped correctly
    const techCards = screen.getByTestId('equipment-card-1').parentElement
    const vehicleCards = screen.getByTestId('equipment-card-3').parentElement

    // Both tech items should be in the same group
    expect(techCards).toContainElement(screen.getByTestId('equipment-card-1'))
    expect(techCards).toContainElement(screen.getByTestId('equipment-card-2'))

    // Vehicle item should be in a different group
    expect(vehicleCards).toContainElement(screen.getByTestId('equipment-card-3'))
  })
})
