/**
 * Alcance de políticas SLA para ADMIN (super vs familias operativas de tickets).
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'

export type SlaPolicyAccessUser = {
  id: string
  role: string
  isSuperAdmin?: boolean
}

/** Filtro Prisma para listados: super ve todo; admin normal solo categorías de su scope. */
export async function buildSlaPolicyListWhere(
  user: SlaPolicyAccessUser,
  base: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const where: Record<string, unknown> = { ...base }
  if (user.isSuperAdmin) return where

  const scope = await getUserFamilyScope(user.id, 'ADMIN', false)
  if (scope.familyIds && scope.familyIds.length > 0) {
    where.OR = [
      { categoryId: null }, // globales visibles en lectura
      { category: { departments: { familyId: { in: scope.familyIds } } } },
    ]
  } else {
    // Sin familias: solo políticas globales
    where.categoryId = null
  }
  return where
}

/**
 * Mutación: globales solo Super Admin; por categoría, familia en scope operativo.
 * null = permitido; NextResponse = denegado.
 */
export async function assertCanMutateSlaPolicy(
  user: SlaPolicyAccessUser,
  policy: { id: string; categoryId: string | null }
): Promise<NextResponse | null> {
  if (user.role !== 'ADMIN') {
    return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 403 })
  }

  if (!policy.categoryId) {
    if (!user.isSuperAdmin) {
      return NextResponse.json(
        { success: false, message: 'Solo el Super Administrador puede modificar políticas SLA globales' },
        { status: 403 }
      )
    }
    return null
  }

  if (user.isSuperAdmin) return null

  const category = await prisma.categories.findUnique({
    where: { id: policy.categoryId },
    select: { departments: { select: { familyId: true } } },
  })
  const familyId = category?.departments?.familyId
  if (!familyId) {
    return NextResponse.json(
      { success: false, message: 'Categoría de la política sin familia' },
      { status: 403 }
    )
  }

  const scope = await getUserFamilyScope(user.id, 'ADMIN', false)
  if (scope.familyIds === undefined) return null // admin sin restricción
  if (!scope.familyIds.includes(familyId)) {
    return NextResponse.json(
      { success: false, message: 'Sin acceso a la familia de esta política SLA' },
      { status: 403 }
    )
  }
  return null
}
