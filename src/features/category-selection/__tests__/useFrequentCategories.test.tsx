/**
 * Tests para el hook useFrequentCategories
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFrequentCategories } from '../hooks/useFrequentCategories';
import type { ReactNode } from 'react';

// Mock de fetch global
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('useFrequentCategories Hook', () => {
  let queryClient: QueryClient;

  const mockAPIResponse = {
    success: true,
    data: {
      categories: [
        {
          category: {
            id: '1',
            name: 'Impresoras',
            description: 'Problemas con impresoras',
            level: 2,
            parentId: 'infra-1',
            departmentId: 'dept1',
            order: 1,
            color: '#FF0000',
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          path: [
            {
              id: 'infra-1',
              name: 'INFRAESTRUCTURA',
              description: 'Infraestructura',
              level: 1,
              parentId: null,
              departmentId: 'dept1',
              order: 1,
              color: '#FF0000',
              isActive: true,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
            {
              id: '1',
              name: 'Impresoras',
              description: 'Problemas con impresoras',
              level: 2,
              parentId: 'infra-1',
              departmentId: 'dept1',
              order: 1,
              color: '#FF0000',
              isActive: true,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
          ],
          usageCount: 5,
          lastUsed: '2024-01-15T10:00:00.000Z',
        },
        {
          category: {
            id: '2',
            name: 'Software',
            description: 'Problemas de software',
            level: 2,
            parentId: 'soporte-1',
            departmentId: 'dept2',
            order: 1,
            color: '#00FF00',
            isActive: true,
            createdAt: new Date('2024-01-01'),
            updatedAt: new Date('2024-01-01'),
          },
          path: [
            {
              id: 'soporte-1',
              name: 'SOPORTE TÉCNICO',
              description: 'Soporte técnico',
              level: 1,
              parentId: null,
              departmentId: 'dept2',
              order: 2,
              color: '#00FF00',
              isActive: true,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
            {
              id: '2',
              name: 'Software',
              description: 'Problemas de software',
              level: 2,
              parentId: 'soporte-1',
              departmentId: 'dept2',
              order: 1,
              color: '#00FF00',
              isActive: true,
              createdAt: new Date('2024-01-01'),
              updatedAt: new Date('2024-01-01'),
            },
          ],
          usageCount: 3,
          lastUsed: '2024-01-14T10:00:00.000Z',
        },
      ],
    },
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0, // Don't cache in tests
          staleTime: 0, // Always consider stale in tests
        },
      },
    });
    mockFetch.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Carga de datos', () => {
    it('debe inicializar con estado de loading', () => {
      mockFetch.mockImplementation(
        () =>
          new Promise(resolve =>
            setTimeout(() => resolve({ ok: true, json: async () => mockAPIResponse }), 100)
          )
      );

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);
      expect(result.current.frequentCategories).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it('debe cargar categorías frecuentes exitosamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.frequentCategories).toHaveLength(2);
      expect(result.current.frequentCategories[0].category.name).toBe('Impresoras');
      expect(result.current.frequentCategories[0].usageCount).toBe(5);
      expect(result.current.error).toBeNull();
    });

    it('debe incluir path completo en cada categoría', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstCategory = result.current.frequentCategories[0];
      expect(firstCategory.path).toBeDefined();
      expect(Array.isArray(firstCategory.path)).toBe(true);
      expect(firstCategory.path.length).toBe(2);
      expect(firstCategory.path[0].name).toBe('INFRAESTRUCTURA');
      expect(firstCategory.path[1].name).toBe('Impresoras');
    });

    it('debe convertir lastUsed a Date', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstCategory = result.current.frequentCategories[0];
      expect(firstCategory.lastUsed).toBeInstanceOf(Date);
    });
  });

  describe('Parámetros de consulta', () => {
    it('debe usar clientId en la URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      renderHook(() => useFrequentCategories({ clientId: 'client-123' }), { wrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('clientId=client-123');
    });

    it('debe usar límite por defecto de 5', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      renderHook(() => useFrequentCategories({ clientId: 'client-123' }), { wrapper });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=5');
    });

    it('debe usar límite personalizado', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      renderHook(() => useFrequentCategories({ clientId: 'client-123', limit: 3 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('limit=3');
    });

    it('no debe ejecutar query si enabled es false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123', enabled: false }),
        { wrapper }
      );

      // Esperar un poco para asegurar que no se ejecuta
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.frequentCategories).toEqual([]);
    });

    it('no debe ejecutar query si clientId está vacío', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(() => useFrequentCategories({ clientId: '' }), {
        wrapper,
      });

      // Esperar un poco para asegurar que no se ejecuta
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Manejo de errores', () => {
    it('debe manejar errores de red', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Network error');
      expect(result.current.frequentCategories).toEqual([]);
    });

    it('debe manejar respuestas HTTP no exitosas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ success: false, message: 'Not found' }),
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.frequentCategories).toEqual([]);
    });

    it('debe manejar respuestas con success: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          message: 'Error al obtener categorías',
        }),
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toContain('Error al obtener categorías');
    });

    it('debe manejar respuestas con categorías vacías', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            categories: [],
          },
        }),
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeNull();
      expect(result.current.frequentCategories).toEqual([]);
    });
  });

  describe('Caché con React Query', () => {
    it('debe cachear resultados', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result: result1 } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Segundo render con mismo clientId debe usar caché
      const { result: result2 } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      // No debe hacer otra llamada a fetch
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result2.current.frequentCategories).toEqual(result1.current.frequentCategories);
    });

    it('debe usar query keys diferentes para diferentes clientIds', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result: result1 } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Segundo render con diferente clientId debe hacer nueva llamada
      const { result: result2 } = renderHook(
        () => useFrequentCategories({ clientId: 'client-456' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result2.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Función refetch', () => {
    it('debe proporcionar función refetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });

    it('debe recargar datos al llamar refetch', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockAPIResponse,
      });

      const { result } = renderHook(
        () => useFrequentCategories({ clientId: 'client-123' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Llamar refetch
      result.current.refetch();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });
  });
});
