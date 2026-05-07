import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'
import { updateStatusSchema } from '@/lib/validations/inventory/asset-request'
import { ZodError } from 'zod'

/**
 * GET /api/inventory/asset-requests/[id]
 * Obtiene el detalle completo de una solicitud
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar que el usuario tenga acceso al inventario
    if (!session.user.inventoryEnabled) {
      return NextResponse.json(
        { error: 'No tienes acceso al módulo de inventario' },
        { status: 403 }
      )
    }

    const requestId = params.id

    // Obtener detalle (el servicio verifica acceso automáticamente)
    const detail = await AssetRequestService.getRequestDetail(
      requestId,
      session.user.id,
      session.user.role,
      session.user.isSuperAdmin || false
    )

    if (!detail) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('[API] Error getting asset request detail:', error)
    return NextResponse.json(
      { error: 'Error al obtener el detalle de la solicitud' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/inventory/asset-requests/[id]
 * Cambia el estado de una solicitud (endpoint unificado para todas las transiciones)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar que el usuario tenga acceso al inventario
    if (!session.user.inventoryEnabled) {
      return NextResponse.json(
        { error: 'No tienes acceso al módulo de inventario' },
        { status: 403 }
      )
    }

    const requestId = params.id

    // Parsear y validar body
    const body = await request.json()
    const validatedData = updateStatusSchema.parse(body)

    // Obtener IP del cliente
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Actualizar estado
    const result = await AssetRequestService.updateStatus(
      requestId,
      validatedData.status,
      validatedData.comment,
      session.user.id,
      session.user.role,
      session.user.isSuperAdmin || false,
      ipAddress
    )

    return NextResponse.json({
      id: result.id,
      code: result.code,
      status: result.status,
      updatedAt: result.updatedAt,
    })
  } catch (error) {
    console.error('[API] Error updating asset request status:', error)

    // Errores de validación Zod
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    // Errores de negocio
    if (error instanceof Error) {
      // Transición inválida
      if (error.message.includes('No se puede cambiar de')) {
        return NextResponse.json(
          {
            error: 'INVALID_TRANSITION',
            message: error.message,
          },
          { status: 409 }
        )
      }

      // Estado terminal
      if (error.message.includes('estado terminal')) {
        return NextResponse.json(
          {
            error: 'TERMINAL_STATE',
            message: error.message,
          },
          { status: 409 }
        )
      }

      // Sin autorización para la transición
      if (error.message.includes('No tienes permiso')) {
        return NextResponse.json(
          {
            error: 'UNAUTHORIZED_TRANSITION',
            message: error.message,
          },
          { status: 403 }
        )
      }

      // Comentario requerido
      if (error.message === 'COMMENT_REQUIRED') {
        return NextResponse.json(
          {
            error: 'COMMENT_REQUIRED',
            message: 'Se requiere un comentario de al menos 10 caracteres para aprobar o rechazar',
          },
          { status: 422 }
        )
      }

      // Acceso denegado a la familia
      if (error.message === 'FAMILY_ACCESS_DENIED') {
        return NextResponse.json(
          {
            error: 'FAMILY_ACCESS_DENIED',
            message: 'No tienes acceso a esta familia',
          },
          { status: 403 }
        )
      }

      // Solicitud no encontrada
      if (error.message === 'REQUEST_NOT_FOUND') {
        return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
      }
    }

    return NextResponse.json(
      { error: 'Error al actualizar el estado de la solicitud' },
      { status: 500 }
    )
  }
}
