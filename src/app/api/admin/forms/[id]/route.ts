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
import {
  getContentVisibilityScope,
  sanitizeVisibilityPayload,
} from '@/lib/content/visibility-scope'
import { buildVisibilityAuditSummary } from '@/lib/content/visibility-audit'
import { buildFormVisibilityConditions, getFormViewer } from '@/lib/forms/form-visibility'

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

    const viewer = await getFormViewer(session.user.id)
    if (!viewer?.isSuperAdmin) {
      const inScope = await prisma.forms.count({
        where: {
          id,
          OR: viewer ? buildFormVisibilityConditions(viewer) : [{ createdById: session.user.id }],
        },
      })
      if (!inScope) {
        return NextResponse.json({ error: 'No tienes acceso a este documento' }, { status: 403 })
      }
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
    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
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

    // TECHNICIAN/CLIENT no pueden cambiar isActive ni isFeatured
    const isAdminRole = session.user.role === 'ADMIN'
    const effectiveIsActive = isAdminRole ? data.isActive !== false : existing.isActive
    const effectiveIsFeatured = isAdminRole ? data.isFeatured === true : existing.isFeatured

    const visScope = await getContentVisibilityScope(
      session.user.id,
      session.user.role,
      isSuperAdmin
    )
    const sanitized = await sanitizeVisibilityPayload(visScope, {
      roles: data.roles,
      familyIds: data.familyIds,
      departmentIds: data.departmentIds,
      userIds: data.userIds,
      familyId: data.familyId,
    })
    if (sanitized instanceof NextResponse) return sanitized

    // Actualizar en transacción: primero borrar relaciones antiguas, luego recrear
    const form = await prisma.$transaction(async tx => {
      await tx.form_roles.deleteMany({ where: { formId: id } })
      await tx.form_users.deleteMany({ where: { formId: id } })
      await tx.form_departments.deleteMany({ where: { formId: id } })
      await tx.form_families.deleteMany({ where: { formId: id } })

      return tx.forms.update({
        where: { id },
        data: {
          title: data.title.trim(),
          description: data.description?.trim() || null,
          summary: data.summary?.trim() || null,
          version: data.version?.trim() || null,
          categoryId: data.categoryId || existing.categoryId,
          familyId: sanitized.familyId,
          fileUrl: data.fileUrl?.trim() || null,
          fileSize: data.fileSize ?? null,
          fileType: data.fileType?.trim() || null,
          isActive: effectiveIsActive,
          isFeatured: effectiveIsFeatured,
          updatedById: session.user.id,
          form_roles: sanitized.roles.length
            ? { create: sanitized.roles.map(role => ({ role })) }
            : undefined,
          form_users: sanitized.userIds.length
            ? { create: sanitized.userIds.map(userId => ({ userId })) }
            : undefined,
          form_departments: sanitized.departmentIds.length
            ? { create: sanitized.departmentIds.map(departmentId => ({ departmentId })) }
            : undefined,
          form_families: sanitized.familyIds.length
            ? { create: sanitized.familyIds.map(familyId => ({ familyId })) }
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
        ...buildVisibilityAuditSummary(sanitized),
      },
      details: {
        becameActive: !existing.isActive && effectiveIsActive,
        source: 'forms_module',
      },
      request,
    })

    // Notificar al activar un documento que estaba inactivo
    if (!existing.isActive && effectiveIsActive) {
      try {
        const { NotificationService } = await import('@/lib/services/notification-service')
        const { NotificationType } = await import('@prisma/client')
        const { getFormNotificationLink, getFormNotificationRecipientIds } =
          await import('@/lib/forms/form-visibility')

        const targetUsers = await getFormNotificationRecipientIds(id, session.user.id)
        await Promise.allSettled(
          targetUsers.map(u =>
            NotificationService.push({
              userId: u.id,
              type: NotificationType.INFO,
              title: 'Documento disponible',
              message: `${form.title}`,
              metadata: {
                link: getFormNotificationLink(u),
                formId: form.id,
              },
            })
          )
        )
      } catch {
        // no-op
      }
    }

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
    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
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
