import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TicketEvents } from '@/lib/ticket-events'

/**
 * GET /api/tickets/[id]/events
 * Server-Sent Events: empuja actualizaciones del timeline en tiempo real.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { id: ticketId } = await params
  console.log(`[SSE] Cliente conectado al ticket ${ticketId} (user: ${session.user.id})`)

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      // Enviar heartbeat inicial para confirmar conexión
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'))

      // Suscribirse a eventos de este ticket
      const unsubscribe = TicketEvents.subscribe(ticketId, (payload) => {
        try {
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Stream cerrado
        }
      })

      // Heartbeat cada 25s para mantener la conexión viva
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 25_000)

      // Cleanup cuando el cliente se desconecta
      request.signal.addEventListener('abort', () => {
        console.log(`[SSE] Cliente desconectado del ticket ${ticketId}`)
        clearInterval(heartbeat)
        unsubscribe()
        try { controller.close() } catch { /* ya cerrado */ }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
