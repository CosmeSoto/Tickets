/**
 * Tests para el hook useCategorySearch
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useCategorySearch } from '../hooks/useCategorySearch';
import type { Category } from '../types';

describe('useCategorySearch Hook', () => {
  const mockCategories: Category[] = [
    {
      id: '1',
      name: 'INFRAESTRUCTURA',
      description: 'Problemas de infraestructura y hardware',
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
      description: 'Problemas con servidores y sistemas',
      level: 2,
      parentId: '1',
      departmentId: 'dept1',
      order: 1,
      color: '#FF0000',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '3',
      name: 'Impresoras',
      description: 'Problemas con impresoras y escáneres',
      level: 2,
      parentId: '1',
      departmentId: 'dept1',
      order: 2,
      color: '#FF0000',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '4',
      name: 'SOPORTE TÉCNICO',
      description: 'Soporte técnico general',
      level: 1,
      parentId: null,
      departmentId: 'dept2',
      order: 2,
      color: '#00FF00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: '5',
      name: 'Software',
      description: 'Problemas de software y aplicaciones',
      level: 2,
      parentId: '4',
      departmentId: 'dept2',
      order: 1,
      color: '#00FF00',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    // Limpiar sessionStorage antes de cada test
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('Búsqueda básica', () => {
    it('debe retornar resultados para búsquedas válidas', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('servidor');
      });

      expect(searchResults).toBeDefined();
      expect(searchResults!.length).toBeGreaterThan(0);
      expect(searchResults![0].category.name).toBe('Servidores');
    });

    it('debe retornar array vacío para consultas menores a 2 caracteres', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('a');
      });

      expect(searchResults).toEqual([]);
    });

    it('debe retornar array vacío para consultas vacías', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('');
      });

      expect(searchResults).toEqual([]);
    });

    it('debe buscar sin distinción de mayúsculas', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('IMPRESORA');
      });

      expect(searchResults!.length).toBeGreaterThan(0);
      expect(searchResults![0].category.name).toBe('Impresoras');
    });

    it('debe buscar sin acentos', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('tecnico'); // Sin acento
      });

      expect(searchResults!.length).toBeGreaterThan(0);
      expect(searchResults![0].category.name).toBe('SOPORTE TÉCNICO');
    });
  });

  describe('Resultados de búsqueda', () => {
    it('debe incluir path completo en los resultados', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('servidores');
      });

      expect(searchResults![0].path).toBeDefined();
      expect(searchResults![0].path.length).toBe(2); // INFRAESTRUCTURA > Servidores
      expect(searchResults![0].path[0].name).toBe('INFRAESTRUCTURA');
      expect(searchResults![0].path[1].name).toBe('Servidores');
    });

    it('debe incluir score de relevancia', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('servidor');
      });

      expect(searchResults![0].score).toBeDefined();
      expect(typeof searchResults![0].score).toBe('number');
      expect(searchResults![0].score).toBeGreaterThan(0);
      expect(searchResults![0].score).toBeLessThanOrEqual(1);
    });

    it('debe incluir campos coincidentes', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('servidor');
      });

      expect(searchResults![0].matchedFields).toBeDefined();
      expect(Array.isArray(searchResults![0].matchedFields)).toBe(true);
    });

    it('debe respetar el límite de resultados', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories, maxResults: 2 })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('soporte');
      });

      expect(searchResults!.length).toBeLessThanOrEqual(2);
    });

    it('debe usar threshold personalizado', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories, threshold: 0.1 })
      );

      let searchResults;
      act(() => {
        // Búsqueda con threshold más estricto
        searchResults = result.current.search('xyz');
      });

      // Con threshold más bajo (más estricto), no debería encontrar resultados
      expect(searchResults!.length).toBe(0);
    });
  });

  describe('Historial de búsquedas', () => {
    it('debe inicializar con historial vacío', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      expect(result.current.searchHistory).toEqual([]);
    });

    it('debe agregar búsquedas al historial', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('servidor');
      });

      expect(result.current.searchHistory).toContain('servidor');
    });

    it('debe evitar duplicados en el historial', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('servidor');
        result.current.search('servidor');
      });

      const serverCount = result.current.searchHistory.filter(
        item => item === 'servidor'
      ).length;
      expect(serverCount).toBe(1);
    });

    it('debe mantener máximo 10 items en el historial', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        for (let i = 0; i < 15; i++) {
          result.current.search(`query${i}`);
        }
      });

      expect(result.current.searchHistory.length).toBeLessThanOrEqual(10);
    });

    it('debe limpiar el historial', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('servidor');
        result.current.clearHistory();
      });

      expect(result.current.searchHistory).toEqual([]);
    });

    it('debe persistir historial en sessionStorage', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('servidor');
      });

      const stored = sessionStorage.getItem('category_search_history');
      expect(stored).toBeDefined();
      expect(JSON.parse(stored!)).toContain('servidor');
    });

    it('debe cargar historial desde sessionStorage al montar', () => {
      // Pre-cargar historial en sessionStorage
      sessionStorage.setItem(
        'category_search_history',
        JSON.stringify(['impresora', 'servidor'])
      );

      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      expect(result.current.searchHistory).toEqual(['impresora', 'servidor']);
    });

    it('no debe agregar búsquedas cortas al historial', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('a');
      });

      expect(result.current.searchHistory).toEqual([]);
    });
  });

  describe('Estado de búsqueda', () => {
    it('debe inicializar isSearching en false', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      expect(result.current.isSearching).toBe(false);
    });

    it('debe actualizar isSearching durante la búsqueda', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      act(() => {
        result.current.search('servidor');
      });

      // Después de la búsqueda, isSearching debe volver a false
      expect(result.current.isSearching).toBe(false);
    });
  });

  describe('Búsqueda fuzzy', () => {
    it('debe encontrar resultados con typos', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('impresra'); // Falta 'o'
      });

      expect(searchResults!.length).toBeGreaterThan(0);
      expect(searchResults![0].category.name).toBe('Impresoras');
    });

    it('debe buscar en descripciones', () => {
      const { result } = renderHook(() =>
        useCategorySearch({ categories: mockCategories })
      );

      let searchResults;
      act(() => {
        searchResults = result.current.search('hardware');
      });

      expect(searchResults!.length).toBeGreaterThan(0);
      expect(searchResults![0].category.name).toBe('INFRAESTRUCTURA');
    });
  });

  describe('Manejo de errores', () => {
    it('debe manejar sessionStorage no disponible', () => {
      // Simular sessionStorage no disponible
      const originalSessionStorage = global.sessionStorage;
      Object.defineProperty(global, 'sessionStorage', {
        value: undefined,
        writable: true,
      });

      expect(() => {
        renderHook(() => useCategorySearch({ categories: mockCategories }));
      }).not.toThrow();

      // Restaurar
      Object.defineProperty(global, 'sessionStorage', {
        value: originalSessionStorage,
        writable: true,
      });
    });
  });
});
