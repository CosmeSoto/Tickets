/**
 * Control de acceso para el módulo de Documentos (Forms).
 *
 * - formsEnabled: puede VER documentos (según visibilidad).
 * - canManageForms: puede CREAR / editar / eliminar (alcance por rol).
 *
 * SuperAdmin / ADMIN: siempre pueden gestionar.
 * TECHNICIAN / CLIENT: requieren canManageForms (+ módulo activo).
 *   - CLIENT: crea solo para su familia
 *   - TECHNICIAN: crea para familias de su alcance
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export interface FormsAccessContext {
  userId: string
  role: string
  isSuperAdmin: boolean
  canManageForms: boolean
}

/**
 * Verifica permiso de gestión (crear/editar/eliminar).
 * Módulo activo solo = lectura. Crear requiere canManageForms.
 */
export async function assertCanManageForms(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null

  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageForms: true, formsEnabled: true },
  })

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  // Lectura ≠ gestión: hace falta el toggle de crear y el módulo activo
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
  _isSuperAdmin: boolean
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null

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
