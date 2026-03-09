/**
 * Tests para el hook useCategorySuggestions
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import { useCategorySuggestions } from '../hooks/useCategorySuggestions';
import type { Category } from '../types';

describe('useCategorySuggestions Hook', () => {
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
      description: 'Problemas con servidores y sistemas operativos',
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
      description: 'Problemas con impresoras, escáneres y dispositivos de impresión',
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
      description: 'Soporte técnico general y aplicaciones',
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
      description: 'Problemas de software, aplicaciones y programas',
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
    jest.clearAllTimers();
  });

  describe('Análisis básico', () => {
    it('debe inicializar con sugerencias vacías', () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: '',
          description: '',
        })
      );

      expect(result.current.suggestions).toEqual([]);
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('debe generar sugerencias basadas en el título', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'No puedo imprimir documentos',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.category.name).toBe('Impresoras');
    });

    it('debe generar sugerencias basadas en la descripción', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: '',
          description: 'El servidor no responde y no puedo acceder a los sistemas',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.category.name).toBe('Servidores');
    });

    it('debe combinar título y descripción para sugerencias', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con aplicación',
          description: 'El software no abre correctamente',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.category.name).toBe('Software');
    });

    it('no debe generar sugerencias para texto muy corto', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'ab',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.isAnalyzing).toBe(false);
        },
        { timeout: 200 }
      );

      expect(result.current.suggestions).toEqual([]);
    });
  });

  describe('Estructura de sugerencias', () => {
    it('debe incluir path completo en cada sugerencia', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con servidor',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.path).toBeDefined();
      expect(Array.isArray(suggestion.path)).toBe(true);
      expect(suggestion.path.length).toBeGreaterThan(0);
    });

    it('debe incluir score de relevancia', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.relevanceScore).toBeDefined();
      expect(typeof suggestion.relevanceScore).toBe('number');
      expect(suggestion.relevanceScore).toBeGreaterThan(0);
      expect(suggestion.relevanceScore).toBeLessThanOrEqual(1);
    });

    it('debe incluir palabras clave coincidentes', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.matchedKeywords).toBeDefined();
      expect(Array.isArray(suggestion.matchedKeywords)).toBe(true);
    });

    it('debe incluir razón de la sugerencia', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.reason).toBeDefined();
      expect(typeof suggestion.reason).toBe('string');
      expect(suggestion.reason.length).toBeGreaterThan(0);
    });
  });

  describe('Ordenamiento y límites', () => {
    it('debe ordenar sugerencias por relevancia', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora y dispositivos de impresión',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      // Verificar que están ordenadas por score descendente
      for (let i = 0; i < result.current.suggestions.length - 1; i++) {
        expect(result.current.suggestions[i].relevanceScore).toBeGreaterThanOrEqual(
          result.current.suggestions[i + 1].relevanceScore
        );
      }
    });

    it('debe respetar el límite de sugerencias', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con sistemas y aplicaciones',
          description: '',
          debounceMs: 100,
          maxSuggestions: 2,
        })
      );

      await waitFor(
        () => {
          expect(result.current.isAnalyzing).toBe(false);
        },
        { timeout: 200 }
      );

      expect(result.current.suggestions.length).toBeLessThanOrEqual(2);
    });

    it('debe usar límite por defecto de 5 sugerencias', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema general con todo',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.isAnalyzing).toBe(false);
        },
        { timeout: 200 }
      );

      expect(result.current.suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Debounce', () => {
    it('debe aplicar debounce por defecto de 500ms', async () => {
      const { result, rerender } = renderHook(
        ({ title }) =>
          useCategorySuggestions({
            categories: mockCategories,
            title,
            description: '',
          }),
        { initialProps: { title: 'Problema' } }
      );

      // Cambiar el título rápidamente
      rerender({ title: 'Problema con impresora' });

      // No debe haber analizado inmediatamente
      expect(result.current.isAnalyzing).toBe(false);

      // Esperar el debounce
      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 600 }
      );
    });

    it('debe usar debounce personalizado', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );
    });
  });

  describe('Función refresh', () => {
    it('debe proporcionar función refresh', () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: '',
          description: '',
        })
      );

      expect(result.current.refresh).toBeDefined();
      expect(typeof result.current.refresh).toBe('function');
    });

    it('debe re-analizar al llamar refresh', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con impresora',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const initialSuggestions = result.current.suggestions;

      // Llamar refresh
      result.current.refresh();

      await waitFor(
        () => {
          expect(result.current.suggestions).toBeDefined();
        },
        { timeout: 200 }
      );

      // Debe haber re-analizado
      expect(result.current.suggestions).toEqual(initialSuggestions);
    });
  });

  describe('Stop words en español', () => {
    it('debe ignorar stop words comunes', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'El problema con la impresora de la oficina',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      // Debe encontrar "impresora" ignorando "el", "con", "la", "de"
      const suggestion = result.current.suggestions[0];
      expect(suggestion.category.name).toBe('Impresoras');
    });
  });

  describe('Normalización de texto', () => {
    it('debe normalizar acentos', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'Problema con aplicación',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      // Debe encontrar "aplicaciones" aunque se escribió "aplicación"
      expect(result.current.suggestions.some(s => 
        s.category.name === 'Software' || s.category.name === 'SOPORTE TÉCNICO'
      )).toBe(true);
    });

    it('debe ser case-insensitive', async () => {
      const { result } = renderHook(() =>
        useCategorySuggestions({
          categories: mockCategories,
          title: 'PROBLEMA CON IMPRESORA',
          description: '',
          debounceMs: 100,
        })
      );

      await waitFor(
        () => {
          expect(result.current.suggestions.length).toBeGreaterThan(0);
        },
        { timeout: 200 }
      );

      const suggestion = result.current.suggestions[0];
      expect(suggestion.category.name).toBe('Impresoras');
    });
  });
});
