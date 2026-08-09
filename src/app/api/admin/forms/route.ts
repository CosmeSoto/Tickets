/**
 * API: Admin - Forms Management
 * GET /api/admin/forms
 * POST /api/admin/forms
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { assertCanManageForms } from '@/lib/forms/forms-access'
import {
  getContentVisibilityScope,
  sanitizeVisibilityPayload,
} from '@/lib/content/visibility-scope'
import { buildVisibilityAuditSummary } from '@/lib/content/visibility-audit'
import { buildFormVisibilityConditions, getFormViewer } from '@/lib/forms/form-visibility'

// Campos comunes de include para devolver un form completo
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Solo ADMIN o gestores (TECH canManage / CLIENT con módulo) pueden listar gestión
    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const categoryId = searchParams.get('categoryId')
    const search = searchParams.get('search')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
    // Super Admin ve todo; el resto solo documentos visibles / propios
    if (!(session.user.role === 'ADMIN' && isSuperAdmin)) {
      const viewer = await getFormViewer(session.user.id)
      if (viewer) {
        where.OR = buildFormVisibilityConditions(viewer)
      }
    }

    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false

    if (categoryId) where.categoryId = categoryId

    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
      if (where.OR) {
        where.AND = [{ OR: where.OR }, searchCondition]
        delete where.OR
      } else {
        Object.assign(where, searchCondition)
      }
    }

    const forms = await prisma.forms.findMany({
      where,
      include: FORM_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ forms })
  } catch (error) {
    console.error('Error obteniendo formularios:', error)
    return NextResponse.json({ error: 'Error al obtener formularios' }, { status: 500 })
  }
}

/** Genera un slug único a partir del título */
async function generateSlug(title: string): Promise<string> {
  const base = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 180)

  const slug = `${base}-${Date.now()}`
  return slug
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar permiso de gestión
    const denied = await assertCanManageForms(session.user.id, session.user.role)
    if (denied) return denied

    const data = await request.json()

    if (!data.title?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }

    if (!data.categoryId) {
      return NextResponse.json({ error: 'La categoría es obligatoria' }, { status: 400 })
    }

    const isSuperAdmin =
      (
        await prisma.users.findUnique({
          where: { id: session.user.id },
          select: { isSuperAdmin: true },
        })
      )?.isSuperAdmin === true
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

    const slug = await generateSlug(data.title)
    const isAdminRole = session.user.role === 'ADMIN'

    const form = await prisma.forms.create({
      data: {
        title: data.title.trim(),
        slug,
        description: data.description?.trim() || null,
        summary: data.summary?.trim() || null,
        version: data.version?.trim() || null,
        categoryId: data.categoryId,
        familyId: sanitized.familyId,
        fileUrl: data.fileUrl?.trim() || null,
        fileSize: data.fileSize ?? null,
        fileType: data.fileType?.trim() || null,
        isActive: isAdminRole ? data.isActive !== false : true,
        isFeatured: isAdminRole ? data.isFeatured === true : false,
        createdById: session.user.id,
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

    await AuditServiceComplete.log({
      action: AuditActionsComplete.FORM_CREATED,
      entityType: 'form',
      entityId: form.id,
      userId: session.user.id,
      newValues: {
        title: form.title,
        categoryId: form.categoryId,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        ...buildVisibilityAuditSummary(sanitized),
      },
      details: {
        notified: form.isActive,
        source: 'forms_module',
      },
      request,
    })

    // Notificar a usuarios con el módulo de documentos habilitado
    if (form.isActive) {
      try {
        const { NotificationService } = await import('@/lib/services/notification-service')
        const { NotificationType } = await import('@prisma/client')
        const { getFormNotificationLink, getFormNotificationRecipientIds } =
          await import('@/lib/forms/form-visibility')

        const targetUsers = await getFormNotificationRecipientIds(form.id, session.user.id)

        await Promise.allSettled(
          targetUsers.map(u =>
            NotificationService.push({
              userId: u.id,
              type: NotificationType.INFO,
              title: 'Nuevo documento disponible',
              message: `${form.title}`,
              metadata: {
                link: getFormNotificationLink(u),
                formId: form.id,
              },
            })
          )
        )
      } catch {
        // no-op: notificación opcional
      }
    }

    return NextResponse.json({ form }, { status: 201 })
  } catch (error) {
    console.error('Error creando formulario:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    // Prisma P2002 = unique constraint (slug duplicado, muy improbable con timestamp)
    return NextResponse.json(
      { error: 'Error al crear formulario', detail: message },
      { status: 500 }
    )
  }
}
