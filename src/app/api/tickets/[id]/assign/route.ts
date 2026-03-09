import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params
    const assignmentData = await request.json()

    // Validaciones
    if (assignmentData.assigneeId !== null && typeof assignmentData.assigneeId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: 'ID del técnico inválido'
        },
        { status: 400 }
      )
    }

    // Obtener el ticket actual para comparar
    const currentTicket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: {
        assigneeId: true,
        users_tickets_assigneeIdTousers: {
          select: { id: true, name: true, email: true }
        }
      }
    })

    if (!currentTicket) {
      return NextResponse.json(
        {
          success: false,
          message: 'Ticket no encontrado'
        },
        { status: 404 }
      )
    }

    // Actualizar asignación en base de datos
    const updatedTicket = await prisma.tickets.update({
      where: { id: ticketId },
      data: {
        assigneeId: assignmentData.assigneeId,
        status: assignmentData.assigneeId ? 'IN_PROGRESS' : 'OPEN',
        updatedAt: new Date()
      },
      include: {
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    // Crear entrada en el historial
    const oldAssigneeName = currentTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'
    const newAssigneeName = updatedTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar'

    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        ticketId,
        userId: session.user.id,
        action: assignmentData.assigneeId ? 'assigned' : 'unassigned',
        comment: assignmentData.comment || `Asignación cambiada de ${oldAssigneeName} a ${newAssigneeName}`,
        createdAt: new Date()
      }
    })

    // Enviar notificaciones si se asignó a un técnico
    if (assignmentData.assigneeId && assignmentData.assigneeId !== currentTicket.assigneeId) {
      const { NotificationService } = await import('@/lib/services/notification-service')
      await NotificationService.notifyTicketAssigned(ticketId, assignmentData.assigneeId).catch(err => {
        console.error('[ASSIGN] Error enviando notificaciones:', err)
      })

      // ⭐ NUEVO: Enviar email al técnico asignado
      const { 
        triggerTicketAssignedToTechnicianEmail,
        triggerTicketAssignedToClientEmail 
      } = await import('@/lib/email-triggers')
      
      triggerTicketAssignedToTechnicianEmail(ticketId)
      triggerTicketAssignedToClientEmail(ticketId)
    }

    return NextResponse.json({
      success: true,
      data: {
        ticket: updatedTicket
      },
      message: assignmentData.assigneeId ? 'Ticket asignado exitosamente' : 'Asignación removida exitosamente'
    })
  } catch (error) {
    console.error('Error in assign PATCH API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar la asignación del ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { id: ticketId } = await params
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    
    // Si es asignación automática
    if (mode === 'auto') {
      const body = await request.json()
      
      console.log('[AUTO-ASSIGN] Iniciando asignación automática para ticket:', ticketId)
      console.log('[AUTO-ASSIGN] Criterios:', body)
      
      // ⭐ IMPORTAR Y USAR EL SERVICIO REAL
      const { AssignmentService } = await import('@/lib/services/assignment-service')
      
      try {
        const result = await AssignmentService.autoAssignTicket(ticketId, {
          workloadBalance: body.workloadBalance !== false,
          skillMatch: body.skillMatch !== false,
        })

        console.log('[AUTO-ASSIGN] ✅ Asignación exitosa:', result.assignedTechnician.name)
        return NextResponse.json(result)
      } catch (error) {
        console.error('[AUTO-ASSIGN] ❌ Error:', error)
        console.error('[AUTO-ASSIGN] Stack:', error instanceof Error ? error.stack : 'No stack')
        return NextResponse.json(
          {
            error: error instanceof Error ? error.message : 'Error en asignación automática'
          },
          { status: 400 }
        )
      }
    }

    // Para otros tipos de POST, redirigir a PATCH
    return NextResponse.json(
      { error: 'Método no soportado para este tipo de asignación' },
      { status: 405 }
    )

  } catch (error) {
    console.error('Error in assign POST API:', error)
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
