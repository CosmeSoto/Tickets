import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { 
  translateTicketStatus, 
  translatePriority, 
  translateTaskStatus 
} from '@/lib/translations/es'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para crear artículo desde ticket
const createArticleFromTicketSchema = z.object({
  title: z.string().min(10, 'El título debe tener al menos 10 caracteres').max(200, 'El título no puede exceder 200 caracteres'),
  content: z.string().min(50, 'El contenido debe tener al menos 50 caracteres'),
  summary: z.string().optional(),
  tags: z.array(z.string().min(2).max(30)).max(10, 'Máximo 10 tags permitidos'),
})

// POST /api/tickets/[id]/create-article - Crear artículo desde ticket resuelto
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Verificar que el usuario sea TECHNICIAN o ADMIN
    if (session.user.role !== UserRole.TECHNICIAN && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Solo técnicos y administradores pueden crear artículos' },
        { status: 403 }
      )
    }

    const { id: ticketId } = await params

    // Obtener ticket con toda la información necesaria
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        categories: true,
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el ticket esté resuelto
    if (ticket.status !== 'RESOLVED') {
      return NextResponse.json(
        { error: 'Solo se pueden crear artículos desde tickets resueltos' },
        { status: 400 }
      )
    }

    // Verificar que el usuario sea el técnico asignado o un admin
    const isAssignedTechnician = ticket.assigneeId === session.user.id
    const isAdmin = session.user.role === UserRole.ADMIN

    if (!isAssignedTechnician && !isAdmin) {
      return NextResponse.json(
        { error: 'Solo el técnico asignado o un administrador pueden crear artículos desde este ticket' },
        { status: 403 }
      )
    }

    // Verificar que no exista ya un artículo para este ticket
    const existingArticle = await prisma.knowledge_articles.findFirst({
      where: { sourceTicketId: ticketId },
    })

    if (existingArticle) {
      return NextResponse.json(
        { 
          error: 'Ya existe un artículo creado desde este ticket',
          articleId: existingArticle.id,
        },
        { status: 409 }
      )
    }

    const body = await request.json()
    
    // Validar datos
    const validationResult = createArticleFromTicketSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Generar resumen automático si no se proporciona
    const summary = data.summary || data.content.substring(0, 200) + '...'

    // Crear artículo
    const article = await prisma.knowledge_articles.create({
      data: {
        title: data.title,
        content: data.content,
        summary,
        categoryId: ticket.categoryId,
        tags: data.tags,
        sourceTicketId: ticketId,
        authorId: session.user.id,
        isPublished: true,
        views: 0,
        helpfulVotes: 0,
        notHelpfulVotes: 0,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        sourceTicket: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
          },
        },
      },
    })

    // Registrar en auditoría con información detallada
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'knowledge_article',
        entityId: article.id,
        details: {
          articleTitle: article.title,
          articleId: article.id,
          sourceTicketId: ticketId,
          sourceTicketTitle: ticket.title,
          sourceTicketPriority: ticket.priority,
          sourceTicketCategory: ticket.categories?.name,
          departmentId: ticket.categories?.departmentId,
          categoryId: article.categoryId,
          tags: article.tags,
          isPublished: article.isPublished,
          authorId: session.user.id,
          authorName: session.user.name,
          authorRole: session.user.role,
          commentsIncluded: ticket.comments.length,
          createdAt: new Date().toISOString(),
        },
      },
    })

    // Crear notificación para el cliente del ticket
    if (ticket.clientId) {
      await prisma.notifications.create({
        data: {
          id: randomUUID(),
          title: 'Artículo de conocimiento creado',
          message: `Se ha creado un artículo de conocimiento basado en tu ticket: "${ticket.title}"`,
          type: 'INFO',
          userId: ticket.clientId,
          ticketId: ticketId,
          isRead: false,
        },
      })
    }

    return NextResponse.json({
      article,
      message: 'Artículo creado exitosamente desde el ticket',
    }, { status: 201 })
  } catch (error) {
    console.error('Error al crear artículo desde ticket:', error)
    return NextResponse.json(
      { error: 'Error al crear artículo desde ticket' },
      { status: 500 }
    )
  }
}

