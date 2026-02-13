import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebhookService } from '@/lib/services/webhook-service'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().max(500).optional(),
  events: z.array(z.string()).min(1).optional(),
  headers: z.record(z.string()).optional(),
  timeoutMs: z.number().min(1000).max(60000).optional(),
  retryCount: z.number().min(0).max(5).optional(),
  isActive: z.boolean().optional()
})

/**
 * PUT /api/admin/webhooks/[id]
 * Actualizar webhook
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()

    const validation = updateSchema.safeParse(body)
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

    const webhook = await WebhookService.update(id, validation.data)

    return NextResponse.json({
      success: true,
      data: webhook,
      message: 'Webhook actualizado exitosamente'
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error actualizando webhook:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar webhook',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/webhooks/[id]
 * Eliminar webhook
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'No autorizado' },
        { status: 403 }
      )
    }

    const { id } = await params

    await WebhookService.delete(id)

    return NextResponse.json({
      success: true,
      message: 'Webhook eliminado exitosamente'
    })
  } catch (error) {
    console.error('[WEBHOOKS] Error eliminando webhook:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al eliminar webhook',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
