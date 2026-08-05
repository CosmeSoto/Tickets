/**
 * Alcance de visibilidad/creación para Documentos y Noticias.
 *
 * Reglas:
 * - Super Admin: sin restricción (todas las familias, todos los roles).
 * - ADMIN / TECHNICIAN: familias de su scope (nativa + asignaciones).
 * - CLIENT: solo su familia nativa (si no hay nativa, sus asignaciones client).
 * - CLIENT no puede publicar “para todos” (vacío): se fuerza su familia.
 * - Roles seleccionables dependen del creador.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserFamilyScope, getDepartmentIdsForScope } from '@/lib/auth/admin-scope'
import type { UserRole } from '@prisma/client'

export const ALL_VISIBILITY_ROLES: UserRole[] = ['ADMIN', 'TECHNICIAN', 'CLIENT']

export type ContentVisibilityScope = {
  userId: string
  role: string
  isSuperAdmin: boolean
  /** undefined = sin límite (Super Admin) */
  allowedFamilyIds: string[] | undefined
  allowedDepartmentIds: string[] | undefined
  /** Roles que puede marcar en el selector */
  allowedRoles: UserRole[]
  nativeFamilyId: string | null
  /**
   * Si true, no se permite publicar sin restricciones de familia
   * (CLIENT / TECH sin familias = error).
   */
  requireFamilyRestriction: boolean
}

export type VisibilityPayload = {
  roles?: string[]
  familyIds?: string[]
  departmentIds?: string[]
  userIds?: string[]
  /** Familia principal opcional del documento */
  familyId?: string | null
}

export type SanitizedVisibility = {
  roles: UserRole[]
  familyIds: string[]
  departmentIds: string[]
  userIds: string[]
  familyId: string | null
}

function rolesForCreator(role: string, isSuperAdmin: boolean): UserRole[] {
  if (isSuperAdmin || role === 'ADMIN') return [...ALL_VISIBILITY_ROLES]
  if (role === 'TECHNICIAN') return ['TECHNICIAN', 'CLIENT']
  // CLIENT: solo puede dirigir a clientes (de su familia)
  return ['CLIENT']
}

/**
 * Resuelve el alcance de creación/visibilidad del usuario actual.
 */