// GET /api/tickets/[id]/create-article - Obtener información del ticket para crear artículo
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    const { id: ticketId } = await params

    // Obtener ticket con información relevante
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        categories: {
          select: {
            id: true,
            name: true,
            color: true,
            departmentId: true,
            departments: {
              select: {
                id: true,
                name: true,
                color: true,
              },
            },
          },
        },
        users_tickets_clientIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users_tickets_assigneeIdTousers: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        comments: {
          where: {
            isInternal: false, // Solo comentarios públicos
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            users: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
        resolution_plans: {
          include: {
            tasks: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
        ticket_ratings: {
          select: {
            rating: true,
            feedback: true,
            responseTime: true,
            technicalSkill: true,
            communication: true,
            problemResolution: true,
          },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket no encontrado' },
        { status: 404 }
      )
    }

    // Verificar que el ticket esté resuelto
    if (ticket.status !== 'RESOLVED') {
      return NextResponse.json(
        { error: 'Solo se pueden crear artículos desde tickets resueltos' },
        { status: 400 }
      )
    }

    // Verificar si ya existe un artículo
    const existingArticle = await prisma.knowledge_articles.findFirst({
      where: { sourceTicketId: ticketId },
      select: {
        id: true,
        title: true,
      },
    })

    // Generar sugerencias para el artículo
    const suggestedTitle = `Solución: ${ticket.title}`
    
    // Generar contenido sugerido completo en Markdown
    let suggestedContent = `# ${ticket.title}\n\n`
    
    // 1. Información del Ticket
    suggestedContent += `## 📋 Información del Ticket\n\n`
    if (ticket.categories?.departments) {
      suggestedContent += `- **Departamento:** ${ticket.categories.departments.name}\n`
    }
    suggestedContent += `- **Categoría:** ${ticket.categories?.name || 'N/A'}\n`
    suggestedContent += `- **Prioridad:** ${translatePriority(ticket.priority)}\n`
    suggestedContent += `- **Estado:** ${translateTicketStatus(ticket.status)}\n`
    suggestedContent += `- **Técnico asignado:** ${ticket.users_tickets_assigneeIdTousers?.name || 'N/A'}\n\n`
    
    // 2. Descripción del Problema
    suggestedContent += `## 🔍 Problema Reportado\n\n`
    suggestedContent += `${ticket.description}\n\n`
    
    // 3. Plan de Resolución (si existe)
    if (ticket.resolution_plans && ticket.resolution_plans.length > 0) {
      const plan = ticket.resolution_plans[0]
      suggestedContent += `## 📝 Plan de Resolución\n\n`
      suggestedContent += `**Título:** ${plan.title}\n\n`
      
      if (plan.description) {
        suggestedContent += `**Descripción:**\n${plan.description}\n\n`
      }
      
      if (plan.tasks && plan.tasks.length > 0) {
        suggestedContent += `### Tareas Realizadas\n\n`
        plan.tasks.forEach((task: any, index: number) => {
          suggestedContent += `${index + 1}. **${task.title}**\n`
          if (task.description) {
            suggestedContent += `   - ${task.description}\n`
          }
          suggestedContent += `   - Estado: ${translateTaskStatus(task.status)}\n`
          
          // Incluir información de horario si está disponible
          if (task.startTime && task.endTime && task.estimatedHours) {
            const hours = Math.floor(task.estimatedHours)
            const minutes = Math.round((task.estimatedHours - hours) * 60)
            let duration = ''
            if (hours === 0) {
              duration = `${minutes} minutos`
            } else if (minutes === 0) {
              duration = `${hours} ${hours === 1 ? 'hora' : 'horas'}`
            } else {
              duration = `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} minutos`
            }
            suggestedContent += `   - Horario: ${task.startTime} a ${task.endTime} (${duration})\n`
          } else if (task.estimatedHours) {
            suggestedContent += `   - Tiempo estimado: ${task.estimatedHours} horas\n`
          }
          
          if (task.notes) {
            suggestedContent += `   - Notas: ${task.notes}\n`
          }
          suggestedContent += `\n`
        })
      }
      
      // Métricas del plan
      suggestedContent += `### Métricas\n\n`
      suggestedContent += `- **Tareas completadas:** ${plan.completedTasks} de ${plan.totalTasks}\n`
      if (plan.estimatedHours) {
        const hours = Math.floor(plan.estimatedHours)
        const minutes = Math.round((plan.estimatedHours - hours) * 60)
        let duration = ''
        if (hours === 0) {
          duration = `${minutes} minutos`
        } else if (minutes === 0) {
          duration = `${hours} ${hours === 1 ? 'hora' : 'horas'}`
        } else {
          duration = `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} minutos`
        }
        suggestedContent += `- **Tiempo estimado total:** ${duration}\n`
      }
      if (plan.actualHours) {
        suggestedContent += `- **Tiempo real:** ${plan.actualHours} horas\n`
      }
      suggestedContent += `\n`
    }
    
    // 4. Solución Aplicada (comentarios de técnicos)
    const technicianComments = ticket.comments.filter((comment: any) => comment.users.role === 'TECHNICIAN')
    if (technicianComments.length > 0) {
      suggestedContent += `## ✅ Solución Aplicada\n\n`
      technicianComments.forEach((comment: any) => {
        suggestedContent += `${comment.content}\n\n`
      })
    }
    
    // 5. Calificación del Cliente (si existe)
    if (ticket.ticket_ratings) {
      const rating = ticket.ticket_ratings
      suggestedContent += `## ⭐ Calificación del Cliente\n\n`
      suggestedContent += `- **Calificación general:** ${rating.rating}/5\n`
      suggestedContent += `- **Tiempo de respuesta:** ${rating.responseTime}/5\n`
      suggestedContent += `- **Habilidad técnica:** ${rating.technicalSkill}/5\n`
      suggestedContent += `- **Comunicación:** ${rating.communication}/5\n`
      suggestedContent += `- **Resolución del problema:** ${rating.problemResolution}/5\n`
      if (rating.feedback) {
        suggestedContent += `\n**Comentario del cliente:**\n> ${rating.feedback}\n`
      }
      suggestedContent += `\n`
    }
    
    // 6. Conclusión
    suggestedContent += `## 💡 Conclusión\n\n`
    suggestedContent += `Este artículo documenta la solución aplicada al ticket #${ticket.id.substring(0, 8)}. `
    suggestedContent += `La información aquí presentada puede ser útil para resolver casos similares en el futuro.\n\n`
    
    // Extraer tags sugeridos del título, descripción, categoría y departamento
    const suggestedTags = [
      ticket.categories?.departments?.name.toLowerCase() || '',
      ticket.categories?.name.toLowerCase() || '',
      translatePriority(ticket.priority).toLowerCase(),
      ...ticket.title.toLowerCase().split(' ').filter(word => word.length > 4).slice(0, 3),
    ].filter(Boolean).slice(0, 10) // Máximo 10 tags

    return NextResponse.json({
      ticket: {
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        category: ticket.categories,
        client: ticket.users_tickets_clientIdTousers,
        assignee: ticket.users_tickets_assigneeIdTousers,
        comments: ticket.comments,
        resolutionPlan: ticket.resolution_plans?.[0] || null,
        rating: ticket.ticket_ratings || null,
      },
      existingArticle,
      suggestions: {
        title: suggestedTitle,
        content: suggestedContent,
        tags: suggestedTags,
      },
    })
  } catch (error) {
    console.error('Error al obtener información del ticket:', error)
    return NextResponse.json(
      { error: 'Error al obtener información del ticket' },
      { status: 500 }
    )
  }
}
