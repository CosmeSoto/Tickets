/**
 * Tests para utilidades de índice de búsqueda
 */

import { describe, it, expect } from '@jest/globals';
import {
  buildCategoryPath,
  buildSearchIndex,
  filterActiveCategories,
} from '../utils/search-index';
import { normalizeText, extractKeywords } from '../config/fuse.config';
import type { Category } from '../types';

describe('Category Selection - Search Index Utils', () => {
  const mockCategories: Category[] = [
    {
      id: '1',
      name: 'INFRAESTRUCTURA',
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
    {
      id: '3',
      name: 'Impresoras',
      description: 'Problemas con impresoras',
      level: 2,
      parentId: '1',
      departmentId: 'dept1',
      order: 2,
      color: '#FF0000',
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  describe('normalizeText', () => {
    it('debe convertir a minúsculas', () => {
      expect(normalizeText('HOLA')).toBe('hola');
    });

    it('debe eliminar acentos', () => {
      expect(normalizeText('áéíóú')).toBe('aeiou');
      expect(normalizeText('ñ')).toBe('n'); // NFD normaliza ñ también
    });

    it('debe manejar texto mixto', () => {
      expect(normalizeText('Configuración')).toBe('configuracion');
    });
  });

  describe('extractKeywords', () => {
    it('debe extraer palabras clave sin stop words', () => {
      const keywords = extractKeywords('El servidor de la base de datos');
      expect(keywords).toContain('servidor');
      expect(keywords).toContain('base');
      expect(keywords).toContain('datos');
      expect(keywords).not.toContain('el');
      expect(keywords).not.toContain('de');
      expect(keywords).not.toContain('la');
    });

    it('debe filtrar palabras cortas', () => {
      const keywords = extractKeywords('El PC no funciona');
      expect(keywords).not.toContain('pc'); // Menos de 3 caracteres
      expect(keywords).toContain('funciona');
    });
  });

  describe('filterActiveCategories', () => {
    it('debe filtrar solo categorías activas', () => {
      const active = filterActiveCategories(mockCategories);
      expect(active).toHaveLength(2);
      expect(active.every(cat => cat.isActive)).toBe(true);
    });
  });

  describe('buildCategoryPath', () => {
    it('debe construir el path completo de una categoría', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const path = buildCategoryPath(mockCategories[1], categoriesMap);
      
      expect(path).toHaveLength(2);
      expect(path[0].id).toBe('1'); // INFRAESTRUCTURA
      expect(path[1].id).toBe('2'); // Servidores
    });

    it('debe manejar categorías de nivel 1', () => {
      const categoriesMap = new Map(mockCategories.map(cat => [cat.id, cat]));
      const path = buildCategoryPath(mockCategories[0], categoriesMap);
      
      expect(path).toHaveLength(1);
      expect(path[0].id).toBe('1');
    });
  });

  describe('buildSearchIndex', () => {
    it('debe construir índice de búsqueda correctamente', () => {
      const index = buildSearchIndex(mockCategories);
      
      expect(index).toHaveLength(3);
      expect(index[0].id).toBe('1');
      expect(index[0].path).toBe('INFRAESTRUCTURA');
      expect(index[1].path).toBe('INFRAESTRUCTURA > Servidores');
    });

    it('debe incluir palabras clave', () => {
      const index = buildSearchIndex(mockCategories);
      
      expect(index[0].keywords.length).toBeGreaterThan(0);
      expect(index[0].searchableText).toBeTruthy();
    });

    it('debe normalizar texto buscable', () => {
      const index = buildSearchIndex(mockCategories);
      
      // El texto debe estar normalizado (sin acentos, minúsculas)
      expect(index[0].searchableText).toBe(
        normalizeText('INFRAESTRUCTURA Problemas de infraestructura INFRAESTRUCTURA')
      );
    });
  });
});
