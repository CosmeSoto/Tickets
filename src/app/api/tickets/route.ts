import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { EmailService } from '@/lib/services/email/email-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Parámetros de consulta
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const assigneeId = searchParams.get('assigneeId')
    const categoryId = searchParams.get('categoryId')

    // Construir filtros para Prisma
    const where: any = {}

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (assigneeId) {
      where.assigneeId = assigneeId
    }

    if (categoryId) {
      where.categoryId = categoryId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { users_tickets_clientIdTousers: { name: { contains: search, mode: 'insensitive' } } },
        { users_tickets_clientIdTousers: { email: { contains: search, mode: 'insensitive' } } }
      ]
    }

    // Filtrar por rol del usuario
    if (session.user.role === 'CLIENT') {
      where.clientId = session.user.id
    } else if (session.user.role === 'TECHNICIAN') {
      where.OR = [
        { assigneeId: session.user.id },
        { assigneeId: null } // Tickets sin asignar que puede tomar
      ]
    }

    // Obtener tickets con relaciones
    const [tickets, total] = await Promise.all([
      prisma.tickets.findMany({
        where,
        include: {
          users_tickets_clientIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true
            }
          },
          users_tickets_assigneeIdTousers: {
            select: {
              id: true,
              name: true,
              email: true,
              departmentId: true
            }
          },
          categories: {
            select: {
              id: true,
              name: true,
              color: true,
              level: true
            }
          },
          _count: {
            select: {
              comments: true,
              attachments: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.tickets.count({ where })
    ])

    // Mapear los datos para que coincidan con lo que espera el frontend
    const mappedTickets = tickets.map(ticket => ({
      ...ticket,
      client: ticket.users_tickets_clientIdTousers,
      assignee: ticket.users_tickets_assigneeIdTousers,
      category: ticket.categories,
    }))

    return NextResponse.json({
      success: true,
      data: mappedTickets,
      meta: {
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: (page * limit) < total,
          hasPrev: page > 1
        },
        filters: {
          status,
          priority,
          search,
          assigneeId,
          categoryId
        }
      }
    })
  } catch (error) {
    console.error('Error in tickets API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar los tickets',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 401 }
      )
    }

    const ticketData = await request.json()

    // Validaciones básicas
    if (!ticketData.title?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'El título es requerido'
        },
        { status: 400 }
      )
    }

    if (!ticketData.description?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'La descripción es requerida'
        },
        { status: 400 }
      )
    }

    if (!ticketData.categoryId) {
      return NextResponse.json(
        {
          success: false,
          message: 'La categoría es requerida'
        },
        { status: 400 }
      )
    }

    // Verificar que la categoría existe
    const category = await prisma.categories.findUnique({
      where: { id: ticketData.categoryId }
    })

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: 'Categoría no encontrada'
        },
        { status: 400 }
      )
    }

    // Determinar el clientId basado en el rol del usuario
    let clientId = session.user.id // Por defecto, el usuario actual es el cliente
    
    // Si es admin y especifica un clientId, usar ese
    if (session.user.role === 'ADMIN' && ticketData.clientId) {
      // Verificar que el cliente existe
      const client = await prisma.users.findUnique({
        where: { id: ticketData.clientId }
      })
      
      if (!client) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cliente no encontrado'
          },
          { status: 400 }
        )
      }
      
      clientId = ticketData.clientId
    }

    // Crear nuevo ticket
    const newTicket = await prisma.tickets.create({
      data: {
        id: randomUUID(),
        title: ticketData.title,
        description: ticketData.description,
        priority: ticketData.priority || 'MEDIUM',
        clientId: clientId,
        categoryId: ticketData.categoryId,
        assigneeId: ticketData.assigneeId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      include: {
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true
          }
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
            departmentId: true
          }
        },
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            level: true
          }
        },
        _count: {
          select: {
            comments: true,
            attachments: true
          }
        }
      }
    })

    // Crear entrada en el historial
    await prisma.ticket_history.create({
      data: {
        id: randomUUID(),
        action: 'created',
        comment: 'Ticket creado',
        ticketId: newTicket.id,
        userId: session.user.id,
        createdAt: new Date()
      }
    })

    // ⭐ NUEVO: Asignar SLA al ticket
    await SLAService.assignSLA(newTicket.id).catch(err => {
      console.error('[SLA] Error asignando SLA al ticket:', err)
    })

    // ⭐ NUEVO: Disparar webhook de ticket creado
    await WebhookService.trigger(WebhookService.EVENTS.TICKET_CREATED, {
      ticketId: newTicket.id,
      title: newTicket.title,
      priority: newTicket.priority,
      status: newTicket.status,
      client: {
        id: newTicket.users_tickets_clientIdTousers.id,
        name: newTicket.users_tickets_clientIdTousers.name,
        email: newTicket.users_tickets_clientIdTousers.email
      },
      category: {
        id: newTicket.categories.id,
        name: newTicket.categories.name
      },
      assignee: newTicket.users_tickets_assigneeIdTousers ? {
        id: newTicket.users_tickets_assigneeIdTousers.id,
        name: newTicket.users_tickets_assigneeIdTousers.name,
        email: newTicket.users_tickets_assigneeIdTousers.email
      } : null,
      createdAt: newTicket.createdAt
    }).catch(err => {
      console.error('[WEBHOOK] Error disparando evento TICKET_CREATED:', err)
    })

    // ⭐ NUEVO: Enviar email de notificación al cliente
    await EmailService.queueEmail({
      to: newTicket.users_tickets_clientIdTousers.email,
      subject: `Ticket #${newTicket.id.substring(0, 8)} creado`,
      template: 'ticket-created',
      templateData: {
        ticketId: newTicket.id,
        title: newTicket.title,
        clientName: newTicket.users_tickets_clientIdTousers.name,
        priority: newTicket.priority,
        category: newTicket.categories.name
      }
    }, session.user.id).catch(err => {
      console.error('[EMAIL] Error enviando email de ticket creado:', err)
    })

    // Mapear los datos para que coincidan con lo que espera el frontend
    const mappedTicket = {
      ...newTicket,
      client: newTicket.users_tickets_clientIdTousers,
      assignee: newTicket.users_tickets_assigneeIdTousers,
      category: newTicket.categories,
    }

    return NextResponse.json({
      success: true,
      data: mappedTicket,
      message: 'Ticket creado exitosamente'
    })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}