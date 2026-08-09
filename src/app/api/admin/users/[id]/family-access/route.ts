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
import { assertAdminCanAccessFamily, assertAdminCanManageUser } from '@/lib/auth/admin-scope'

async function requireAdminSession() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) }
  }

  const viewer = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  const isSuperAdmin = viewer?.isSuperAdmin === true

  return { session, isSuperAdmin }
}

/** Grants de tickets a usuarios ADMIN: solo Super Admin (paridad con /families/admin). */
function assertTicketsAdminGrant(
  isSuperAdmin: boolean,
  targetRole: string,
  moduleInput: string
): NextResponse | null {
  const moduleKey = resolveFamilyAccessModuleKey(moduleInput)
  if (targetRole === 'ADMIN' && moduleKey === 'tickets' && !isSuperAdmin) {
    return NextResponse.json(
      { error: 'Solo el administrador principal puede asignar familias de tickets a administradores' },
      { status: 403 }
    )
  }
  return null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdminSession()
    if ('error' in auth && auth.error) return auth.error

    const { id: userId } = await params
    const scopeCheck = await assertAdminCanManageUser(
      auth.session!.user.id,
      auth.isSuperAdmin!,
      userId
    )
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

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
    const auth = await requireAdminSession()
    if ('error' in auth && auth.error) return auth.error
    const session = auth.session!
    const isSuperAdmin = auth.isSuperAdmin!

    const { id: userId } = await params
    const scopeCheck = await assertAdminCanManageUser(session.user.id, isSuperAdmin, userId)
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

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

    const ticketsDenied = assertTicketsAdminGrant(isSuperAdmin, user.role, moduleInput)
    if (ticketsDenied) return ticketsDenied

    for (const familyId of familyIds) {
      const denied = await assertAdminCanAccessFamily(session.user.id, isSuperAdmin, familyId)
      if (!denied.allowed) {
        return NextResponse.json({ error: denied.error }, { status: denied.status })
      }
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
    const auth = await requireAdminSession()
    if ('error' in auth && auth.error) return auth.error
    const session = auth.session!
    const isSuperAdmin = auth.isSuperAdmin!

    const { id: userId } = await params
    const scopeCheck = await assertAdminCanManageUser(session.user.id, isSuperAdmin, userId)
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

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

    const ticketsDenied = assertTicketsAdminGrant(isSuperAdmin, user.role, moduleInput)
    if (ticketsDenied) return ticketsDenied

    const familyDenied = await assertAdminCanAccessFamily(session.user.id, isSuperAdmin, familyId)
    if (!familyDenied.allowed) {
      return NextResponse.json({ error: familyDenied.error }, { status: familyDenied.status })
    }

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
    const auth = await requireAdminSession()
    if ('error' in auth && auth.error) return auth.error
    const session = auth.session!
    const isSuperAdmin = auth.isSuperAdmin!

    const { id: userId } = await params
    const scopeCheck = await assertAdminCanManageUser(session.user.id, isSuperAdmin, userId)
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: scopeCheck.error }, { status: scopeCheck.status })
    }

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

    const ticketsDenied = assertTicketsAdminGrant(isSuperAdmin, user.role, moduleInput)
    if (ticketsDenied) return ticketsDenied

    const familyDenied = await assertAdminCanAccessFamily(session.user.id, isSuperAdmin, familyId)
    if (!familyDenied.allowed) {
      return NextResponse.json({ error: familyDenied.error }, { status: familyDenied.status })
    }

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
