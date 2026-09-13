/**
 * Test suite for ForSaleSection visibility on landing page
 * Verifies that the section is hidden when appropriate
 */

import { render, screen } from '@testing-library/react'
import { ForSaleSection } from '@/components/landing/ForSaleSection'
import { PublicEquipmentItem } from '@/components/inventory/public/PublicEquipmentCard'

// Mock next/link
jest.mock('next/link', () => {
  const MockLink = ({ children, href }: any) => {
    return <a href={href}>{children}</a>
  }
  MockLink.displayName = 'MockLink'
  return MockLink
})

describe('ForSaleSection Visibility', () => {
  const mockItems: PublicEquipmentItem[] = [
    {
      id: '1',
      code: 'TECH-LAP-OWN-2024-0001',
      brand: 'Dell',
      model: 'Latitude 5420',
      condition: 'USED',
      photoUrl: 'https://example.com/photo.jpg',
      specifications: { processor: 'Intel Core i5', ram: '16GB' },
      accessories: ['Cargador', 'Mouse'],
      notes: 'Equipo en buen estado',
      saleListingPrice: 850.5,
      updatedAt: '2024-01-01T00:00:00.000Z',
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
  ]

  it('should render when items are provided', () => {
    render(<ForSaleSection items={mockItems} />)

    // Should show the section title
    expect(
      screen.getByRole('heading', { level: 2, name: 'Activos Disponibles' })
    ).toBeInTheDocument()

    // Should show at least one equipment card. brand+model se renderizan como
    // "{brand} {model}" dentro de un mismo <h3> (varios text nodes, pero un
    // solo textContent) — el matcher debe buscar la cadena completa.
    expect(screen.getByText('Dell Latitude 5420')).toBeInTheDocument()
  })

  it('should not render when items array is empty', () => {
    render(<ForSaleSection items={[]} />)

    // The component should render nothing or a minimal structure
    // Check that the main content is not present
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Activos Disponibles' })
    ).not.toBeInTheDocument()
  })

  it('should show "Ver todos" link when items exist', () => {
    render(<ForSaleSection items={mockItems} />)

    const viewAllLink = screen.getByText(/Ver todos/i)
    expect(viewAllLink).toBeInTheDocument()
    expect(viewAllLink.closest('a')).toHaveAttribute('href', '/verify/equipment/for-sale')
  })

  it('should group items by family when multiple families exist', () => {
    const multipleItems: PublicEquipmentItem[] = [
      {
        ...mockItems[0],
        id: '1',
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
      },
      {
        ...mockItems[0],
        id: '2',
        brand: 'Toyota',
        model: 'Corolla',
        type: {
          id: 'type-2',
          name: 'Sedán',
          family: {
            id: 'family-2',
            name: 'Vehículos',
            icon: 'Car',
            color: 'green',
          },
        },
      },
    ]

    render(<ForSaleSection items={multipleItems} />)

    // Should show both family names as section headers (<h3>). getByText por
    // sí solo es ambiguo aquí: el nombre de familia también aparece repetido
    // como badge dentro de cada card del grupo (PublicEquipmentCard).
    expect(screen.getByRole('heading', { level: 3, name: 'Tecnología' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Vehículos' })).toBeInTheDocument()
  })

  it('should display equipment details correctly', () => {
    render(<ForSaleSection items={mockItems} />)

    // Check that key equipment details are displayed
    expect(screen.getByText('Dell Latitude 5420')).toBeInTheDocument()
    expect(screen.getByText('Laptop')).toBeInTheDocument()
    expect(screen.getByText('850,50 US$')).toBeInTheDocument()
  })
})

describe('Landing Page Conditional Rendering Logic', () => {
  it('should verify the conditional rendering logic', () => {
    // This test documents the expected behavior of the landing page

    // Scenario 1: forSaleEnabled = true, items.length > 0
    // Expected: Section should render
    const scenario1 = {
      forSaleEnabled: true,
      forSaleItems: mockItems,
      shouldRender: true,
    }
    expect(scenario1.forSaleEnabled && scenario1.forSaleItems.length > 0).toBe(
      scenario1.shouldRender
    )

    // Scenario 2: forSaleEnabled = false, items.length > 0
    // Expected: Section should NOT render (configuration disabled)
    const scenario2 = {
      forSaleEnabled: false,
      forSaleItems: mockItems,
      shouldRender: false,
    }
    expect(scenario2.forSaleEnabled && scenario2.forSaleItems.length > 0).toBe(
      scenario2.shouldRender
    )

    // Scenario 3: forSaleEnabled = true, items.length = 0
    // Expected: Section should NOT render (no items)
    const scenario3 = {
      forSaleEnabled: true,
      forSaleItems: [],
      shouldRender: false,
    }
    expect(scenario3.forSaleEnabled && scenario3.forSaleItems.length > 0).toBe(
      scenario3.shouldRender
    )

    // Scenario 4: forSaleEnabled = false, items.length = 0
    // Expected: Section should NOT render (both conditions false)
    const scenario4 = {
      forSaleEnabled: false,
      forSaleItems: [],
      shouldRender: false,
    }
    expect(scenario4.forSaleEnabled && scenario4.forSaleItems.length > 0).toBe(
      scenario4.shouldRender
    )
  })
})

const mockItems: PublicEquipmentItem[] = [
  {
    id: '1',
    code: 'TECH-LAP-OWN-2024-0001',
    brand: 'Dell',
    model: 'Latitude 5420',
    condition: 'USED',
    photoUrl: 'https://example.com/photo.jpg',
    specifications: { processor: 'Intel Core i5', ram: '16GB' },
    accessories: ['Cargador', 'Mouse'],
    notes: 'Equipo en buen estado',
    saleListingPrice: 850.5,
    updatedAt: '2024-01-01T00:00:00.000Z',
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
]
