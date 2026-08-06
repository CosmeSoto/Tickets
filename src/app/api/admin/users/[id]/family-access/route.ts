/**
 * API unificada de áreas por módulo.
 *
 * GET  → snapshot { modules: [{ module, familyIds, nativeFamilyId }] }
 * PUT  → { module, familyIds }  reemplaza adicionales del módulo
 * POST → { module, familyId }   asigna una
 * DELETE query module&familyId  desasigna una
 *
 * `module` acepta tickets|inventory|patrols|content|news|forms|…futuros
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  assignUserModuleFamily,
  unassignUserModuleFamily,
  setUserModuleFamilies,
  getUserFamilyAccessSnapshot,
} from '@/lib/auth/user-family-access'
import {
  listFamilyAccessModules,
  resolveFamilyAccessModuleKey,
} from '@/lib/auth/family-access-modules'
import { getUserFamilyScope } from '@/lib/auth/admin-scope'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }
  return { session }
}

async function assertCanAssignFamily(adminId: string, isSuperAdmin: boolean, familyId: string) {
  if (isSuperAdmin) return null
  const scope = await getUserFamilyScope(adminId, 'ADMIN', false)
  if (scope.familyIds && !scope.familyIds.includes(familyId)) {
    return NextResponse.json({ error: 'No tienes acceso a esta familia' }, { status: 403 })
  }
  return null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { id: userId } = await params
    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const snapshot = await getUserFamilyAccessSnapshot(userId)
    return NextResponse.json({
      data: {
        userId,
        role: user.role,
        modules: snapshot,
        registry: listFamilyAccessModules().map(m => ({
          key: m.key,
          label: m.label,
          description: m.description,
        })),
      },
    })
  } catch (err) {
    console.error('[family-access GET]', err)
    return NextResponse.json({ error: 'Error al obtener family-access' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const session = auth.session!

    const { id: userId } = await params
    const body = await request.json()
    const moduleInput = String(body.module ?? '')
    const familyIds = Array.isArray(body.familyIds) ? (body.familyIds as string[]) : null

    if (!moduleInput || !familyIds) {
      return NextResponse.json({ error: 'module y familyIds son requeridos' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })

    for (const familyId of familyIds) {
      const denied = await assertCanAssignFamily(
        session.user.id,
        Boolean(viewer?.isSuperAdmin),
        familyId
      )
      if (denied) return denied
    }

    const saved = await setUserModuleFamilies({
      userId,
      moduleInput,
      familyIds,
      role: user.role,
    })

    return NextResponse.json({
      data: {
        module: resolveFamilyAccessModuleKey(moduleInput),
        familyIds: saved,
      },
    })
  } catch (err: any) {
    console.error('[family-access PUT]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al actualizar family-access' },
      { status: 400 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error
    const session = auth.session!

    const { id: userId } = await params
    const body = await request.json()
    const moduleInput = String(body.module ?? '')
    const familyId = String(body.familyId ?? '')

    if (!moduleInput || !familyId) {
      return NextResponse.json({ error: 'module y familyId son requeridos' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    const viewer = await prisma.users.findUnique({
      where: { id: session.user.id },
      select: { isSuperAdmin: true },
    })
    const denied = await assertCanAssignFamily(
      session.user.id,
      Boolean(viewer?.isSuperAdmin),
      familyId
    )
    if (denied) return denied

    await assignUserModuleFamily({
      userId,
      familyId,
      moduleInput,
      role: user.role,
    })

    return NextResponse.json({
      data: { module: resolveFamilyAccessModuleKey(moduleInput), familyId },
    })
  } catch (err: any) {
    console.error('[family-access POST]', err)
    return NextResponse.json({ error: err?.message ?? 'Error al asignar familia' }, { status: 400 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth && auth.error) return auth.error

    const { id: userId } = await params
    const moduleInput = request.nextUrl.searchParams.get('module') ?? ''
    const familyId = request.nextUrl.searchParams.get('familyId') ?? ''

    if (!moduleInput || !familyId) {
      return NextResponse.json({ error: 'module y familyId son requeridos' }, { status: 400 })
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    })
    if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

    await unassignUserModuleFamily({
      userId,
      familyId,
      moduleInput,
      role: user.role,
    })

    return NextResponse.json({
      data: { module: resolveFamilyAccessModuleKey(moduleInput), familyId },
    })
  } catch (err: any) {
    console.error('[family-access DELETE]', err)
    return NextResponse.json(
      { error: err?.message ?? 'Error al desasignar familia' },
      { status: 400 }
    )
  }
}
