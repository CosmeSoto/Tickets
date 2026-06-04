/**
 * API: Admin - Single Form Management
 * GET  /api/admin/forms/[id]
 * PUT  /api/admin/forms/[id]
 * DELETE /api/admin/forms/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { assertCanManageForms, assertCanModifyForm } from '@/lib/forms/forms-access'

// Campos comunes de include (mismo que en route.ts padre)
const FORM_INCLUDE = {
  category: true,
  family: true,
  createdBy: { select: { id: true, name: true, email: true } },
  updatedBy: { select: { id: true, name: true, email: true } },
  form_roles: { select: { id: true, role: true } },
  form_users: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  form_departments: {
    select: {
      id: true,
      departmentId: true,
      departments: { select: { id: true, name: true } },
    },
  },
  form_families: {
    select: {
      id: true,
      familyId: true,
      families: { select: { id: true, name: true } },
    },
  },
  _count: { select: { form_downloads: true } },
} as const

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo quien puede gestionar puede acceder al detalle admin
    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

    const form = await prisma.forms.findUnique({
      where: { id },
      include: FORM_INCLUDE,
    })

    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    return NextResponse.json({ form })
  } catch (error) {
    console.error('Error obteniendo formulario:', error)
    return NextResponse.json({ error: 'Error al obtener formulario' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar permiso de gestión
    const deniedManage = await assertCanManageForms(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    // Verificar que puede modificar este documento específico
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const deniedModify = await assertCanModifyForm(
      id,
      session.user.id,
      session.user.role,
      isSuperAdmin
    )
    if (deniedModify) return deniedModify

    const data = await request.json()

    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    // Verificar que el form existe
    const existing = await prisma.forms.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    // TECHNICIAN/CLIENT con canManageForms no pueden cambiar isActive ni isFeatured
    const isAdminRole = session.user.role === 'ADMIN'
    const effectiveIsActive = isAdminRole ? data.isActive !== false : existing.isActive
    const effectiveIsFeatured = isAdminRole ? data.isFeatured === true : existing.isFeatured

    // Actualizar en transacción: primero borrar relaciones antiguas, luego recrear
    const form = await prisma.$transaction(async tx => {
      // Borrar relaciones de visibilidad anteriores
      await tx.form_roles.deleteMany({ where: { formId: id } })
      await tx.form_users.deleteMany({ where: { formId: id } })
      await tx.form_departments.deleteMany({ where: { formId: id } })
      await tx.form_families.deleteMany({ where: { formId: id } })

      // Actualizar el form con los nuevos datos
      return tx.forms.update({
        where: { id },
        data: {
          title: data.title.trim(),
          description: data.description?.trim() || null,
          summary: data.summary?.trim() || null,
          version: data.version?.trim() || null,
          categoryId: data.categoryId || existing.categoryId,
          familyId: data.familyId || null,
          fileUrl: data.fileUrl?.trim() || null,
          fileSize: data.fileSize ?? null,
          fileType: data.fileType?.trim() || null,
          isActive: effectiveIsActive,
          isFeatured: effectiveIsFeatured,
          updatedById: session.user.id,
          // Recrear relaciones de visibilidad
          form_roles: data.roles?.length
            ? { create: data.roles.map((role: string) => ({ role })) }
            : undefined,
          form_users: data.userIds?.length
            ? { create: data.userIds.map((userId: string) => ({ userId })) }
            : undefined,
          form_departments: data.departmentIds?.length
            ? { create: data.departmentIds.map((departmentId: string) => ({ departmentId })) }
            : undefined,
          form_families: data.familyIds?.length
            ? { create: data.familyIds.map((familyId: string) => ({ familyId })) }
            : undefined,
        },
        include: FORM_INCLUDE,
      })
    })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.FORM_UPDATED,
      entityType: 'form',
      entityId: id,
      userId: session.user.id,
      oldValues: {
        title: existing.title,
        isActive: existing.isActive,
        isFeatured: existing.isFeatured,
      },
      newValues: {
        title: data.title?.trim(),
        isActive: effectiveIsActive,
        isFeatured: effectiveIsFeatured,
      },
      request,
    })

    return NextResponse.json({ form })
  } catch (error) {
    console.error('Error actualizando formulario:', error)
    return NextResponse.json({ error: 'Error al actualizar formulario' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar permiso de gestión
    const deniedManage = await assertCanManageForms(session.user.id, session.user.role)
    if (deniedManage) return deniedManage

    // Verificar que puede modificar este documento específico
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    const deniedModify = await assertCanModifyForm(
      id,
      session.user.id,
      session.user.role,
      isSuperAdmin
    )
    if (deniedModify) return deniedModify

    const existing = await prisma.forms.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    // Las relaciones tienen onDelete: Cascade en el schema, así que solo borramos el form
    await prisma.forms.delete({ where: { id } })

    await AuditServiceComplete.log({
      action: AuditActionsComplete.FORM_DELETED,
      entityType: 'form',
      entityId: id,
      userId: session.user.id,
      oldValues: { title: existing.title, isActive: existing.isActive },
      request,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando formulario:', error)
    return NextResponse.json({ error: 'Error al eliminar formulario' }, { status: 500 })
  }
}
