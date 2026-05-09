/**
 * API: Equipment Type Attributes
 * GET /api/admin/inventory/equipment-types/[typeId]/attributes
 * POST /api/admin/inventory/equipment-types/[typeId]/attributes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AttributeHandler } from '@/lib/api/attribute-handler'

const handler = new AttributeHandler('equipment')

/**
 * GET - Obtener atributos de un tipo de equipo
 */
export async function GET(request: NextRequest, context: { params: Promise<{ typeId: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const params = await context.params
  return handler.getAll(params.typeId)
}

/**
 * POST - Crear atributo para un tipo de equipo
 */
export async function POST(request: NextRequest, context: { params: Promise<{ typeId: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const params = await context.params
  const body = await request.json()
  return handler.create(params.typeId, body)
}
