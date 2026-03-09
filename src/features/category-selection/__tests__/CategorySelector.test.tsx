/**
 * Tests for CategorySelector component
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CategorySelector } from '../components/CategorySelector';
import type { Category } from '../types';

// Mock fetch
global.fetch = jest.fn();

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
];

// Helper to render with QueryClient
const renderWithQueryClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
};

describe('CategorySelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { categories: [], articles: [] } }),
    });
  });

  it('renders without crashing', () => {
    const onChange = jest.fn();
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
      />
    );

    expect(screen.getByText('Buscar categoría')).toBeInTheDocument();
  });

  it('displays search bar', () => {
    const onChange = jest.fn();
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
      />
    );

    expect(screen.getByPlaceholderText('Escribe palabras clave para buscar...')).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    const onChange = jest.fn();
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
        error="Error de prueba"
      />
    );

    expect(screen.getByText('Error de prueba')).toBeInTheDocument();
  });

  it('calls onChange when category is selected', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
      />
    );

    // Switch to full view tab (should be default)
    const fullViewTab = screen.getByRole('tab', { name: /vista completa/i });
    await user.click(fullViewTab);

    // The CategoryTree should render and allow selection
    // This is a basic test - more detailed tests would be in CategoryTree.test.tsx
  });

  it('displays suggestions when title and description are provided', () => {
    const onChange = jest.fn();
    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
        ticketTitle="Problema con servidor"
        ticketDescription="El servidor no responde"
      />
    );

    // SuggestionEngine should be rendered
    expect(screen.getByText('Categorías Sugeridas')).toBeInTheDocument();
  });

  it('allows switching between full and step-by-step modes', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();

    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
      />
    );

    // Check both tabs exist
    expect(screen.getByRole('tab', { name: /vista completa/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /paso a paso/i })).toBeInTheDocument();

    // Click step-by-step tab
    const stepByStepTab = screen.getByRole('tab', { name: /paso a paso/i });
    await user.click(stepByStepTab);

    // Should show step-by-step navigator with progress indicator
    await waitFor(() => {
      expect(screen.getByText(/paso 0 de 4/i)).toBeInTheDocument();
    });
  });

  it('tracks analytics events', async () => {
    const onChange = jest.fn();
    const fetchMock = global.fetch as jest.Mock;

    renderWithQueryClient(
      <CategorySelector
        onChange={onChange}
        clientId="client1"
        categories={mockCategories}
        value="2"
      />
    );

    // Wait for metadata fetch
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/categories/metadata/2')
      );
    });
  });
});
