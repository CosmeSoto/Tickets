import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { invalidateCache } from '@/lib/api-cache'

/**
 * DELETE /api/categories/bulk-delete
 * Elimina todas las categorías de una familia o del sistema completo.
 *
 * Body: { familyId?: string, confirm: string }
 * - familyId: si se pasa, elimina solo las de esa familia. Si no, elimina TODAS (solo SuperAdmin).
 * - confirm: debe ser "ELIMINAR" para confirmar la acción.
 *
 * Restricciones:
 * - No elimina categorías con tickets asociados (las omite y reporta)
 * - Solo SuperAdmin puede eliminar sin familyId (todo el sistema)
 * - Admin normal solo puede eliminar sus familias asignadas
 */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const isSuperAdmin = (session.user as any).isSuperAdmin === true

  try {
    const body = await request.json()
    const { familyId, confirm } = body

    if (confirm !== 'ELIMINAR') {
      return NextResponse.json({ error: 'Confirmación inválida' }, { status: 400 })
    }

    // Sin familyId → eliminar todo el sistema (solo SuperAdmin)
    if (!familyId && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el Super Admin puede eliminar todas las categorías del sistema' },
        { status: 403 }
      )
    }

    // Verificar permisos de familia para admin normal
    if (familyId && !isSuperAdmin) {
      const totalAssignments = await prisma.admin_family_assignments.count({
        where: { adminId: session.user.id, isActive: true },
      })
      if (totalAssignments > 0) {
        // Tiene asignaciones explícitas → verificar que esta familia esté entre ellas
        const assignment = await prisma.admin_family_assignments.findFirst({
          where: { adminId: session.user.id, familyId, isActive: true },
        })
        if (!assignment) {
          return NextResponse.json({ error: 'No tienes permiso para esta área' }, { status: 403 })
        }
      }
      // Sin asignaciones explícitas → acceso total (admin legacy)
    }

    // Obtener categorías a eliminar
    const whereClause = familyId ? { departments: { familyId } } : {}

    const categories = await prisma.categories.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        _count: { select: { tickets: true } },
      },
    })

    if (categories.length === 0) {
      return NextResponse.json({ success: true, deleted: 0, skipped: 0, skippedNames: [] })
    }

    // Separar las que tienen tickets (no se pueden eliminar) de las que no
    const canDelete = categories.filter(c => c._count.tickets === 0)
    const cannotDelete = categories.filter(c => c._count.tickets > 0)

    // Eliminar en orden inverso de nivel (primero las hojas, luego los padres)
    // para evitar errores de FK
    const toDeleteIds = canDelete.map(c => c.id)

    if (toDeleteIds.length > 0) {
      // Eliminar en múltiples pasadas por nivel descendente
      for (let level = 4; level >= 1; level--) {
        await prisma.categories.deleteMany({
          where: { id: { in: toDeleteIds }, level },
        })
      }
    }

    // Invalidar caché
    try {
      await invalidateCache('categories:*')
    } catch {}

    return NextResponse.json({
      success: true,
      deleted: canDelete.length,
      skipped: cannotDelete.length,
      skippedNames: cannotDelete.map(c => c.name),
    })
  } catch (error) {
    console.error('[BULK-DELETE] Error:', error)
    return NextResponse.json({ error: 'Error al eliminar categorías' }, { status: 500 })
  }
}
