/**
 * API: Reorder Equipment Type Attributes
 * PATCH /api/admin/inventory/equipment-types/[typeId]/attributes/reorder
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
} from '@/lib/inventory/admin-inventory-auth'
import { z } from 'zod'

const reorderSchema = z.object({
  attributeIds: z.array(z.string()),
})

/**
 * PATCH - Reordenar atributos
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ typeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const params = await context.params
    const { typeId } = params

    const type = await prisma.equipment_types.findUnique({
      where: { id: typeId },
      select: { familyId: true },
    })
    if (!type) {
      return NextResponse.json({ error: 'Tipo de equipo no encontrado' }, { status: 404 })
    }
    const denied = assertFamilyInManageScope(access.auth, type.familyId)
    if (denied) return denied

    const body = await request.json()

    // Validar
    const validation = reorderSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { attributeIds } = validation.data

    // Actualizar orden en batch
    const updates = attributeIds.map((id, index) =>
      prisma.equipment_type_attributes.update({
        where: { id },
        data: { order: index },
      })
    )

    await prisma.$transaction(updates)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error reordenando atributos:', error)
    return NextResponse.json({ error: 'Error al reordenar atributos' }, { status: 500 })
  }
}
