import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { UserRole } from '@prisma/client'
import { z } from 'zod'
import { randomUUID } from 'crypto'

// Schema de validación para crear artículo
const createArticleSchema = z.object({
  title: z
    .string()
    .min(10, 'El título debe tener al menos 10 caracteres')
    .max(200, 'El título no puede exceder 200 caracteres'),
  content: z.string().min(50, 'El contenido debe tener al menos 50 caracteres'),
  summary: z.string().optional(),
  categoryId: z.string().uuid('ID de categoría inválido'),
  tags: z.array(z.string().min(2).max(30)).max(10, 'Máximo 10 tags permitidos'),
  sourceTicketId: z.string().uuid().optional(),
})

// GET /api/knowledge — redirige a /api/knowledge-articles que tiene filtrado por familia
// Este endpoint se mantiene por compatibilidad pero delega al endpoint correcto
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const redirectUrl = new URL('/api/knowledge-articles', url.origin)
  url.searchParams.forEach((value, key) => redirectUrl.searchParams.set(key, value))
  return NextResponse.redirect(redirectUrl, { status: 307 })
}

// POST /api/knowledge - Crear nuevo artículo
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Verificar que el usuario sea TECHNICIAN o ADMIN
    if (session.user.role !== UserRole.TECHNICIAN && session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Solo técnicos y administradores pueden crear artículos' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validationResult = createArticleSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Verificar que la categoría existe y obtener su familia
    const category = await prisma.categories.findUnique({
      where: { id: data.categoryId },
      include: { departments: { select: { familyId: true } } },
    })

    if (!category) {
      return NextResponse.json({ error: 'Categoría no encontrada' }, { status: 404 })
    }

    // Derivar familyId: categoría → departamento → familia
    const familyId = category.departments?.familyId ?? null

    // Si hay sourceTicketId, verificar que el ticket existe, está resuelto/cerrado,
    // y que quien crea el artículo es el resolutor asignado o un admin
    if (data.sourceTicketId) {
      const ticket = await prisma.tickets.findUnique({
        where: { id: data.sourceTicketId },
        select: { status: true, assigneeId: true },
      })

      if (!ticket) {
        return NextResponse.json({ error: 'Ticket no encontrado' }, { status: 404 })
      }

      if (ticket.status !== 'RESOLVED' && ticket.status !== 'CLOSED') {
        return NextResponse.json(
          { error: 'Solo se pueden crear artículos desde tickets resueltos o cerrados' },
          { status: 400 }
        )
      }

      // Solo el resolutor asignado puede crear el artículo desde este ticket
      // Los admins pueden crear desde cualquier ticket resuelto/cerrado
      if (session.user.role !== UserRole.ADMIN && ticket.assigneeId !== session.user.id) {
        return NextResponse.json(
          { error: 'Solo el técnico que resolvió el ticket puede crear un artículo desde él' },
          { status: 403 }
        )
      }
    }

    // Crear artículo con familyId derivado de la categoría
    const article = await prisma.knowledge_articles.create({
      data: {
        title: data.title,
        content: data.content,
        summary: data.summary || data.content.substring(0, 200) + '...',
        categoryId: data.categoryId,
        familyId,
        tags: data.tags,
        sourceTicketId: data.sourceTicketId,
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
          },
        },
      },
    })

    // Registrar en auditoría
    await prisma.audit_logs.create({
      data: {
        id: randomUUID(),
        userId: session.user.id,
        action: 'CREATE',
        entityType: 'knowledge_article',
        entityId: article.id,
        details: {
          title: article.title,
          categoryId: article.categoryId,
        },
      },
    })

    return NextResponse.json(article, { status: 201 })
  } catch (error) {
    console.error('Error al crear artículo:', error)
    return NextResponse.json({ error: 'Error al crear artículo' }, { status: 500 })
  }
}
