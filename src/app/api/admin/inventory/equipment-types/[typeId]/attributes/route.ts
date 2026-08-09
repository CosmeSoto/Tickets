/**
 * API: Equipment Type Attributes
 * GET /api/admin/inventory/equipment-types/[typeId]/attributes
 * POST /api/admin/inventory/equipment-types/[typeId]/attributes
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import { AttributeHandler } from '@/lib/api/attribute-handler'

const handler = new AttributeHandler('equipment')

async function assertTypeInScope(auth: Parameters<typeof assertFamilyInManageScope>[0], typeId: string) {
  const type = await prisma.equipment_types.findUnique({
    where: { id: typeId },
    select: { familyId: true },
  })
  if (!type) {
    return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
  }
  return assertFamilyInManageScope(auth, type.familyId)
}

/**
 * GET - Obtener atributos de un tipo de equipo
 */
export async function GET(request: NextRequest, context: { params: Promise<{ typeId: string }> }) {
  const session = await getServerSession(authOptions)
  const access = await requireAdminInventoryAccess(session)
  if (!access.ok) return access.response

  const params = await context.params
  const denied = await assertTypeInScope(access.auth, params.typeId)
  if (denied) return denied

  return handler.getAll(params.typeId)
}

/**
 * POST - Crear atributo para un tipo de equipo
 */
export async function POST(request: NextRequest, context: { params: Promise<{ typeId: string }> }) {
  const session = await getServerSession(authOptions)
  const access = await requireAdminInventoryAccess(session)
  if (!access.ok) return access.response

  const params = await context.params
  const denied = await assertTypeInScope(access.auth, params.typeId)
  if (denied) return denied

  const body = await request.json()
  return handler.create(params.typeId, body)
}
