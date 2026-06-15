/**
 * GET    /api/patrols/incidents/[id] — Detalle de novedad
 * PATCH  /api/patrols/incidents/[id] — Editar novedad (dentro de ventana)
 * DELETE /api/patrols/incidents/[id] — Eliminar novedad (dentro de ventana)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { PatrolIncidentService } from '@/lib/services/patrol-incident.service'
import { checkPatrolFamilyAccess } from '@/lib/patrol/patrol-access'

const updateIncidentSchema = z.object({
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres').optional(),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  photoBase64: z.string().optional(),
})

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const incident = await PatrolIncidentService.getById(id)

    if (!incident) {
      return NextResponse.json({ error: 'Novedad no encontrada' }, { status: 404 })
    }

    // Fetch familyId from the patrol for access control and edit window check
    const patrol = await prisma.patrols.findUnique({
      where: { id: incident.patrol.id },
      select: { familyId: true },
    })

    const familyId = patrol?.familyId ?? ''

    // Access control: agent (owner) can view; admin can view any; technician with family access can view
    const isOwner = incident.agentId === session.user.id
    const sessionUser = session.user as any

    if (!isOwner) {
      if (session.user.role === 'CLIENT') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }

      if (session.user.role === 'ADMIN' || session.user.role === 'TECHNICIAN') {
        const hasAccess = await checkPatrolFamilyAccess(
          session.user.id,
          familyId,
          session.user.role,
          sessionUser.isSuperAdmin ?? false
        )

        if (!hasAccess) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }
      } else {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
      }
    }

    // Compute isEditable: requester is the agent, novedad is OPEN, AND within edit window
    let isEditable = false
    if (isOwner) {
      try {
        const isOpen = (incident as any).status === 'OPEN'
        isEditable = isOpen && (await PatrolIncidentService.isWithinEditWindow(incident, familyId))
      } catch {
        isEditable = false
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...incident, isEditable },
    })
  } catch (error) {
    console.error('[patrols/incidents/[id]] GET:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    // Validate body with Zod
    const parsed = updateIncidentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const updatedIncident = await PatrolIncidentService.update(id, parsed.data, session.user.id)

    return NextResponse.json({ success: true, data: updatedIncident })
  } catch (error: any) {
    console.error('[patrols/incidents/[id]] PATCH:', error)

    const message = error?.message ?? ''

    if (message === 'Novedad no encontrada') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (message === 'No autorizado: no es el autor de esta novedad') {
      return NextResponse.json({ error: message }, { status: 403 })
    }

    if (message === 'No se puede editar una novedad que ya fue resuelta o escalada') {
      return NextResponse.json({ error: message, code: 'INCIDENT_CLOSED' }, { status: 409 })
    }

    if (message === 'El período de edición ha expirado') {
      return NextResponse.json({ error: message, code: 'EDIT_WINDOW_EXPIRED' }, { status: 403 })
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { id } = await params

    await PatrolIncidentService.delete(id, session.user.id)

    return NextResponse.json({ success: true, message: 'Novedad eliminada' })
  } catch (error: any) {
    console.error('[patrols/incidents/[id]] DELETE:', error)

    const message = error?.message ?? ''

    if (message === 'Novedad no encontrada') {
      return NextResponse.json({ error: message }, { status: 404 })
    }

    if (message === 'No autorizado: no es el autor de esta novedad') {
      return NextResponse.json({ error: message }, { status: 403 })
    }

    if (message === 'No se puede eliminar una novedad que ya fue resuelta o escalada') {
      return NextResponse.json({ error: message, code: 'INCIDENT_CLOSED' }, { status: 409 })
    }

    if (message === 'El período de edición ha expirado') {
      return NextResponse.json({ error: message, code: 'EDIT_WINDOW_EXPIRED' }, { status: 403 })
    }

    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
