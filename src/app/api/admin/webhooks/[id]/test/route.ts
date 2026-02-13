import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { WebhookService } from '@/lib/services/webhook-service'

/**
 * POST /api/admin/webhooks/[id]/test
 * Probar un webhook enviando un evento de prueba
 */
export async function POST(
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

    const result = await WebhookService.test(id)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Webhook probado exitosamente. Verifica los logs para más detalles.'
      })
    } else {
      return NextResponse.json({
        success: false,
        message: result.error || 'Error al probar webhook'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('[WEBHOOKS] Error probando webhook:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Error al probar webhook',
        error: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    )
  }
}
