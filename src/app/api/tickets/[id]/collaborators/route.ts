import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { NotificationService } from '@/lib/services/notification-service'

/**
 * GET /api/tickets/[id]/collaborators
 * Lista los colaboradores del ticket
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false }, { status: 401 })

  const { id: ticketId } = await params

  const collaborators = await prisma.ticket_collaborators.findMany({
    where: { ticketId },
    include: {
      collaborator: { select: { id: true, name: true, email: true, role: true, avatar: true } },
      addedBy:      { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({ success: true, data: collaborators })
}

/**
 * POST /api/tickets/[id]/collaborators
 * Agrega un colaborador al ticket.
 * Solo el técnico asignado o un admin puede agregar colaboradores.
 * El colaborador debe ser TECHNICIAN y pertenecer a la misma familia del ticket.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false }, { status: 401 })

  const { id: ticketId } = await params
  const { collaboratorId } = await request.json()

  if (!collaboratorId) {
    return NextResponse.json({ success: false, message: 'collaboratorId requerido' }, { status: 400 })
  }

  // Cargar ticket
  const ticket = await prisma.tickets.findUnique({
    where: { id: ticketId },
    select: { id: true, assigneeId: true, familyId: true, title: true },
  })
  if (!ticket) return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })

  // Solo el técnico asignado o admin puede agregar colaboradores
  const isAdmin = session.user.role === 'ADMIN'
  const isAssignee = session.user.role === 'TECHNICIAN' && ticket.assigneeId === session.user.id
  if (!isAdmin && !isAssignee) {
    return NextResponse.json({ success: false, message: 'Solo el técnico asignado o un administrador puede agregar colaboradores' }, { status: 403 })
  }

  // El colaborador debe ser técnico activo
  const collaborator = await prisma.users.findUnique({
    where: { id: collaboratorId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  })
  if (!collaborator || !collaborator.isActive || collaborator.role !== 'TECHNICIAN') {
    return NextResponse.json({ success: false, message: 'El colaborador debe ser un técnico activo' }, { status: 400 })
  }

  // No puede ser el mismo técnico asignado
  if (collaboratorId === ticket.assigneeId) {
    return NextResponse.json({ success: false, message: 'El técnico asignado ya está en el ticket' }, { status: 400 })
  }

  // Verificar que el colaborador pertenece a la familia del ticket (si aplica)
  if (ticket.familyId) {
    const familyAssignment = await prisma.technician_family_assignments.findFirst({
      where: { technicianId: collaboratorId, familyId: ticket.familyId, isActive: true },
    })
    if (!familyAssignment) {
      return NextResponse.json({
        success: false,
        message: 'El técnico no está asignado a la familia de este ticket',
      }, { status: 400 })
    }
  }

  // Crear colaboración (upsert para evitar duplicados)
  const existing = await prisma.ticket_collaborators.findUnique({
    where: { ticketId_collaboratorId: { ticketId, collaboratorId } },
  })
  if (existing) {
    return NextResponse.json({ success: false, message: 'El técnico ya es colaborador de este ticket' }, { status: 409 })
  }

  const collaboration = await prisma.ticket_collaborators.create({
    data: {
      id: randomUUID(),
      ticketId,
      collaboratorId,
      addedById: session.user.id,
    },
    include: {
      collaborator: { select: { id: true, name: true, email: true, role: true } },
    },
  })

  // Registrar en historial
  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      ticketId,
      userId: session.user.id,
      action: 'collaborator_added',
      comment: `${collaborator.name} agregado como colaborador`,
      createdAt: new Date(),
    },
  }).catch(() => {})

  // Notificar al colaborador
  await NotificationService.push({
    userId: collaboratorId,
    type: 'INFO',
    title: 'Agregado como colaborador',
    message: `Has sido agregado como colaborador en el ticket "${ticket.title}"`,
    ticketId,
  }).catch(() => {})

  return NextResponse.json({ success: true, data: collaboration }, { status: 201 })
}

/**
 * DELETE /api/tickets/[id]/collaborators?collaboratorId=xxx
 * Elimina un colaborador del ticket.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ success: false }, { status: 401 })

  const { id: ticketId } = await params
  const { searchParams } = new URL(request.url)
  const collaboratorId = searchParams.get('collaboratorId')

  if (!collaboratorId) {
    return NextResponse.json({ success: false, message: 'collaboratorId requerido' }, { status: 400 })
  }

  const ticket = await prisma.tickets.findUnique({
    where: { id: ticketId },
    select: { assigneeId: true },
  })
  if (!ticket) return NextResponse.json({ success: false, message: 'Ticket no encontrado' }, { status: 404 })

  const isAdmin = session.user.role === 'ADMIN'
  const isAssignee = session.user.role === 'TECHNICIAN' && ticket.assigneeId === session.user.id
  if (!isAdmin && !isAssignee) {
    return NextResponse.json({ success: false, message: 'Sin permisos para eliminar colaboradores' }, { status: 403 })
  }

  await prisma.ticket_collaborators.deleteMany({
    where: { ticketId, collaboratorId },
  })

  await prisma.ticket_history.create({
    data: {
      id: randomUUID(),
      ticketId,
      userId: session.user.id,
      action: 'collaborator_removed',
      comment: 'Colaborador eliminado del ticket',
      createdAt: new Date(),
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
