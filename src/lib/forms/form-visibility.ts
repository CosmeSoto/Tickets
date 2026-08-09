/**
 * Visibilidad y acceso de lectura del módulo de Documentos (Forms).
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

export type FormViewer = {
  id: string
  role: UserRole
  departmentId: string | null
  /** Familia nativa (departamento) */
  familyId: string | null
  /** Familias del scope (nativa + asignaciones) para matching de visibilidad */
  familyIds: string[]
  isSuperAdmin: boolean
  formsEnabled: boolean
  canManageForms: boolean
}

export type FormVisibilityData = {
  isActive: boolean
  createdById: string
  form_roles: { role: UserRole }[]
  form_users: { userId: string }[]
  form_departments: { departmentId: string }[]
  form_families: { familyId: string }[]
}

const FORM_VISIBILITY_INCLUDE = {
  form_roles: true,
  form_users: true,
  form_departments: true,
  form_families: true,
} as const

export async function getFormViewer(userId: string): Promise<FormViewer | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      departmentId: true,
      isSuperAdmin: true,
      formsEnabled: true,
      canManageForms: true,
      departments: { select: { familyId: true } },
    },
  })

  if (!user) return null

  const nativeFamilyId = user.departments?.familyId ?? null
  let familyIds: string[] = nativeFamilyId ? [nativeFamilyId] : []

  if (!(user.role === 'ADMIN' && user.isSuperAdmin)) {
    const { resolveModuleFamilyScopeIds } = await import('@/lib/auth/user-family-access')
    familyIds = await resolveModuleFamilyScopeIds(userId, 'content', 'canView')
  }

  return {
    id: user.id,
    role: user.role,
    departmentId: user.departmentId,
    familyId: nativeFamilyId,
    familyIds,
    isSuperAdmin: user.isSuperAdmin === true,
    formsEnabled: user.formsEnabled === true,
    canManageForms: user.canManageForms === true,
  }
}

export function hasFormsModuleAccess(viewer: FormViewer): boolean {
  return viewer.isSuperAdmin || viewer.formsEnabled || viewer.canManageForms
}

export function buildFormVisibilityConditions(viewer: FormViewer) {
  const conditions: Record<string, unknown>[] = [
    {
      form_roles: { none: {} },
      form_users: { none: {} },
      form_departments: { none: {} },
      form_families: { none: {} },
    },
    { form_roles: { some: { role: viewer.role } } },
    { form_users: { some: { userId: viewer.id } } },
    { createdById: viewer.id },
  ]

  if (viewer.departmentId) {
    conditions.push({ form_departments: { some: { departmentId: viewer.departmentId } } })
  }
  if (viewer.familyIds.length > 0) {
    conditions.push({ form_families: { some: { familyId: { in: viewer.familyIds } } } })
  } else if (viewer.familyId) {
    conditions.push({ form_families: { some: { familyId: viewer.familyId } } })
  }

  return conditions
}

export function userCanAccessForm(form: FormVisibilityData, viewer: FormViewer): boolean {
  if (viewer.isSuperAdmin || form.createdById === viewer.id) return true
  if (!form.isActive) return false

  const noRestrictions =
    form.form_roles.length === 0 &&
    form.form_users.length === 0 &&
    form.form_departments.length === 0 &&
    form.form_families.length === 0

  if (noRestrictions) return true

  return (
    form.form_roles.some(r => r.role === viewer.role) ||
    form.form_users.some(u => u.userId === viewer.id) ||
    (viewer.departmentId
      ? form.form_departments.some(d => d.departmentId === viewer.departmentId)
      : false) ||
    (viewer.familyIds.length > 0
      ? form.form_families.some(f => viewer.familyIds.includes(f.familyId))
      : viewer.familyId
        ? form.form_families.some(f => f.familyId === viewer.familyId)
        : false)
  )
}

export async function assertCanViewForm(
  formId: string,
  userId: string
): Promise<NextResponse | null> {
  const viewer = await getFormViewer(userId)
  if (!viewer) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (!hasFormsModuleAccess(viewer)) {
    return NextResponse.json({ error: 'No tienes acceso al módulo de documentos' }, { status: 403 })
  }

  const form = await prisma.forms.findUnique({
    where: { id: formId },
    include: FORM_VISIBILITY_INCLUDE,
  })

  if (!form) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (!userCanAccessForm(form, viewer)) {
    return NextResponse.json({ error: 'No tienes acceso a este documento' }, { status: 403 })
  }

  return null
}

export function getFormNotificationLink(viewer: {
  role: string
  canManageForms?: boolean
}): string {
  // ADMIN gestiona en /admin/forms; el resto (lectura o crear) usa /forms
  if (viewer.role === 'ADMIN') return '/admin/forms'
  return '/forms'
}

export async function getFormNotificationRecipientIds(
  formId: string,
  excludeUserId?: string
): Promise<Array<{ id: string; role: string; canManageForms: boolean }>> {
  const form = await prisma.forms.findUnique({
    where: { id: formId },
    include: FORM_VISIBILITY_INCLUDE,
  })

  if (!form || !form.isActive) return []

  const moduleAccess = {
    isActive: true,
    OR: [{ formsEnabled: true }, { canManageForms: true }, { role: 'ADMIN' as const }],
  }

  const noRestrictions =
    form.form_roles.length === 0 &&
    form.form_users.length === 0 &&
    form.form_departments.length === 0 &&
    form.form_families.length === 0

  const visibilityOr: Record<string, unknown>[] = []
  if (form.form_roles.length > 0) {
    visibilityOr.push({ role: { in: form.form_roles.map(r => r.role) } })
  }
  if (form.form_users.length > 0) {
    visibilityOr.push({ id: { in: form.form_users.map(u => u.userId) } })
  }
  if (form.form_departments.length > 0) {
    visibilityOr.push({
      departmentId: { in: form.form_departments.map(d => d.departmentId) },
    })
  }
  if (form.form_families.length > 0) {
    visibilityOr.push({
      departments: { familyId: { in: form.form_families.map(f => f.familyId) } },
    })
  }

  return prisma.users.findMany({
    where: {
      ...moduleAccess,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      ...(noRestrictions ? {} : { OR: visibilityOr }),
    },
    select: { id: true, role: true, canManageForms: true },
  })
}
