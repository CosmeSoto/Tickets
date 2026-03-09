/**
 * Tests de integración con Fuse.js
 */

import { describe, it, expect } from '@jest/globals';
import Fuse from 'fuse.js';
import { fuseOptions } from '../config/fuse.config';
import { buildSearchIndex } from '../utils/search-index';
import type { Category } from '../types';

describe('Category Selection - Fuse.js Integration', () => {
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
  ];

  it('debe buscar categorías con Fuse.js', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    const results = fuse.search('servidor');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Servidores');
  });

  it('debe buscar sin distinción de mayúsculas', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    const results = fuse.search('IMPRESORA');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Impresoras');
  });

  it('debe buscar sin acentos', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    const results = fuse.search('tecnico'); // Sin acento

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('SOPORTE TÉCNICO');
  });

  it('debe buscar en descripciones', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    const results = fuse.search('hardware');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('INFRAESTRUCTURA');
  });

  it('debe incluir score de relevancia', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    const results = fuse.search('servidor');

    expect(results[0].score).toBeDefined();
    expect(typeof results[0].score).toBe('number');
    expect(results[0].score).toBeLessThan(1);
  });

  it('debe limitar resultados por threshold', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    // Búsqueda que no debería coincidir con nada
    const results = fuse.search('xyzabc123');

    expect(results.length).toBe(0);
  });

  it('debe buscar con fuzzy matching', () => {
    const searchIndex = buildSearchIndex(mockCategories);
    const fuse = new Fuse(searchIndex, fuseOptions);

    // Búsqueda con typo
    const results = fuse.search('impresra'); // Falta 'o'

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].item.name).toBe('Impresoras');
  });
});