export async function getContentVisibilityScope(
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<ContentVisibilityScope> {
  if (role === 'ADMIN' && isSuperAdmin) {
    return {
      userId,
      role,
      isSuperAdmin: true,
      allowedFamilyIds: undefined,
      allowedDepartmentIds: undefined,
      allowedRoles: [...ALL_VISIBILITY_ROLES],
      nativeFamilyId: null,
      requireFamilyRestriction: false,
    }
  }

  const scope = await getUserFamilyScope(userId, role, false)
  let allowedFamilyIds = scope.familyIds ?? []

  // CLIENT: solo su familia nativa (fallback a asignaciones si no tiene nativa)
  if (role === 'CLIENT') {
    if (scope.nativeFamilyId) {
      allowedFamilyIds = [scope.nativeFamilyId]
    } else {
      allowedFamilyIds = scope.familyIds ?? []
    }
  }

  const allowedDepartmentIds = await getDepartmentIdsForScope({ familyIds: allowedFamilyIds })

  return {
    userId,
    role,
    isSuperAdmin: false,
    allowedFamilyIds,
    allowedDepartmentIds,
    allowedRoles: rolesForCreator(role, false),
    nativeFamilyId: scope.nativeFamilyId,
    // CLIENT siempre; TECH/ADMIN con scope vacío también deben acotar
    requireFamilyRestriction: role === 'CLIENT' || allowedFamilyIds.length > 0,
  }
}

/**
 * Sanitiza el payload de visibilidad según el alcance del creador.
 * Devuelve NextResponse 400/403 si es inválido, o el payload limpio.
 */
export async function sanitizeVisibilityPayload(
  scope: ContentVisibilityScope,
  payload: VisibilityPayload
): Promise<SanitizedVisibility | NextResponse> {
  const requestedRoles = Array.isArray(payload.roles) ? payload.roles : []
  const requestedFamilyIds = Array.isArray(payload.familyIds) ? payload.familyIds : []
  const requestedDepartmentIds = Array.isArray(payload.departmentIds) ? payload.departmentIds : []
  const requestedUserIds = Array.isArray(payload.userIds) ? payload.userIds : []

  // Roles permitidos
  const roles = requestedRoles.filter((r): r is UserRole =>
    scope.allowedRoles.includes(r as UserRole)
  ) as UserRole[]

  // Familias permitidas (ignorar placeholders de UI como "__orphan__")
  let familyIds = requestedFamilyIds.filter(id => !!id && !id.startsWith('__'))
  if (scope.allowedFamilyIds !== undefined) {
    familyIds = familyIds.filter(id => scope.allowedFamilyIds!.includes(id))
  }

  // Departamentos permitidos
  let departmentIds = requestedDepartmentIds
  if (scope.allowedDepartmentIds !== undefined) {
    departmentIds = requestedDepartmentIds.filter(id => scope.allowedDepartmentIds!.includes(id))
  }

  // CLIENT / scopes restringidos: si no eligieron familia, forzar su(s) familia(s)
  if (scope.requireFamilyRestriction && familyIds.length === 0) {
    if (scope.role === 'CLIENT') {
      const forced =
        scope.nativeFamilyId ??
        (scope.allowedFamilyIds && scope.allowedFamilyIds.length > 0
          ? scope.allowedFamilyIds[0]
          : null)
      if (!forced) {
        return NextResponse.json(
          {
            error:
              'No tienes un área asignada. Contacta al administrador para poder publicar documentos o noticias.',
          },
          { status: 400 }
        )
      }
      familyIds = [forced]
    } else if (scope.allowedFamilyIds && scope.allowedFamilyIds.length > 0) {
      // ADMIN/TECH: si dejaron vacío = “todos de mi alcance”, no org-wide
      // Solo forzar si además no hay roles/users/depts (publicación global)
      const hasOther = roles.length > 0 || departmentIds.length > 0 || requestedUserIds.length > 0
      if (!hasOther) {
        familyIds = [...scope.allowedFamilyIds]
      }
    }
  }

  // Validar que no intentaron familias fuera de alcance
  if (scope.allowedFamilyIds !== undefined) {
    const outOfScope = requestedFamilyIds.filter(id => !scope.allowedFamilyIds!.includes(id))
    if (outOfScope.length > 0) {
      return NextResponse.json(
        { error: 'Seleccionaste áreas fuera de tu alcance' },
        { status: 403 }
      )
    }
  }

  // Usuarios: deben pertenecer a departamentos del alcance (si hay restricción)
  let userIds = requestedUserIds
  if (scope.allowedDepartmentIds !== undefined && requestedUserIds.length > 0) {
    if (scope.allowedDepartmentIds.length === 0) {
      userIds = []
    } else {
      const validUsers = await prisma.users.findMany({
        where: {
          id: { in: requestedUserIds },
          isActive: true,
          OR: [
            { departmentId: { in: scope.allowedDepartmentIds } },
            // Incluir usuarios cuya familia nativa está en alcance
            ...(scope.allowedFamilyIds
              ? [{ departments: { familyId: { in: scope.allowedFamilyIds } } }]
              : []),
          ],
        },
        select: { id: true },
      })
      const validSet = new Set(validUsers.map(u => u.id))
      userIds = requestedUserIds.filter(id => validSet.has(id))
    }
  }

  // familyId principal del documento (campo opcional)
  let familyId: string | null =
    typeof payload.familyId === 'string' && payload.familyId ? payload.familyId : null
  if (familyId && scope.allowedFamilyIds !== undefined) {
    if (!scope.allowedFamilyIds.includes(familyId)) {
      familyId = familyIds[0] ?? scope.nativeFamilyId ?? null
    }
  }
  if (!familyId && familyIds.length === 1) {
    familyId = familyIds[0]
  }
  if (!familyId && scope.role === 'CLIENT') {
    familyId = scope.nativeFamilyId
  }

  return { roles, familyIds, departmentIds, userIds, familyId }
}

/** Serializa el scope para la UI (selector de visibilidad). */
export function serializeVisibilityScopeForClient(scope: ContentVisibilityScope) {
  return {
    allowedFamilyIds: scope.allowedFamilyIds ?? null,
    allowedRoles: scope.allowedRoles,
    nativeFamilyId: scope.nativeFamilyId,
    requireFamilyRestriction: scope.requireFamilyRestriction,
    role: scope.role,
    isSuperAdmin: scope.isSuperAdmin,
  }
}
