import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AssetRequestService } from '@/lib/services/asset-request.service'
import { createAssetRequestSchema } from '@/lib/validations/inventory/asset-request'
import { AssetRequestStatus, AssetType } from '@prisma/client'
import { ZodError } from 'zod'
import { applyAssetRequestFamilyFilter, createUserContext } from '@/lib/middleware/family-filter'

/**
 * GET /api/inventory/asset-requests
 * Lista solicitudes de activos con filtros, paginación y scope por rol
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Parsear query params
    const searchParams = request.nextUrl.searchParams

    // Status puede ser un array
    const statusParam = searchParams.getAll('status')
    const status =
      statusParam.length > 0
        ? statusParam.length === 1
          ? (statusParam[0] as AssetRequestStatus)
          : (statusParam as AssetRequestStatus[])
        : undefined

    // AssetType puede ser un array
    const assetTypeParam = searchParams.getAll('assetType')
    const assetType =
      assetTypeParam.length > 0
        ? assetTypeParam.length === 1
          ? (assetTypeParam[0] as AssetType)
          : (assetTypeParam as AssetType[])
        : undefined

    const filters = {
      status,
      assetType,
      familyId: searchParams.get('familyId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      search: searchParams.get('search') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    }

    // Llamar al servicio con scope automático por rol
    const result = await AssetRequestService.listRequests(
      filters,
      session.user.id,
      session.user.role,
      (session.user as any).isSuperAdmin === true
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Error listing asset requests:', error)
    const message = error instanceof Error ? error.message : 'Error al listar solicitudes'
    return NextResponse.json(
      {
        error: message,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/inventory/asset-requests
 * Crea una nueva solicitud de activo
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // ADMIN / gestores pueden crear; el resto requiere canRequestAssets
    const canRequestAssets =
      session.user.role === 'ADMIN' ||
      session.user.canRequestAssets === true ||
      (session.user as { canManageAssetRequests?: boolean }).canManageAssetRequests === true
    if (!canRequestAssets) {
      return NextResponse.json(
        {
          error: 'CANNOT_REQUEST_ASSETS',
          message: 'No tienes permiso para crear solicitudes de activos',
        },
        { status: 403 }
      )
    }

    // Parsear y validar body
    const body = await request.json()
    const validatedData = createAssetRequestSchema.parse(body)

    // Obtener IP del cliente
    const ipAddress =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Crear solicitud
    const result = await AssetRequestService.createRequest(
      validatedData,
      session.user.id,
      session.user.role,
      (session.user as any).isSuperAdmin === true,
      ipAddress
    )

    return NextResponse.json(
      {
        id: result.id,
        code: result.code,
        status: result.status,
        createdAt: result.createdAt,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[API] Error creating asset request:', error)

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
      if (error.message === 'ASSET_REQUESTS_DISABLED') {
        return NextResponse.json(
          {
            error: 'ASSET_REQUESTS_DISABLED',
            message: 'El módulo de solicitudes de activos está deshabilitado para esta familia',
          },
          { status: 403 }
        )
      }

      if (error.message === 'FAMILY_ACCESS_DENIED') {
        return NextResponse.json(
          {
            error: 'FAMILY_ACCESS_DENIED',
            message: 'No tienes acceso a esta familia',
          },
          { status: 403 }
        )
      }

      // Stock insuficiente
      if (error.message.includes('Solo hay')) {
        return NextResponse.json(
          {
            error: 'INSUFFICIENT_STOCK',
            message: error.message,
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json({ error: 'Error al crear la solicitud' }, { status: 500 })
  }
}
