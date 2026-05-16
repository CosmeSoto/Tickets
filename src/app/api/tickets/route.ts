import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { WebhookService } from '@/lib/services/webhook-service'
import { SLAService } from '@/lib/services/sla-service'
import { EmailService } from '@/lib/services/email/email-service'
import { AuditServiceComplete, AuditActionsComplete } from '@/lib/services/audit-service-complete'
import { NotificationService } from '@/lib/services/notification-service'
import { TicketService } from '@/lib/services/ticket-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
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
    const familyId = searchParams.get('familyId')
    const clientIdParam = searchParams.get('clientId')

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

    if (familyId) {
      where.familyId = familyId
    }

    if (session.user.role === 'ADMIN' && clientIdParam) {
      where.clientId = clientIdParam
    }

    /** Fragmentos AND adicionales (búsqueda, alcance técnico) para no pisar `where.OR` de la búsqueda */
    const andParts: any[] = []

    if (search) {
      const searchConditions: any[] = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { users_tickets_clientIdTousers: { name: { contains: search, mode: 'insensitive' } } },
        { users_tickets_clientIdTousers: { email: { contains: search, mode: 'insensitive' } } },
      ]
      if (search.includes('-')) {
        searchConditions.push({ ticketCode: { contains: search, mode: 'insensitive' } })
      }
      andParts.push({ OR: searchConditions })
    }

    const viewMode = searchParams.get('viewMode')

    if (session.user.role === 'CLIENT') {
      where.clientId = session.user.id
    } else if (session.user.role === 'TECHNICIAN') {
      if (viewMode === 'created') {
        where.clientId = session.user.id
      } else {
        const techFamilies = await prisma.technician_family_assignments.findMany({
          where: { technicianId: session.user.id, isActive: true },
          select: { familyId: true },
        })
        const techFamilyIds = techFamilies.map(a => a.familyId)

        if (techFamilyIds.length > 0) {
          andParts.push({ familyId: { in: techFamilyIds } })
          andParts.push({
            OR: [{ assigneeId: session.user.id }, { assigneeId: null }],
          })
        } else {
          andParts.push({
            OR: [{ assigneeId: session.user.id }, { assigneeId: null }],
          })
        }
      }
    } else if (session.user.role === 'ADMIN' && !(session.user as any).isSuperAdmin) {
      // Admin Normal: filtrar tickets por su scope de familias (admin_family_assignments + nativa)
      const { getUserFamilyScope, buildFamilyFilter } = await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, 'ADMIN', false)
      const familyFilter = buildFamilyFilter(scope)
      if (Object.keys(familyFilter).length > 0) {
        andParts.push(familyFilter)
      }
    }

    if (andParts.length > 0) {
      where.AND = andParts
    }

    // Obtener tickets con relaciones — select explícito para evitar traer campos pesados
    const [tickets, total] = await Promise.all([
      prisma.tickets.findMany({
        where,
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          ticketCode: true,
          codeIsManual: true,
          familyId: true,
          categoryId: true,
          clientId: true,
          assigneeId: true,
          createdAt: true,
          updatedAt: true,
          resolvedAt: true,
          closedAt: true,
          slaDeadline: true,
          users_tickets_clientIdTousers: {
            select: { id: true, name: true, email: true, departmentId: true },
          },
          users_tickets_assigneeIdTousers: {
            select: { id: true, name: true, email: true },
          },
          categories: {
            select: { id: true, name: true, color: true, level: true },
          },
          family: {
            select: { id: true, name: true, code: true, color: true },
          },
          _count: {
            select: { comments: true, attachments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tickets.count({ where }),
    ])

    const mappedTickets = tickets.map(ticket => ({
      ...ticket,
      client: ticket.users_tickets_clientIdTousers,
      assignee: ticket.users_tickets_assigneeIdTousers,
      category: ticket.categories,
      family: ticket.family,
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
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
        filters: {
          status,
          priority,
          search,
          assigneeId,
          categoryId,
          familyId,
          clientId: clientIdParam,
        },
      },
    })
  } catch (error) {
    console.error('Error in tickets API:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al cargar los tickets',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, message: 'No autorizado' }, { status: 401 })
    }

    const ticketData = await request.json()

    // Validaciones básicas
    if (!ticketData.title?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'El título es requerido',
        },
        { status: 400 }
      )
    }

    if (!ticketData.description?.trim()) {
      return NextResponse.json(
        {
          success: false,
          message: 'La descripción es requerida',
        },
        { status: 400 }
      )
    }

    if (!ticketData.categoryId) {
      // Si viene de una patrulla sin categoría configurada, buscar una categoría por defecto
      if (ticketData.source === 'PATROL') {
        const defaultCategory = await prisma.categories.findFirst({
          where: { level: 1 },
          orderBy: { createdAt: 'asc' },
        })
        if (defaultCategory) {
          ticketData.categoryId = defaultCategory.id
        } else {
          return NextResponse.json(
            {
              success: false,
              message:
                'No hay categorías configuradas en el sistema. Crea al menos una categoría antes de reportar incidentes.',
            },
            { status: 400 }
          )
        }
      } else {
        return NextResponse.json(
          {
            success: false,
            message: 'La categoría es requerida',
          },
          { status: 400 }
        )
      }
    }

    // Verificar que la categoría existe
    const category = await prisma.categories.findUnique({
      where: { id: ticketData.categoryId },
    })

    if (!category) {
      return NextResponse.json(
        {
          success: false,
          message: 'Categoría no encontrada',
        },
        { status: 400 }
      )
    }

    // Determinar el clientId basado en el rol del usuario
    let clientId = session.user.id // Por defecto, el usuario actual es el cliente
    let createdOnBehalf = false

    // Solo ADMIN puede crear tickets en nombre de otro usuario
    if (session.user.role === 'ADMIN' && ticketData.clientId) {
      // Verificar que el cliente existe
      const client = await prisma.users.findUnique({
        where: { id: ticketData.clientId },
        select: { id: true, role: true, name: true },
      })

      if (!client) {
        return NextResponse.json(
          {
            success: false,
            message: 'Cliente no encontrado',
          },
          { status: 400 }
        )
      }

      clientId = ticketData.clientId
      createdOnBehalf = ticketData.clientId !== session.user.id
    }

    // ── Lógica de escalamiento para técnicos ──────────────────────────────
    // Un técnico puede crear tickets, pero NO puede auto-asignárselos.
    // Si crea un ticket en una categoría donde él está asignado, el sistema
    // busca otro técnico disponible o escala al nivel de categoría superior.
    let resolvedAssigneeId: string | undefined = ticketData.assigneeId

    if (session.user.role === 'TECHNICIAN') {
      const technicianId = session.user.id

      // Verificar si el técnico está asignado a esta categoría
      const selfAssignment = await prisma.technician_assignments.findFirst({
        where: {
          technicianId,
          categoryId: ticketData.categoryId,
          isActive: true,
        },
      })

      if (selfAssignment) {
        // El técnico está asignado a esta categoría — buscar otro técnico disponible
        // Primero intentar en la misma categoría (excluyendo al creador)
        const otherTechInCategory = await prisma.technician_assignments.findFirst({
          where: {
            categoryId: ticketData.categoryId,
            isActive: true,
            autoAssign: true,
            technicianId: { not: technicianId },
            users: { isActive: true, role: 'TECHNICIAN' },
          },
          include: {
            users: {
              select: {
                id: true,
                _count: {
                  select: {
                    tickets_tickets_assigneeIdTousers: {
                      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                    },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        })

        if (otherTechInCategory) {
          // Hay otro técnico en la misma categoría — asignar a él
          resolvedAssigneeId = otherTechInCategory.technicianId
        } else {
          // No hay otro técnico en esta categoría — escalar al nivel padre
          const currentCategory = await prisma.categories.findUnique({
            where: { id: ticketData.categoryId },
            select: { level: true, parentId: true },
          })

          if (currentCategory?.parentId) {
            // Buscar técnico en la categoría padre
            const techInParent = await prisma.technician_assignments.findFirst({
              where: {
                categoryId: currentCategory.parentId,
                isActive: true,
                autoAssign: true,
                technicianId: { not: technicianId },
                users: { isActive: true, role: 'TECHNICIAN' },
              },
            })
            resolvedAssigneeId = techInParent?.technicianId ?? undefined
          }
          // Si no hay nadie en el padre tampoco → queda sin asignar (admin lo tomará)
        }
      }

      // Bloquear explícitamente la auto-asignación aunque se envíe en el body
      if (resolvedAssigneeId === technicianId) {
        resolvedAssigneeId = undefined
      }
    }

    // Crear nuevo ticket usando TicketService (maneja familyId, ticketCode, codeIsManual)
    // Validar que el familyId está dentro del scope del admin (si es Admin Normal)
    if (
      ticketData.familyId &&
      session.user.role === 'ADMIN' &&
      !(session.user as any).isSuperAdmin
    ) {
      const { getUserFamilyScope } = await import('@/lib/auth/admin-scope')
      const scope = await getUserFamilyScope(session.user.id, 'ADMIN', false)
      if (scope.familyIds && !scope.familyIds.includes(ticketData.familyId)) {
        return NextResponse.json(
          { success: false, message: 'No tienes permiso para crear tickets en esta familia' },
          { status: 403 }
        )
      }
    }

    const newTicket = (await TicketService.createTicket({
      title: ticketData.title,
      description: ticketData.description,
      location: ticketData.location || undefined,
      priority: ticketData.priority || 'MEDIUM',
      clientId,
      categoryId: ticketData.categoryId,
      // Para técnicos: usar resolvedAssigneeId (resultado del escalamiento)
      // Para admin/cliente: usar el assigneeId del body si se especificó
      assigneeId:
        session.user.role === 'TECHNICIAN'
          ? resolvedAssigneeId
          : ticketData.assigneeId || undefined,
      ...(ticketData.ticketCode &&
        session.user.role === 'ADMIN' && { ticketCode: ticketData.ticketCode }),
      isAdmin: session.user.role === 'ADMIN',
      historyUserId: session.user.id,
      // Registrar quién creó el ticket (para auditoría en creación en nombre de otro)
      createdById: session.user.id,
      // Campos de patrulla (incidentes reportados desde rondas)
      ...(ticketData.source && { source: ticketData.source }),
      ...(ticketData.checkInId && { checkInId: ticketData.checkInId }),
      ...(ticketData.familyId && { familyId: ticketData.familyId }),
    })) as any

    // ⭐ AUDITORÍA: Registrar creación de ticket
    await AuditServiceComplete.log({
      action: AuditActionsComplete.TICKET_CREATED,
      entityType: 'ticket',
      entityId: newTicket.id,
      userId: session.user.id,
      details: {
        ticketTitle: newTicket.title,
        priority: newTicket.priority,
        categoryName: newTicket.categories.name,
        clientName: newTicket.users_tickets_clientIdTousers.name,
        assigneeName: newTicket.users_tickets_assigneeIdTousers?.name || 'Sin asignar',
        ...(createdOnBehalf && {
          createdOnBehalf: true,
          createdByRole: session.user.role,
          createdByName: session.user.name,
          onBehalfOfId: clientId,
          onBehalfOfName: newTicket.users_tickets_clientIdTousers.name,
        }),
      },
      request: request,
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
        email: newTicket.users_tickets_clientIdTousers.email,
      },
      category: {
        id: newTicket.categories.id,
        name: newTicket.categories.name,
      },
      assignee: newTicket.users_tickets_assigneeIdTousers
        ? {
            id: newTicket.users_tickets_assigneeIdTousers.id,
            name: newTicket.users_tickets_assigneeIdTousers.name,
            email: newTicket.users_tickets_assigneeIdTousers.email,
          }
        : null,
      createdAt: newTicket.createdAt,
    }).catch(err => {
      console.error('[WEBHOOK] Error disparando evento TICKET_CREATED:', err)
    })

    // ⭐ NUEVO: Enviar email de notificación al cliente
    await EmailService.queueEmail(
      {
        to: newTicket.users_tickets_clientIdTousers.email,
        subject: `Ticket #${(newTicket as any).ticketCode ?? newTicket.id.substring(0, 8)} creado`,
        template: 'ticket-created',
        templateData: {
          ticketId: newTicket.id,
          title: newTicket.title,
          clientName: newTicket.users_tickets_clientIdTousers.name,
          priority: newTicket.priority,
          category: newTicket.categories.name,
        },
      },
      session.user.id
    ).catch(err => {
      console.error('[EMAIL] Error enviando email de ticket creado:', err)
    })

    // ⭐ NUEVO: Enviar email al administrador para que asigne el ticket
    const { triggerTicketCreatedToAdminEmail } = await import('@/lib/email-triggers')
    void triggerTicketCreatedToAdminEmail(newTicket.id)

    // ⭐ NUEVO: Enviar notificaciones in-app a todos los admins
    await NotificationService.notifyTicketCreated(newTicket.id).catch(err => {
      console.error('[NOTIFICATION] Error enviando notificaciones de ticket creado:', err)
    })

    // ⭐ Si el ticket fue asignado al crearse, notificar al técnico asignado
    if (newTicket.assigneeId) {
      await NotificationService.notifyTicketAssigned(newTicket.id, newTicket.assigneeId).catch(
        err => {
          console.error('[NOTIFICATION] Error enviando notificación de asignación:', err)
        }
      )
    }

    // Mapear los datos para que coincidan con lo que espera el frontend
    const mappedTicket = {
      ...newTicket,
      client: newTicket.users_tickets_clientIdTousers,
      assignee: newTicket.users_tickets_assigneeIdTousers,
      category: newTicket.categories,
      family: (newTicket as any).family,
    }

    return NextResponse.json({
      success: true,
      data: mappedTicket,
      message: 'Ticket creado exitosamente',
    })
  } catch (error) {
    console.error('Error creating ticket:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear el ticket',
        error: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
