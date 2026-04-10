import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'

/**
 * GET /api/admin/family-assignments?adminId=xxx
 * Lista las familias asignadas a un admin.
 * Solo super admins pueden ver/gestionar esto.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('adminId')

  const where = adminId ? { adminId, isActive: true } : { isActive: true }

  const assignments = await prisma.admin_family_assignments.findMany({
    where,
    include: {
      admin:  { select: { id: true, name: true, email: true } },
      family: { select: { id: true, name: true, code: true, color: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ success: true, data: assignments })
}

/**
 * POST /api/admin/family-assignments
 * Asigna una familia a un admin.
 * Solo super admins pueden hacer esto.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  // Verificar que el solicitante es super admin
  const requester = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { isSuperAdmin: true },
  })
  if (!requester?.isSuperAdmin) {
    return NextResponse.json({ success: false, message: 'Solo el administrador principal puede asignar familias a otros administradores' }, { status: 403 })
  }

  const { adminId, familyId } = await request.json()
  if (!adminId || !familyId) {
    return NextResponse.json({ success: false, message: 'adminId y familyId son requeridos' }, { status: 400 })
  }

  // Verificar que el target es admin
  const targetAdmin = await prisma.users.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, role: true, isActive: true },
  })
  if (!targetAdmin || targetAdmin.role !== 'ADMIN' || !targetAdmin.isActive) {
    return NextResponse.json({ success: false, message: 'El usuario debe ser un administrador activo' }, { status: 400 })
  }

  // Upsert — si ya existe pero inactivo, reactivar
  const existing = await prisma.admin_family_assignments.findUnique({
    where: { adminId_familyId: { adminId, familyId } },
  })

  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ success: false, message: 'La familia ya está asignada a este administrador' }, { status: 409 })
    }
    const updated = await prisma.admin_family_assignments.update({
      where: { id: existing.id },
      data: { isActive: true },
      include: { family: { select: { id: true, name: true, code: true, color: true } } },
    })
    return NextResponse.json({ success: true, data: updated })
  }

  const assignment = await prisma.admin_family_assignments.create({
    data: { id: randomUUID(), adminId, familyId },
    include: { family: { select: { id: true, name: true, code: true, color: true } } },
  })

  AuditServiceComplete.log({
    action: AuditActionsComplete.ADMIN_FAMILY_ASSIGNED,
    entityType: 'family',
    entityId: familyId,
    userId: session.user.id,
    details: { adminId, adminName: targetAdmin.name, familyId },
  }).catch(() => {})

  return NextResponse.json({ success: true, data: assignment }, { status: 201 })
}

/**
 * DELETE /api/admin/family-assignments?adminId=xxx&familyId=yyy
 * Desasigna una familia de un admin.
 * Solo super admins pueden hacer esto.
 */
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
    return NextResponse.json({ success: false, message: 'Solo el administrador principal puede gestionar asignaciones' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const adminId = searchParams.get('adminId')
  const familyId = searchParams.get('familyId')

  if (!adminId || !familyId) {
    return NextResponse.json({ success: false, message: 'adminId y familyId son requeridos' }, { status: 400 })
  }

  await prisma.admin_family_assignments.updateMany({
    where: { adminId, familyId },
    data: { isActive: false },
  })

  AuditServiceComplete.log({
    action: AuditActionsComplete.ADMIN_FAMILY_UNASSIGNED,
    entityType: 'family',
    entityId: familyId,
    userId: session.user.id,
    details: { adminId, familyId },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
