import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import Fuse from 'fuse.js';
import {
  buildSearchIndex,
  buildCategoryPath,
  filterActiveCategories,
} from '@/features/category-selection/utils/search-index';
import { fuseOptions, normalizeText } from '@/features/category-selection/config/fuse.config';
import type { Category, SearchResult } from '@/features/category-selection/types';

/**
 * GET /api/categories/search
 * 
 * Busca categorías por nombre, descripción y palabras clave
 * Implementa normalización de texto (sin acentos, case-insensitive)
 * Retorna resultados con path completo y score de relevancia
 * 
 * Query params:
 * - query: string (requerido) - Término de búsqueda
 * - limit: number (opcional) - Máximo de resultados (default: 10)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 10;

    // Validar query
    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          message: 'El término de búsqueda debe tener al menos 2 caracteres',
        },
        { status: 400 }
      );
    }

    // Obtener todas las categorías activas
    const categories = await prisma.categories.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        level: true,
        parentId: true,
        departmentId: true,
        order: true,
        color: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { level: 'asc' },
        { order: 'asc' },
        { name: 'asc' },
      ],
    });

    // Filtrar categorías activas
    const activeCategories = filterActiveCategories(categories as Category[]);

    // Construir índice de búsqueda
    const searchIndex = buildSearchIndex(activeCategories);

    // Crear instancia de Fuse.js
    const fuse = new Fuse(searchIndex, fuseOptions);

    // Normalizar query para búsqueda
    const normalizedQuery = normalizeText(query);

    // Realizar búsqueda
    const fuseResults = fuse.search(normalizedQuery);

    // Crear mapa de categorías para acceso rápido
    const categoriesMap = new Map<string, Category>(
      activeCategories.map(cat => [cat.id, cat])
    );

    // Transformar resultados de Fuse a SearchResult
    const searchResults: SearchResult[] = fuseResults
      .slice(0, limit)
      .map(result => {
        const category = categoriesMap.get(result.item.id);
        if (!category) {
          return null;
        }

        const path = buildCategoryPath(category, categoriesMap);

        // Determinar campos coincidentes
        const matchedFields: string[] = [];
        if (result.matches) {
          for (const match of result.matches) {
            if (match.key && !matchedFields.includes(match.key)) {
              matchedFields.push(match.key);
            }
          }
        }

        // Calcular score (Fuse devuelve score donde 0 = coincidencia perfecta, 1 = peor coincidencia)
        // Invertimos para que 1 = mejor coincidencia
        const score = result.score !== undefined ? 1 - result.score : 0;

        return {
          category,
          path,
          matchedFields,
          score,
        };
      })
      .filter((result): result is SearchResult => result !== null);

    return NextResponse.json({
      success: true,
      data: {
        results: searchResults,
        totalMatches: fuseResults.length,
      },
    });
  } catch (error) {
    console.error('Error in categories search API:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al buscar categorías',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
