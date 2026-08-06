import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { assignUserModuleFamily, unassignUserModuleFamily } from '@/lib/auth/user-family-access'

/**
 * @deprecated Preferir `/api/admin/users/:id/family-access` (module=tickets).
 * Thin wrapper sobre user_family_access.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const requester = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  if (!requester?.isSuperAdmin) {
    return NextResponse.json(
      {
        success: false,
        message: 'Solo el administrador principal puede ver asignaciones de familias',
      },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('adminId')

  const rows = await prisma.user_family_access.findMany({
    where: {
      module: 'tickets',
      isActive: true,
      user: { role: 'ADMIN' },
      ...(adminId && { userId: adminId }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      family: { select: { id: true, name: true, code: true, color: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const assignments = rows.map(row => ({
    id: row.id,
    adminId: row.userId,
    familyId: row.familyId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    admin: row.user,
    family: row.family,
  }))

  return NextResponse.json({ success: true, data: assignments })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const requester = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  if (!requester?.isSuperAdmin) {
    return NextResponse.json(
      {
        success: false,
        message: 'Solo el administrador principal puede asignar familias a otros administradores',
      },
      { status: 403 }
    )
  }

  const { adminId, familyId } = await request.json()
  if (!adminId || !familyId) {
    return NextResponse.json(
      { success: false, message: 'adminId y familyId son requeridos' },
      { status: 400 }
    )
  }

  const targetAdmin = await prisma.users.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, role: true, isActive: true },
  })
  if (!targetAdmin || targetAdmin.role !== 'ADMIN' || !targetAdmin.isActive) {
    return NextResponse.json(
      { success: false, message: 'El usuario debe ser un administrador activo' },
      { status: 400 }
    )
  }

  const existing = await prisma.user_family_access.findUnique({
    where: {
      userId_familyId_module: { userId: adminId, familyId, module: 'tickets' },
    },
  })

  if (existing?.isActive) {
    return NextResponse.json(
      { success: false, message: 'La familia ya está asignada a este administrador' },
      { status: 409 }
    )
  }

  await assignUserModuleFamily({
    userId: adminId,
    familyId,
    moduleInput: 'tickets',
    role: 'ADMIN',
  })

  const row = await prisma.user_family_access.findUnique({
    where: {
      userId_familyId_module: { userId: adminId, familyId, module: 'tickets' },
    },
    include: {
      family: { select: { id: true, name: true, code: true, color: true } },
    },
  })

  AuditServiceComplete.log({
    action: AuditActionsComplete.ADMIN_FAMILY_ASSIGNED,
    entityType: 'settings',
    entityId: familyId,
    userId: session.user.id,
    details: { adminId, adminName: targetAdmin.name, familyId },
  }).catch(() => {})

  const assignment = row
    ? {
        id: row.id,
        adminId: row.userId,
        familyId: row.familyId,
        isActive: row.isActive,
        family: row.family,
      }
    : { adminId, familyId, family: null }

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const requester = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  if (!requester?.isSuperAdmin) {
    return NextResponse.json(
      { success: false, message: 'Solo el administrador principal puede gestionar asignaciones' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('adminId')
  const familyId = searchParams.get('familyId')

  if (!adminId || !familyId) {
    return NextResponse.json(
      { success: false, message: 'adminId y familyId son requeridos' },
      { status: 400 }
    )
  }

  await unassignUserModuleFamily({
    userId: adminId,
    familyId,
    moduleInput: 'tickets',
    role: 'ADMIN',
  })

  AuditServiceComplete.log({
    action: AuditActionsComplete.ADMIN_FAMILY_UNASSIGNED,
    entityType: 'settings',
    entityId: familyId,
    userId: session.user.id,
    details: { adminId, familyId },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
