/**
 * Control de acceso para el módulo de Documentos (Forms).
 *
 * - formsEnabled: puede VER documentos (según visibilidad).
 * - canManageForms: puede CREAR / editar / eliminar (TECH/CLIENT).
 * - ADMIN de familia: módulo ON (formsEnabled) implica gestión; OFF = sin acceso.
 * - Super Admin: siempre puede gestionar.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { buildFormVisibilityConditions, getFormViewer } from '@/lib/forms/form-visibility'

export interface FormsAccessContext {
  userId: string
  role: string
  isSuperAdmin: boolean
  canManageForms: boolean
}

/**
 * Verifica permiso de gestión (crear/editar/eliminar).
 * Módulo activo solo = lectura. Crear requiere canManageForms (o ADMIN con módulo ON).
 */
export async function assertCanManageForms(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageForms: true, formsEnabled: true, isSuperAdmin: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  if (user.isSuperAdmin) return null

  if (role === 'ADMIN') {
    if (!user.formsEnabled) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar documentos' },
        { status: 403 }
      )
    }
    return null
  }

  if (!user.canManageForms || !user.formsEnabled) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar documentos' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Verifica si el usuario puede editar o eliminar un documento específico.
 */
export async function assertCanModifyForm(
  formId: string,
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<NextResponse | null> {
  if (isSuperAdmin) return null

  if (role === 'ADMIN') {
    const viewer = await getFormViewer(userId)
    if (!viewer?.formsEnabled) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar documentos' },
        { status: 403 }
      )
    }

    // ADMIN de familia: mismo alcance de visibilidad que ya usa el GET de
    // administración de este documento (admin/forms/[id]/route.ts) — antes
    // formsEnabled=true bastaba para editar/borrar/reemplazar el adjunto de
    // CUALQUIER documento del sistema, incluidos los de otra familia que ni
    // siquiera puede ver por GET.
    const inScope = await prisma.forms.count({
      where: { id: formId, OR: buildFormVisibilityConditions(viewer) },
    })
    if (inScope === 0) {
      return NextResponse.json({ error: 'No tienes acceso a este documento' }, { status: 403 })
    }
    return null
  }

  const form = await prisma.forms.findUnique({
    where: { id: formId },
    select: { createdById: true },
  })

  if (!form) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 })
  }

  if (form.createdById !== userId) {
    return NextResponse.json(
      { error: 'Solo puedes editar o eliminar documentos que tú creaste' },
      { status: 403 }
    )
  }

  return null
}
