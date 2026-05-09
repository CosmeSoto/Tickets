/**
 * API: License Type Attributes
 * GET /api/admin/inventory/license-types/[typeId]/attributes
 * POST /api/admin/inventory/license-types/[typeId]/attributes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttributeHandler } from '@/lib/api/attribute-handler'

const handler = new AttributeHandler('license')

/**
 * GET - Obtener atributos de un tipo de licencia
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { typeId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return handler.getAll(params.typeId)
}

/**
 * POST - Crear atributo para un tipo de licencia
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { typeId: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const body = await request.json()
  return handler.create(params.typeId, body)
}
