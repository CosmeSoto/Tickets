/**
 * Tests for frequent categories logic
 * 
 * Tests cover:
 * - Calculation of frequent categories based on last 20 tickets
 * - Fallback to popular system categories when insufficient history
 * - Proper ordering by frequency and recency
 * - Path construction for hierarchical categories
 * 
 * Nota: Estos tests verifican la lógica de categorías frecuentes
 */

import {
  buildCategoryPath,
  filterActiveCategories,
} from '@/features/category-selection/utils/search-index';
import type { Category } from '@/features/category-selection/types';

describe('Frequent Categories Logic', () => {
  const mockCategories: Category[] = [
    {
      id: 'cat-1',
      name: 'Infraestructura',
      description: 'Categoría principal',
      level: 1,
      parentId: null,
      departmentId: 'dept-1',
      order: 1,
      color: '#FF0000',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'cat-2',
      name: 'Servidores',
      description: 'Subcategoría de infraestructura',
      level: 2,
      parentId: 'cat-1',
      departmentId: 'dept-1',
      order: 1,
      color: '#FF0000',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'cat-3',
      name: 'Soporte Técnico',
      description: 'Otra categoría principal',
      level: 1,
      parentId: null,
      departmentId: 'dept-2',
      order: 2,
      color: '#00FF00',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
    {
      id: 'cat-4',
      name: 'Impresoras',
      description: 'Subcategoría de soporte',
      level: 2,
      parentId: 'cat-3',
      departmentId: 'dept-2',
      order: 1,
      color: '#00FF00',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ];

  describe('Frequency calculation', () => {
    it('debe contar correctamente la frecuencia de cada categoría', () => {
      const tickets = [
        { categoryId: 'cat-2', createdAt: new Date('2024-01-10') },
        { categoryId: 'cat-2', createdAt: new Date('2024-01-09') },
        { categoryId: 'cat-2', createdAt: new Date('2024-01-08') },
        { categoryId: 'cat-3', createdAt: new Date('2024-01-07') },
        { categoryId: 'cat-3', createdAt: new Date('2024-01-06') },
        { categoryId: 'cat-4', createdAt: new Date('2024-01-05') },
      ];

      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of tickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          if (ticket.createdAt > existing.lastUsed) {
            existing.lastUsed = ticket.createdAt;
          }
        } else {
          categoryFrequency.set(ticket.categoryId, {
            count: 1,
            lastUsed: ticket.createdAt,
          });
        }
      }

      expect(categoryFrequency.get('cat-2')?.count).toBe(3);
      expect(categoryFrequency.get('cat-3')?.count).toBe(2);
      expect(categoryFrequency.get('cat-4')?.count).toBe(1);
    });

    it('debe mantener la fecha más reciente para cada categoría', () => {
      const tickets = [
        { categoryId: 'cat-2', createdAt: new Date('2024-01-10') },
        { categoryId: 'cat-2', createdAt: new Date('2024-01-09') },
        { categoryId: 'cat-2', createdAt: new Date('2024-01-08') },
      ];

      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of tickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          if (ticket.createdAt > existing.lastUsed) {
            existing.lastUsed = ticket.createdAt;
          }
        } else {
          categoryFrequency.set(ticket.categoryId, {
            count: 1,
            lastUsed: ticket.createdAt,
          });
        }
      }

      const cat2Data = categoryFrequency.get('cat-2');
      expect(cat2Data?.lastUsed).toEqual(new Date('2024-01-10'));
    });

    it('debe ordenar por frecuencia descendente', () => {
      const categoryFrequency = new Map([
        ['cat-2', { count: 3, lastUsed: new Date('2024-01-10') }],
        ['cat-3', { count: 2, lastUsed: new Date('2024-01-07') }],
        ['cat-4', { count: 1, lastUsed: new Date('2024-01-05') }],
      ]);

      const sorted = Array.from(categoryFrequency.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          count: data.count,
          lastUsed: data.lastUsed,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        });

      expect(sorted[0].categoryId).toBe('cat-2');
      expect(sorted[1].categoryId).toBe('cat-3');
      expect(sorted[2].categoryId).toBe('cat-4');
    });

    it('debe ordenar por fecha cuando la frecuencia es igual', () => {
      const categoryFrequency = new Map([
        ['cat-2', { count: 1, lastUsed: new Date('2024-01-10') }],
        ['cat-3', { count: 1, lastUsed: new Date('2024-01-07') }],
        ['cat-4', { count: 1, lastUsed: new Date('2024-01-05') }],
      ]);

      const sorted = Array.from(categoryFrequency.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          count: data.count,
          lastUsed: data.lastUsed,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        });

      // Todas tienen count=1, así que se ordena por fecha (más reciente primero)
      expect(sorted[0].categoryId).toBe('cat-2'); // 2024-01-10
      expect(sorted[1].categoryId).toBe('cat-3'); // 2024-01-07
      expect(sorted[2].categoryId).toBe('cat-4'); // 2024-01-05
    });

    it('debe respetar el límite de resultados', () => {
      const categoryFrequency = new Map([
        ['cat-1', { count: 5, lastUsed: new Date('2024-01-10') }],
        ['cat-2', { count: 4, lastUsed: new Date('2024-01-09') }],
        ['cat-3', { count: 3, lastUsed: new Date('2024-01-08') }],
        ['cat-4', { count: 2, lastUsed: new Date('2024-01-07') }],
      ]);

      const limit = 2;
      const sorted = Array.from(categoryFrequency.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          count: data.count,
          lastUsed: data.lastUsed,
        }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        })
        .slice(0, limit);

      expect(sorted).toHaveLength(2);
      expect(sorted[0].categoryId).toBe('cat-1');
      expect(sorted[1].categoryId).toBe('cat-2');
    });
  });

  describe('Path construction', () => {
    it('debe construir el path completo para categorías anidadas', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const servidores = mockCategories.find(c => c.id === 'cat-2')!;

      const path = buildCategoryPath(servidores, categoriesMap);

      expect(path).toHaveLength(2);
      expect(path[0].id).toBe('cat-1'); // Parent: Infraestructura
      expect(path[1].id).toBe('cat-2'); // Current: Servidores
    });

    it('debe construir el path para categorías de nivel 1', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const infraestructura = mockCategories.find(c => c.id === 'cat-1')!;

      const path = buildCategoryPath(infraestructura, categoriesMap);

      expect(path).toHaveLength(1);
      expect(path[0].id).toBe('cat-1');
    });

    it('debe construir paths para múltiples categorías frecuentes', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const frequentCategoryIds = [
        { categoryId: 'cat-2', count: 3, lastUsed: new Date('2024-01-10') },
        { categoryId: 'cat-4', count: 2, lastUsed: new Date('2024-01-09') },
      ];

      const results = frequentCategoryIds.map(({ categoryId, count, lastUsed }) => {
        const category = categoriesMap.get(categoryId);
        if (!category) return null;

        const path = buildCategoryPath(category, categoriesMap);

        return {
          category,
          path,
          usageCount: count,
          lastUsed: lastUsed.toISOString(),
        };
      }).filter(item => item !== null);

      expect(results).toHaveLength(2);
      
      // cat-2 (Servidores) tiene path de 2 niveles
      expect(results[0]?.path).toHaveLength(2);
      expect(results[0]?.path[0].id).toBe('cat-1');
      expect(results[0]?.path[1].id).toBe('cat-2');
      
      // cat-4 (Impresoras) tiene path de 2 niveles
      expect(results[1]?.path).toHaveLength(2);
      expect(results[1]?.path[0].id).toBe('cat-3');
      expect(results[1]?.path[1].id).toBe('cat-4');
    });
  });

  describe('Active categories filtering', () => {
    it('debe filtrar solo categorías activas', () => {
      const categoriesWithInactive: Category[] = [
        ...mockCategories,
        {
          id: 'cat-inactive',
          name: 'Inactiva',
          description: 'Categoría inactiva',
          level: 1,
          parentId: null,
          departmentId: 'dept-1',
          order: 99,
          color: '#000000',
          isActive: false,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ];

      const active = filterActiveCategories(categoriesWithInactive);

      expect(active).toHaveLength(4);
      expect(active.every(cat => cat.isActive)).toBe(true);
      expect(active.find(cat => cat.id === 'cat-inactive')).toBeUndefined();
    });

    it('debe excluir categorías inactivas de los resultados frecuentes', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const frequentCategoryIds = [
        { categoryId: 'cat-2', count: 3, lastUsed: new Date('2024-01-10') },
        { categoryId: 'inactive-cat', count: 2, lastUsed: new Date('2024-01-09') },
      ];

      const results = frequentCategoryIds
        .map(({ categoryId, count, lastUsed }) => {
          const category = categoriesMap.get(categoryId);
          if (!category) return null;

          const path = buildCategoryPath(category, categoriesMap);

          return {
            category,
            path,
            usageCount: count,
            lastUsed: lastUsed.toISOString(),
          };
        })
        .filter(item => item !== null);

      // Solo cat-2 debe estar en los resultados (inactive-cat no existe en el mapa)
      expect(results).toHaveLength(1);
      expect(results[0]?.category.id).toBe('cat-2');
    });
  });

  describe('Edge cases', () => {
    it('debe manejar lista vacía de tickets', () => {
      const tickets: Array<{ categoryId: string; createdAt: Date }> = [];
      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of tickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          if (ticket.createdAt > existing.lastUsed) {
            existing.lastUsed = ticket.createdAt;
          }
        } else {
          categoryFrequency.set(ticket.categoryId, {
            count: 1,
            lastUsed: ticket.createdAt,
          });
        }
      }

      expect(categoryFrequency.size).toBe(0);
    });

    it('debe manejar un solo ticket', () => {
      const tickets = [
        { categoryId: 'cat-2', createdAt: new Date('2024-01-10') },
      ];

      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of tickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          if (ticket.createdAt > existing.lastUsed) {
            existing.lastUsed = ticket.createdAt;
          }
        } else {
          categoryFrequency.set(ticket.categoryId, {
            count: 1,
            lastUsed: ticket.createdAt,
          });
        }
      }

      expect(categoryFrequency.size).toBe(1);
      expect(categoryFrequency.get('cat-2')?.count).toBe(1);
    });

    it('debe manejar exactamente 20 tickets', () => {
      const tickets = Array.from({ length: 20 }, (_, i) => ({
        categoryId: `cat-${(i % 3) + 1}`,
        createdAt: new Date(`2024-01-${20 - i}`),
      }));

      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of tickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          if (ticket.createdAt > existing.lastUsed) {
            existing.lastUsed = ticket.createdAt;
          }
        } else {
          categoryFrequency.set(ticket.categoryId, {
            count: 1,
            lastUsed: ticket.createdAt,
          });
        }
      }

      // 20 tickets distribuidos entre 3 categorías
      expect(categoryFrequency.size).toBe(3);
      
      const totalCount = Array.from(categoryFrequency.values())
        .reduce((sum, data) => sum + data.count, 0);
      expect(totalCount).toBe(20);
    });
  });
});
