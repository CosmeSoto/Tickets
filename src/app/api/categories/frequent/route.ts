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
 * Retorna las categorías más frecuentemente usadas por el usuario,
 * basado EXCLUSIVAMENTE en su propio historial de tickets como cliente.
 * Solo muestra categorías usadas al menos `minUsage` veces (default: 2).
 * Sin historial suficiente, retorna array vacío — nunca datos de otros usuarios.
 *
 * Query params:
 * - clientId: string (requerido) - ID del usuario
 * - limit: number (opcional) - Máximo de categorías a retornar (default: 5)
 * - minUsage: number (opcional) - Mínimo de usos para considerar "frecuente" (default: 2)
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
    const minUsageParam = searchParams.get('minUsage')
    const limit = limitParam ? parseInt(limitParam, 10) : 5
    // Una categoría debe haberse usado al menos 2 veces para ser "frecuente"
    const minUsage = minUsageParam ? parseInt(minUsageParam, 10) : 2

    if (!clientId) {
      return NextResponse.json(
        { success: false, message: 'El parámetro clientId es requerido' },
        { status: 400 }
      )
    }

    // Solo el propio usuario, admins y técnicos pueden consultar
    if (session.user.role === 'CLIENT' && session.user.id !== clientId) {
      return NextResponse.json(
        { success: false, message: 'No autorizado para ver estas categorías' },
        { status: 403 }
      )
    }

    // Obtener los últimos 50 tickets donde el usuario es el cliente (creador)
    const recentTickets = await prisma.tickets.findMany({
      where: { clientId },
      select: { categoryId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    // Sin historial propio → no hay frecuentes que mostrar
    if (recentTickets.length === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // Contar frecuencia de cada categoría en el historial del usuario
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

    // Solo incluir categorías que superen el umbral mínimo de uso
    // Ordenar: primero por frecuencia desc, luego por más reciente
    const frequentCategoryIds = Array.from(categoryFrequency.entries())
      .filter(([, data]) => data.count >= minUsage)
      .map(([categoryId, data]) => ({ categoryId, count: data.count, lastUsed: data.lastUsed }))
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : b.lastUsed.getTime() - a.lastUsed.getTime()
      )
      .slice(0, limit)

    // No hay categorías que superen el umbral → sección no se muestra
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
