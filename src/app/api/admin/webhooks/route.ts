import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebhookService } from '@/lib/services/webhook-service'
import prisma from '@/lib/prisma'
import { z } from 'zod'

// Schema de validación
const webhookSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  url: z.string().url('URL inválida').max(500),
  events: z.array(z.string()).min(1, 'Debe seleccionar al menos un evento'),
  secret: z.string().optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
  retryCount: z.number().min(0).max(5).optional()
})

/**
 * GET /api/admin/webhooks
 * Obtener todos los webhooks
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const webhooks = await prisma.webhooks.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: webhooks
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error obteniendo webhooks:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al obtener webhooks',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/webhooks
 * Crear un nuevo webhook
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validar datos
    const validation = webhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Datos inválidos',
          errors: validation.error.errors
        },
        { status: 400 }
      )
    }

    const data = validation.data

    // Crear webhook
    const webhook = await WebhookService.create({
      name: data.name,
      url: data.url,
      events: data.events,
      secret: data.secret,
      headers: data.headers,
      timeoutMs: data.timeoutMs,
      retryCount: data.retryCount,
      createdBy: session.user.id
    })

    return NextResponse.json({
      success: true,
      data: webhook,
      message: 'Webhook creado exitosamente'
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error creando webhook:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear webhook',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
