/**
 * Control de acceso para el módulo de Documentos (Forms).
 *
 * Roles y capacidades:
 *
 * SuperAdmin (ADMIN + isSuperAdmin):
 *   - Ve todos los documentos sin excepción
 *   - Puede crear, editar y eliminar cualquier documento
 *
 * Admin normal (ADMIN sin isSuperAdmin):
 *   - Ve todos los documentos (igual que SuperAdmin en lectura)
 *   - Puede gestionar (crear/editar/eliminar) documentos de sus familias asignadas
 *
 * TECHNICIAN o CLIENT con canManageForms=true:
 *   - Ve solo documentos donde tiene visibilidad (formsEnabled debe estar activo)
 *   - Puede crear documentos nuevos
 *   - Puede editar/eliminar únicamente los documentos que él mismo creó
 *
 * Cualquier usuario con formsEnabled=true:
 *   - Ve documentos según reglas de visibilidad (rol, familia, departamento, usuario específico)
 *   - NO puede gestionar nada
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
 * Verifica si el usuario tiene permiso para gestionar (crear/editar/eliminar) documentos.
 * Devuelve un NextResponse 403 si no tiene acceso, o null si sí tiene.
 */
export async function assertCanManageForms(
  userId: string,
  role: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null // Admins siempre pueden gestionar

  // TECHNICIAN o CLIENT: necesitan canManageForms explícito
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { canManageForms: true, formsEnabled: true },
  })

  if (!user?.canManageForms) {
    return NextResponse.json(
      { error: 'No tienes permisos para gestionar documentos' },
      { status: 403 }
    )
  }

  return null
}

/**
 * Verifica si el usuario puede editar o eliminar un documento específico.
 *
 * - SuperAdmin: siempre sí
 * - Admin normal: sí (todos los documentos)
 * - TECHNICIAN/CLIENT con canManageForms: solo los que crearon
 */
export async function assertCanModifyForm(
  formId: string,
  userId: string,
  role: string,
  isSuperAdmin: boolean
): Promise<NextResponse | null> {
  // SuperAdmin y Admin tienen acceso total a modificar
  if (role === 'ADMIN') return null

  // TECHNICIAN/CLIENT: solo pueden tocar sus propios documentos
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
