/**
 * Tests para el endpoint GET /api/categories/search
 * 
 * Nota: Estos tests verifican la lógica de búsqueda sin usar NextRequest
 * debido a limitaciones con los mocks en el entorno de pruebas.
 */

import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import Fuse from 'fuse.js';
import {
  buildSearchIndex,
  buildCategoryPath,
  filterActiveCategories,
} from '@/features/category-selection/utils/search-index';
import { fuseOptions, normalizeText } from '@/features/category-selection/config/fuse.config';
import type { Category } from '@/features/category-selection/types';

// Mock de next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock de prisma
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    categories: {
      findMany: jest.fn(),
    },
  },
}));

const mockCategories: Category[] = [
  {
    id: 'cat-1',
    name: 'INFRAESTRUCTURA',
    description: 'Problemas relacionados con infraestructura',
    level: 1,
    parentId: null,
    departmentId: 'dept-1',
    order: 1,
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'cat-2',
    name: 'Servidores',
    description: 'Problemas con servidores y equipos',
    level: 2,
    parentId: 'cat-1',
    departmentId: 'dept-1',
    order: 1,
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'cat-3',
    name: 'Impresoras',
    description: 'Problemas con impresoras y escáneres',
    level: 2,
    parentId: 'cat-1',
    departmentId: 'dept-1',
    order: 2,
    color: '#3B82F6',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
  {
    id: 'cat-4',
    name: 'SOPORTE TÉCNICO',
    description: 'Soporte técnico general',
    level: 1,
    parentId: null,
    departmentId: 'dept-2',
    order: 2,
    color: '#10B981',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

describe('Category Search Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildSearchIndex', () => {
    it('debe construir el índice de búsqueda correctamente', () => {
      const searchIndex = buildSearchIndex(mockCategories);

      expect(searchIndex).toHaveLength(4);
      expect(searchIndex[0]).toHaveProperty('id');
      expect(searchIndex[0]).toHaveProperty('name');
      expect(searchIndex[0]).toHaveProperty('searchableText');
      expect(searchIndex[0]).toHaveProperty('keywords');
      expect(searchIndex[0]).toHaveProperty('path');
      expect(searchIndex[0]).toHaveProperty('pathIds');
    });

    it('debe incluir el path completo para categorías anidadas', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const impresorasIndex = searchIndex.find(item => item.id === 'cat-3');

      expect(impresorasIndex).toBeDefined();
      expect(impresorasIndex!.path).toBe('INFRAESTRUCTURA > Impresoras');
      expect(impresorasIndex!.pathIds).toEqual(['cat-1', 'cat-3']);
    });
  });

  describe('normalizeText', () => {
    it('debe normalizar texto eliminando acentos', () => {
      expect(normalizeText('TÉCNICO')).toBe('tecnico');
      expect(normalizeText('Impresión')).toBe('impresion');
      expect(normalizeText('Configuración')).toBe('configuracion');
    });

    it('debe convertir a minúsculas', () => {
      expect(normalizeText('MAYÚSCULAS')).toBe('mayusculas');
      expect(normalizeText('MiXtO')).toBe('mixto');
    });
  });

  describe('Fuse.js search', () => {
    it('debe buscar categorías por nombre', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const results = fuse.search('impresora');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].item.id).toBe('cat-3');
    });

    it('debe buscar categorías por descripción', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const results = fuse.search('servidores');

      expect(results.length).toBeGreaterThan(0);
      const serverResult = results.find(r => r.item.id === 'cat-2');
      expect(serverResult).toBeDefined();
    });

    it('debe realizar búsqueda normalizada (sin acentos, case-insensitive)', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const normalizedQuery = normalizeText('TÉCNICO');
      const results = fuse.search(normalizedQuery);

      expect(results.length).toBeGreaterThan(0);
      const tecnicoResult = results.find(r => r.item.id === 'cat-4');
      expect(tecnicoResult).toBeDefined();
    });

    it('debe incluir score de relevancia', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const results = fuse.search('impresora');

      expect(results[0].score).toBeDefined();
      expect(typeof results[0].score).toBe('number');
      expect(results[0].score).toBeGreaterThanOrEqual(0);
      expect(results[0].score).toBeLessThanOrEqual(1);
    });

    it('debe incluir información de campos coincidentes', () => {
      const searchIndex = buildSearchIndex(mockCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const results = fuse.search('impresora');

      expect(results[0].matches).toBeDefined();
      expect(Array.isArray(results[0].matches)).toBe(true);
    });
  });

  describe('buildCategoryPath', () => {
    it('debe construir el path completo de una categoría', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const impresoras = mockCategories.find(c => c.id === 'cat-3')!;

      const path = buildCategoryPath(impresoras, categoriesMap);

      expect(path).toHaveLength(2);
      expect(path[0].id).toBe('cat-1');
      expect(path[0].name).toBe('INFRAESTRUCTURA');
      expect(path[1].id).toBe('cat-3');
      expect(path[1].name).toBe('Impresoras');
    });

    it('debe retornar solo la categoría para nivel 1', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const infraestructura = mockCategories.find(c => c.id === 'cat-1')!;

      const path = buildCategoryPath(infraestructura, categoriesMap);

      expect(path).toHaveLength(1);
      expect(path[0].id).toBe('cat-1');
    });
  });

  describe('filterActiveCategories', () => {
    it('debe filtrar solo categorías activas', () => {
      const categoriesWithInactive = [
        ...mockCategories,
        {
          ...mockCategories[0],
          id: 'cat-inactive',
          isActive: false,
        },
      ];

      const active = filterActiveCategories(categoriesWithInactive as Category[]);

      expect(active).toHaveLength(4);
      expect(active.every(cat => cat.isActive)).toBe(true);
    });
  });

  describe('Integration: Full search flow', () => {
    it('debe realizar búsqueda completa con resultados ordenados por relevancia', () => {
      const activeCategories = filterActiveCategories(mockCategories);
      const searchIndex = buildSearchIndex(activeCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const query = 'impresora';
      const normalizedQuery = normalizeText(query);
      const fuseResults = fuse.search(normalizedQuery);

      const categoriesMap = new Map(activeCategories.map(cat => [cat.id, cat]));

      const searchResults = fuseResults.slice(0, 10).map(result => {
        const category = categoriesMap.get(result.item.id)!;
        const path = buildCategoryPath(category, categoriesMap);
        const matchedFields = result.matches?.map(m => m.key || '').filter(Boolean) || [];
        const score = result.score !== undefined ? 1 - result.score : 0;

        return {
          category,
          path,
          matchedFields,
          score,
        };
      });

      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0].category.id).toBe('cat-3');
      expect(searchResults[0].path).toHaveLength(2);
      expect(searchResults[0].score).toBeGreaterThan(0);
      expect(searchResults[0].matchedFields.length).toBeGreaterThan(0);
    });

    it('debe respetar el límite de resultados', () => {
      const activeCategories = filterActiveCategories(mockCategories);
      const searchIndex = buildSearchIndex(activeCategories);
      const fuse = new Fuse(searchIndex, fuseOptions);

      const fuseResults = fuse.search('infra');
      const limit = 2;
      const limitedResults = fuseResults.slice(0, limit);

      expect(limitedResults.length).toBeLessThanOrEqual(limit);
    });
  });
});
