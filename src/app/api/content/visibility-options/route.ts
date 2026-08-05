/**
 * GET /api/content/visibility-options
 *
 * Árbol de visibilidad acotado al rol/alcance.
 * Fuente de verdad: departamentos activos en BD (no asume seeders).
 * Si un depto apunta a familia inactiva/legacy (p. ej. TECHNOLOGY),
 * se reubica visualmente en Administración o en "Otras áreas".
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  getContentVisibilityScope,
  serializeVisibilityScopeForClient,
} from '@/lib/content/visibility-scope'

type FamilyBucket = {
  id: string
  name: string
  color: string | null
  order: number
  departments: { id: string; name: string; order: number }[]
}

const ORPHAN_FAMILY_ID = '__orphan__'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
    const scope = await getContentVisibilityScope(session.user.id, session.user.role, isSuperAdmin)

    // Familias activas del alcance (pueden existir sin departamentos)
    const familyWhere =
      scope.allowedFamilyIds === undefined
        ? { isActive: true }
        : { isActive: true, id: { in: scope.allowedFamilyIds } }

    const activeFamilies = await prisma.families.findMany({
      where: familyWhere,
      select: { id: true, name: true, color: true, order: true, code: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    const adminFamily =
      activeFamilies.find(f => f.code === 'ADMINISTRATIVE') ??
      (await prisma.families.findFirst({
        where: { code: 'ADMINISTRATIVE' },
        select: { id: true, name: true, color: true, order: true, code: true },
      }))

    const buckets = new Map<string, FamilyBucket>()
    for (const f of activeFamilies) {
      buckets.set(f.id, {
        id: f.id,
        name: f.name,
        color: f.color ?? null,
        order: f.order,
        departments: [],
      })
    }

    // Departamentos activos: no depender de que la familia esté activa
    const deptWhere: Record<string, unknown> = { isActive: true }
    if (scope.allowedDepartmentIds !== undefined) {
      if (scope.allowedDepartmentIds.length === 0) {
        return NextResponse.json({
          scope: serializeVisibilityScopeForClient(scope),
          families: Array.from(buckets.values()).map(b => ({
            id: b.id,
            name: b.name,
            color: b.color,
            departments: b.departments
              .sort((a, c) => a.order - c.order || a.name.localeCompare(c.name))
              .map(d => ({ id: d.id, name: d.name })),
          })),
          users: [],
        })
      }
      deptWhere.id = { in: scope.allowedDepartmentIds }
    } else if (scope.allowedFamilyIds !== undefined) {
      // Incluir depts del alcance + huérfanos que luego reubicamos si aplica
      deptWhere.OR = [{ familyId: { in: scope.allowedFamilyIds } }, { familyId: null }]
    }

    const departments = await prisma.departments.findMany({
      where: deptWhere,
      select: {
        id: true,
        name: true,
        order: true,
        familyId: true,
        family: {
          select: { id: true, name: true, color: true, order: true, isActive: true, code: true },
        },
      },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })

    const allowedFamilySet =
      scope.allowedFamilyIds === undefined ? null : new Set(scope.allowedFamilyIds)

    for (const dept of departments) {
      let targetFamilyId = dept.familyId
      let targetMeta = dept.family

      // Familia inactiva / legacy / inexistente → reubicar
      const familyUnusable = !targetMeta || !targetMeta.isActive
      if (familyUnusable) {
        if (adminFamily && (!allowedFamilySet || allowedFamilySet.has(adminFamily.id))) {
          targetFamilyId = adminFamily.id
          targetMeta = {
            id: adminFamily.id,
            name: adminFamily.name,
            color: adminFamily.color,
            order: adminFamily.order,
            isActive: true,
            code: adminFamily.code ?? 'ADMINISTRATIVE',
          }
        } else {
          targetFamilyId = ORPHAN_FAMILY_ID
          targetMeta = null
        }
      }

      // Fuera de alcance (admin normal): omitir
      if (
        allowedFamilySet &&
        targetFamilyId &&
        targetFamilyId !== ORPHAN_FAMILY_ID &&
        !allowedFamilySet.has(targetFamilyId)
      ) {
        continue
      }

      if (targetFamilyId === ORPHAN_FAMILY_ID) {
        if (!buckets.has(ORPHAN_FAMILY_ID)) {
          buckets.set(ORPHAN_FAMILY_ID, {
            id: ORPHAN_FAMILY_ID,
            name: 'Otras áreas',
            color: '#94A3B8',
            order: 9999,
            departments: [],
          })
        }
        buckets.get(ORPHAN_FAMILY_ID)!.departments.push({
          id: dept.id,
          name: dept.name,
          order: dept.order,
        })
        continue
      }

      if (!targetFamilyId) continue

      if (!buckets.has(targetFamilyId)) {
        buckets.set(targetFamilyId, {
          id: targetFamilyId,
          name: targetMeta?.name ?? 'Área',
          color: targetMeta?.color ?? null,
          order: targetMeta?.order ?? 999,
          departments: [],
        })
      }

      const bucket = buckets.get(targetFamilyId)!
      if (!bucket.departments.some(d => d.id === dept.id)) {
        bucket.departments.push({
          id: dept.id,
          name: dept.name,
          order: dept.order,
        })
      }
    }

    const families = Array.from(buckets.values())
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(b => ({
        id: b.id,
        name: b.name,
        color: b.color,
        departments: b.departments
          .sort((a, c) => a.order - c.order || a.name.localeCompare(c.name))
          .map(d => ({ id: d.id, name: d.name })),
      }))

    // Usuarios del alcance
    const allDeptIds = families.flatMap(f => f.departments.map(d => d.id))
    const userWhere: Record<string, unknown> = {
      isActive: true,
      id: { not: session.user.id },
    }

    if (scope.allowedDepartmentIds !== undefined || scope.allowedFamilyIds !== undefined) {
      if (allDeptIds.length === 0 && (scope.allowedFamilyIds?.length ?? 0) === 0) {
        return NextResponse.json({
          scope: serializeVisibilityScopeForClient(scope),
          families,
          users: [],
        })
      }
      userWhere.OR = [
        ...(allDeptIds.length > 0 ? [{ departmentId: { in: allDeptIds } }] : []),
        ...(scope.allowedFamilyIds
          ? [{ departments: { familyId: { in: scope.allowedFamilyIds } } }]
          : []),
      ]
      if ((userWhere.OR as unknown[]).length === 0) {
        return NextResponse.json({
          scope: serializeVisibilityScopeForClient(scope),
          families,
          users: [],
        })
      }
    }

    if (scope.allowedRoles.length > 0) {
      userWhere.role = { in: scope.allowedRoles }
    }

    const users = await prisma.users.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        departments: { select: { id: true, familyId: true } },
      },
      orderBy: { name: 'asc' },
      take: 500,
    })

    // familyId efectivo para el árbol (reubicado si el depto cayó en Administración)
    const deptFamilyLookup = new Map<string, string>()
    for (const f of families) {
      for (const d of f.departments) {
        deptFamilyLookup.set(d.id, f.id === ORPHAN_FAMILY_ID ? f.id : f.id)
      }
    }

    return NextResponse.json({
      scope: serializeVisibilityScopeForClient(scope),
      families,
      users: users.map(u => {
        const deptId = u.departmentId
        const treeFamilyId = deptId ? deptFamilyLookup.get(deptId) : null
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          departmentId: deptId,
          familyId: treeFamilyId ?? u.departments?.familyId ?? null,
        }
      }),
    })
  } catch (error) {
    console.error('[visibility-options]', error)
    return NextResponse.json({ error: 'Error al obtener opciones de visibilidad' }, { status: 500 })
  }
}
