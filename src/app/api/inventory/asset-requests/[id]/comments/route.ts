import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'
import { addCommentSchema } from '@/lib/validations/inventory/asset-request'
import { ZodError } from 'zod'

/**
 * POST /api/inventory/asset-requests/[id]/comments
 * Agrega un comentario interno a una solicitud
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const validatedData = addCommentSchema.parse(body)

    // Agregar comentario
    const comment = await AssetRequestService.addComment(
      requestId,
      validatedData.comment,
      session.user.id,
      session.user.name || 'Usuario',
      session.user.role,
      session.user.isSuperAdmin || false
    )

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('[API] Error adding comment to asset request:', error)

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

      // No se puede comentar en estado terminal
      if (error.message === 'CANNOT_COMMENT_ON_TERMINAL_STATE') {
        return NextResponse.json(
          {
            error: 'CANNOT_COMMENT_ON_TERMINAL_STATE',
            message: 'No se pueden agregar comentarios a solicitudes en estado terminal',
          },
          { status: 403 }
        )
      }

      // No se puede comentar en este estado
      if (error.message === 'CANNOT_COMMENT_IN_THIS_STATE') {
        return NextResponse.json(
          {
            error: 'CANNOT_COMMENT_IN_THIS_STATE',
            message: 'No puedes agregar comentarios a solicitudes en este estado',
          },
          { status: 403 }
        )
      }

      // Solicitud no encontrada
      if (error.message === 'REQUEST_NOT_FOUND') {
        return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 })
      }
    }

    return NextResponse.json({ error: 'Error al agregar el comentario' }, { status: 500 })
  }
}
