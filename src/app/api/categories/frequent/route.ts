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
 *
 * Reglas:
 * - Solo categorías usadas >= minUsage veces (default: 2)
 * - Solo categorías que pertenecen a familias a las que el usuario tiene acceso HOY
 *   (CLIENT: familia nativa + client_family_assignments activos)
 *   (TECHNICIAN: technician_family_assignments activos)
 *   (ADMIN: admin_family_assignments activos, o todas si es superAdmin)
 * - Sin historial suficiente → array vacío, nunca datos de otros usuarios
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

    // ── 1. Determinar familias accesibles HOY según el rol ────────────────────
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    let allowedFamilyIds: Set<string> | null = null // null = sin restricción (superAdmin)

    if (session.user.role === 'CLIENT') {
      const [userDept, clientAssignments] = await Promise.all([
        prisma.users.findUnique({
          where: { id: clientId },
          select: { departments: { select: { familyId: true } } },
        }),
        prisma.client_family_assignments.findMany({
          where: { clientId, isActive: true },
          select: { familyId: true },
        }),
      ])
      allowedFamilyIds = new Set(clientAssignments.map(a => a.familyId))
      if (userDept?.departments?.familyId) allowedFamilyIds.add(userDept.departments.familyId)
    } else if (session.user.role === 'TECHNICIAN') {
      const techAssignments = await prisma.technician_family_assignments.findMany({
        where: { technicianId: clientId, isActive: true },
        select: { familyId: true },
      })
      allowedFamilyIds = new Set(techAssignments.map(a => a.familyId))
    } else if (session.user.role === 'ADMIN' && !isSuperAdmin) {
      const adminAssignments = await prisma.admin_family_assignments.findMany({
        where: { adminId: clientId, isActive: true },
        select: { familyId: true },
      })
      // Admin sin asignaciones explícitas → acceso total (igual que superAdmin)
      if (adminAssignments.length > 0) {
        allowedFamilyIds = new Set(adminAssignments.map(a => a.familyId))
      }
      // Si no tiene asignaciones → allowedFamilyIds queda null (sin restricción)
    }
    // ADMIN superAdmin → allowedFamilyIds = null (sin restricción)

    // Sin familias asignadas para CLIENT/TECHNICIAN → no hay frecuentes posibles
    if (allowedFamilyIds !== null && allowedFamilyIds.size === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // ── 2. Obtener departamentos permitidos ───────────────────────────────────
    // Solo necesario si hay restricción de familias
    let allowedDeptIds: Set<string> | null = null
    if (allowedFamilyIds !== null) {
      const allowedDepts = await prisma.departments.findMany({
        where: { familyId: { in: Array.from(allowedFamilyIds) }, isActive: true },
        select: { id: true },
      })
      allowedDeptIds = new Set(allowedDepts.map(d => d.id))
    }

    // ── 3. Historial de tickets del usuario como cliente ──────────────────────
    const recentTickets = await prisma.tickets.findMany({
      where: { clientId },
      select: { categoryId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    if (recentTickets.length === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // ── 4. Contar frecuencia, filtrar por familias actuales y umbral ──────────
    // Necesitamos saber a qué departamento pertenece cada categoría del historial
    const historyCategoryIds = [...new Set(recentTickets.map(t => t.categoryId))]
    const historyCategories = await prisma.categories.findMany({
      where: { id: { in: historyCategoryIds }, isActive: true },
      select: { id: true, departmentId: true },
    })
    const categoryDeptMap = new Map(historyCategories.map(c => [c.id, c.departmentId]))

    const categoryFrequency = new Map<string, { count: number; lastUsed: Date }>()
    for (const ticket of recentTickets) {
      const deptId = categoryDeptMap.get(ticket.categoryId)

      // Filtrar: si hay restricción de familias, solo incluir categorías de depts permitidos
      if (allowedDeptIds !== null && (!deptId || !allowedDeptIds.has(deptId))) {
        continue
      }

      const existing = categoryFrequency.get(ticket.categoryId)
      if (existing) {
        existing.count++
        if (ticket.createdAt > existing.lastUsed) existing.lastUsed = ticket.createdAt
      } else {
        categoryFrequency.set(ticket.categoryId, { count: 1, lastUsed: ticket.createdAt })
      }
    }

    // Solo categorías que superen el umbral mínimo de uso
    const frequentCategoryIds = Array.from(categoryFrequency.entries())
      .filter(([, data]) => data.count >= minUsage)
      .map(([categoryId, data]) => ({ categoryId, count: data.count, lastUsed: data.lastUsed }))
      .sort((a, b) =>
        b.count !== a.count ? b.count - a.count : b.lastUsed.getTime() - a.lastUsed.getTime()
      )
      .slice(0, limit)

    if (frequentCategoryIds.length === 0) {
      return NextResponse.json({ success: true, data: { categories: [] } })
    }

    // ── 5. Construir respuesta con paths completos ────────────────────────────
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
