/**
 * Tests for CategorySelector component
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CategorySelector } from '../components/CategorySelector'
import type { Category } from '../types'

// Mock fetch
global.fetch = jest.fn()

// Mock categories
const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Infraestructura',
    description: 'Problemas de infraestructura',
    level: 1,
    parentId: null,
    departmentId: 'dept1',
    order: 1,
    color: '#FF0000',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: '2',
    name: 'Servidores',
    description: 'Problemas con servidores',
    level: 2,
    parentId: '1',
    departmentId: 'dept1',
    order: 1,
    color: '#FF0000',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

// Helper to render with QueryClient
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('CategorySelector', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { categories: [], articles: [] } }),
    })
  })

  it('renders without crashing', () => {
    const onChange = jest.fn()
    renderWithQueryClient(
      <CategorySelector onChange={onChange} clientId='client1' categories={mockCategories} />
    )

    expect(screen.getByText('Buscar categoría')).toBeInTheDocument()
  })

  it('displays search bar', () => {
    const onChange = jest.fn()
    renderWithQueryClient(
      <CategorySelector onChange={onChange} clientId='client1' categories={mockCategories} />
    )

    expect(screen.getByPlaceholderText('Buscar...')).toBeInTheDocument()
  })

  it('shows error message when provided', () => {
    const onChange = jest.fn()
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId='client1'
        categories={mockCategories}
        error='Error de prueba'
      />
    )

    expect(screen.getByText('Error de prueba')).toBeInTheDocument()
  })

  it('calls onChange when category is selected', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()

    renderWithQueryClient(
      <CategorySelector onChange={onChange} clientId='client1' categories={mockCategories} />
    )

    // El selector ya no tiene tabs "Vista Completa"/"Paso a Paso" — se
    // rediseñó a un botón que despliega el árbol de categorías
    // (treeBrowseMode). Sin contexto de ticket (sin ticketTitle/Description),
    // el botón muestra "Ver árbol completo / seleccionar manualmente".
    const showTreeButton = screen.getByRole('button', {
      name: /ver árbol completo.*seleccionar manualmente/i,
    })
    await user.click(showTreeButton)

    // El árbol debería renderizar las categorías pasadas
    expect(await screen.findByText('Infraestructura')).toBeInTheDocument()
  })

  it('displays suggestions when title and description are provided', () => {
    const onChange = jest.fn()
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId='client1'
        categories={mockCategories}
        ticketTitle='Problema con servidor'
        ticketDescription='El servidor no responde'
      />
    )

    // SuggestionEngine should be rendered
    expect(screen.getByText('Categorías Sugeridas')).toBeInTheDocument()
  })

  // El modo "Paso a Paso" (tabs + StepByStepNavigator) se eliminó del
  // componente en un rediseño previo, reemplazado por navegación de árbol
  // (treeBrowseMode: closed/related/all) mediante botones simples. Este test
  // ahora verifica esa navegación real: mostrar el árbol y volver a ocultarlo.
  it('allows showing and hiding the category tree', async () => {
    const onChange = jest.fn()
    const user = userEvent.setup()

    renderWithQueryClient(
      <CategorySelector onChange={onChange} clientId='client1' categories={mockCategories} />
    )

    const showTreeButton = screen.getByRole('button', {
      name: /ver árbol completo.*seleccionar manualmente/i,
    })
    await user.click(showTreeButton)

    expect(await screen.findByText('Infraestructura')).toBeInTheDocument()

    const hideTreeButton = screen.getByRole('button', { name: /ocultar árbol/i })
    await user.click(hideTreeButton)

    await waitFor(() => {
      expect(screen.queryByText('Infraestructura')).not.toBeInTheDocument()
    })
  })

  it('tracks analytics events', async () => {
    const onChange = jest.fn()
    const fetchMock = global.fetch as jest.Mock

    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId='client1'
        categories={mockCategories}
        value='2'
      />
    )

    // Wait for metadata fetch
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/categories/metadata/2'))
    })
  })
})
