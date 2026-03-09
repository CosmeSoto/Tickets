import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import {
  buildCategoryPath,
  filterActiveCategories,
} from '@/features/category-selection/utils/search-index';
import type { Category } from '@/features/category-selection/types';

/**
 * GET /api/categories/frequent
 * 
 * Retorna las categorías más frecuentemente usadas por el cliente
 * Basado en los últimos 20 tickets del cliente
 * Si el cliente no tiene suficiente historial, retorna las categorías más populares del sistema
 * 
 * Query params:
 * - clientId: string (requerido) - ID del cliente
 * - limit: number (opcional) - Máximo de categorías a retornar (default: 5)
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
    const clientId = searchParams.get('clientId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 5;

    // Validar clientId
    if (!clientId) {
      return NextResponse.json(
        {
          success: false,
          message: 'El parámetro clientId es requerido',
        },
        { status: 400 }
      );
    }

    // Validar que el usuario solo pueda ver sus propias categorías frecuentes
    // (a menos que sea admin o técnico)
    if (
      session.user.role === 'CLIENT' &&
      session.user.id !== clientId
    ) {
      return NextResponse.json(
        { success: false, message: 'No autorizado para ver estas categorías' },
        { status: 403 }
      );
    }

    // Obtener los últimos 20 tickets del cliente
    const recentTickets = await prisma.tickets.findMany({
      where: {
        clientId,
      },
      select: {
        categoryId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    let frequentCategoryIds: Array<{ categoryId: string; count: number; lastUsed: Date }> = [];

    // Si el cliente tiene al menos 3 tickets, calcular categorías frecuentes
    if (recentTickets.length >= 3) {
      // Contar frecuencia de cada categoría
      const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>();
      
      for (const ticket of recentTickets) {
        const existing = categoryFrequency.get(ticket.categoryId);
        if (existing) {
          existing.count++;
          // Mantener la fecha más reciente
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

      // Convertir a array y ordenar por frecuencia (descendente) y luego por fecha (más reciente primero)
      frequentCategoryIds = Array.from(categoryFrequency.entries())
        .map(([categoryId, data]) => ({
          categoryId,
          count: data.count,
          lastUsed: data.lastUsed,
        }))
        .sort((a, b) => {
          // Primero por frecuencia (descendente)
          if (b.count !== a.count) {
            return b.count - a.count;
          }
          // Si tienen la misma frecuencia, ordenar por fecha más reciente
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        })
        .slice(0, limit);
    } else {
      // Fallback: obtener las categorías más populares del sistema
      const popularCategories = await prisma.tickets.groupBy({
        by: ['categoryId'],
        _count: {
          categoryId: true,
        },
        orderBy: {
          _count: {
            categoryId: 'desc',
          },
        },
        take: limit,
      });

      // Obtener la fecha del último ticket para cada categoría popular
      const categoryLastUsed = await Promise.all(
        popularCategories.map(async (cat) => {
          const lastTicket = await prisma.tickets.findFirst({
            where: { categoryId: cat.categoryId },
            select: { createdAt: true },
            orderBy: { createdAt: 'desc' },
          });
          return {
            categoryId: cat.categoryId,
            count: cat._count.categoryId,
            lastUsed: lastTicket?.createdAt || new Date(),
          };
        })
      );

      frequentCategoryIds = categoryLastUsed;
    }

    // Si no hay categorías frecuentes, retornar array vacío
    if (frequentCategoryIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          categories: [],
        },
      });
    }

    // Obtener todas las categorías activas para construir los paths
    const allCategories = await prisma.categories.findMany({
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
    });

    const activeCategories = filterActiveCategories(allCategories as Category[]);
    const categoriesMap = new Map<string, Category>(
      activeCategories.map(cat => [cat.id, cat])
    );

    // Construir respuesta con paths completos
    const frequentCategories: Array<{
      category: Category;
      path: Category[];
      usageCount: number;
      lastUsed: string;
    }> = frequentCategoryIds
      .map(({ categoryId, count, lastUsed }) => {
        const category = categoriesMap.get(categoryId);
        if (!category) {
          return null;
        }

        const path = buildCategoryPath(category, categoriesMap);

        return {
          category,
          path,
          usageCount: count,
          lastUsed: lastUsed.toISOString(),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return NextResponse.json({
      success: true,
      data: {
        categories: frequentCategories,
      },
    });
  } catch (error) {
    console.error('Error in categories frequent API:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener categorías frecuentes',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
