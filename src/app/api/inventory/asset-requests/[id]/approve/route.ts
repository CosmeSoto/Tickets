/**
 * API Endpoint: PATCH /api/inventory/asset-requests/[id]/approve
 *
 * Aprueba una solicitud de activos y asigna equipos específicos
 * Requiere autenticación y permisos de Super Admin o Family Admin
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'
import { approveWithEquipmentSchema } from '@/lib/validations/inventory/asset-request'
import { ZodError } from 'zod'

/**
 * PATCH /api/inventory/asset-requests/[id]/approve
 *
 * Aprueba una solicitud y asigna equipos específicos
 *
 * @body {
 *   comment: string - Comentario del revisor (min 10 caracteres)
 *   equipmentIds: string[] - IDs de equipos a asignar (debe coincidir con quantity)
 * }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: requestId } = await params
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

    // Parsear y validar body
    const body = await request.json()
    const validatedData = approveWithEquipmentSchema.parse(body)

    // Obtener IP del cliente
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Aprobar con equipos
    const result = await AssetRequestService.approveWithEquipment(
      requestId,
      validatedData.equipmentIds,
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
    console.error('[API] Error approving asset request with equipment:', error)

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
      // Selección incorrecta de equipos
      if (error.message.includes('Debes seleccionar exactamente')) {
        return NextResponse.json(
          {
            error: 'INVALID_EQUIPMENT_SELECTION',
            message: error.message,
          },
          { status: 400 }
        )
      }

      // Equipo no disponible
      if (error.message.includes('ya no está disponible')) {
        return NextResponse.json(
          {
            error: 'EQUIPMENT_NOT_AVAILABLE',
            message: error.message,
          },
          { status: 409 }
        )
      }

      // Equipo de tipo incorrecto
      if (error.message.includes('no es del tipo solicitado')) {
        return NextResponse.json(
          {
            error: 'WRONG_EQUIPMENT_TYPE',
            message: error.message,
          },
          { status: 400 }
        )
      }

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

      // Sin autorización
      if (error.message.includes('No tienes permiso')) {
        return NextResponse.json(
          {
            error: 'UNAUTHORIZED_TRANSITION',
            message: error.message,
          },
          { status: 403 }
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

    return NextResponse.json({ error: 'Error al aprobar la solicitud' }, { status: 500 })
  }
}
