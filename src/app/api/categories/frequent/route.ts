import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  buildCategoryPath,
  filterActiveCategories,
} from '@/features/category-selection/utils/search-index'
import type { Category } from '@/features/category-selection/types'

/**
 * GET /api/categories/frequent
 *
 * Retorna las categorías más frecuentemente usadas por el cliente,
 * basado EXCLUSIVAMENTE en su propio historial de tickets.
 * Si el cliente no tiene tickets propios, retorna array vacío.
 * No se usan datos de otros usuarios como fallback.
 *
 * Query params:
 * - clientId: string (requerido) - ID del cliente
 * - limit: number (opcional) - Máximo de categorías a retornar (default: 5)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const clientId = searchParams.get('clientId')
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 5

    if (!clientId) {
      return NextResponse.json(
        { success: false, message: 'El parámetro clientId es requerido' },
        { status: 400 }
      )
    }

    // Solo el propio cliente, admins y técnicos pueden consultar
    if (session.user.role === 'CLIENT' && session.user.id !== clientId) {
      return NextResponse.json(
        { success: false, message: 'No autorizado para ver estas categorías' },
        { status: 403 }
      )
    }

    // Obtener los últimos 30 tickets del cliente (solo los suyos)
    const recentTickets = await prisma.tickets.findMany({
      where: { clientId },
      select: { categoryId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    // Sin historial propio → no hay frecuentes que mostrar
    if (recentTickets.length === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // Contar frecuencia de cada categoría en el historial del cliente
    const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>()
    for (const ticket of recentTickets) {
      const existing = categoryFrequency.get(ticket.categoryId)
      if (existing) {
        existing.count++
        if (ticket.createdAt > existing.lastUsed) existing.lastUsed = ticket.createdAt
      } else {
        categoryFrequency.set(ticket.categoryId, { count: 1, lastUsed: ticket.createdAt })
      }
    }

    // Ordenar: primero por frecuencia desc, luego por más reciente
    const frequentCategoryIds = Array.from(categoryFrequency.entries())
      .map(([categoryId, data]) => ({ categoryId, count: data.count, lastUsed: data.lastUsed }))
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : b.lastUsed.getTime() - a.lastUsed.getTime()
      )
      .slice(0, limit)

    if (frequentCategoryIds.length === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // Obtener todas las categorías activas para construir los paths
    const allCategories = await prisma.categories.findMany({
      where: { isActive: true },
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
    })

    const activeCategories = filterActiveCategories(allCategories as Category[])
    const categoriesMap = new Map<string, Category>(activeCategories.map(cat => [cat.id, cat]))

    const frequentCategories = frequentCategoryIds
      .map(({ categoryId, count, lastUsed }) => {
        const category = categoriesMap.get(categoryId)
        if (!category) return null
        return {
          category,
          path: buildCategoryPath(category, categoriesMap),
          usageCount: count,
          lastUsed: lastUsed.toISOString(),
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    return NextResponse.json({ success: true, data: { categories: frequentCategories } })
  } catch (error) {
    console.error('Error in categories frequent API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener categorías frecuentes',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
