import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { AssignmentService } from '@/lib/services/assignment-service'
import { randomUUID } from 'crypto'

/**
 * POST /api/test/auto-assign
 * Endpoint de prueba para verificar asignación automática y notificaciones
 */
export async function POST() {
  try {
    // 1. Buscar un ticket sin asignar
    let ticket = await prisma.tickets.findFirst({
      where: {
        assigneeId: null,
        status: 'OPEN'
      },
      include: {
        users_tickets_clientIdTousers: {
          select: { id: true, name: true, email: true }
        },
        categories: {
          select: { id: true, name: true }
        }
      }
    })

    // Si no hay tickets sin asignar, crear uno
    if (!ticket) {
      const client = await prisma.users.findFirst({
        where: { role: 'CLIENT' }
      })

      const category = await prisma.categories.findFirst({
        where: { isActive: true }
      })

      if (!client || !category) {
        return NextResponse.json({
          success: false,
          error: 'No hay clientes o categorías disponibles'
        }, { status: 400 })
      }

      ticket = await prisma.tickets.create({
        data: {
          id: randomUUID(),
          title: 'Ticket de prueba - Asignación automática',
          description: 'Este es un ticket de prueba para verificar la asignación automática y notificaciones',
          priority: 'MEDIUM',
          status: 'OPEN',
          clientId: client.id,
          categoryId: category.id,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        include: {
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true }
          },
          categories: {
            select: { id: true, name: true }
          }
        }
      })
    }

    // 2. Asignar usando el servicio REAL
    const result = await AssignmentService.autoAssignTicket(ticket.id, {
      workloadBalance: true,
      skillMatch: true
    })

    // 3. Verificar notificaciones creadas
    const techNotifications = await prisma.notifications.findMany({
      where: { 
        userId: result.assignedTechnician.id,
        ticketId: ticket.id
      },
      orderBy: { createdAt: 'desc' }
    })

    const clientNotifications = await prisma.notifications.findMany({
      where: { 
        userId: ticket.clientId,
        ticketId: ticket.id
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json({
      success: true,
      data: {
        ticket: {
          id: ticket.id,
          title: ticket.title,
          status: result.ticket.status
        },
        assignedTechnician: {
          id: result.assignedTechnician.id,
          name: result.assignedTechnician.name,
          email: result.assignedTechnician.email,
          reason: result.assignedTechnician.assignmentReason
        },
        notifications: {
          technician: techNotifications.length,
          client: clientNotifications.length,
          details: {
            technician: techNotifications.map(n => ({
              id: n.id,
              title: n.title,
              message: n.message,
              metadata: n.metadata,
              isRead: n.isRead
            })),
            client: clientNotifications.map(n => ({
              id: n.id,
              title: n.title,
              message: n.message,
              metadata: n.metadata,
              isRead: n.isRead
            }))
          }
        }
      }
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
