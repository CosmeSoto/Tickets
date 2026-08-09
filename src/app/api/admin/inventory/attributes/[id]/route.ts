/**
 * API: Individual Attribute Management
 * PUT /api/admin/inventory/attributes/[id]
 * DELETE /api/admin/inventory/attributes/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  requireAdminInventoryAccess,
  assertFamilyInManageScope,
  type AdminInventorySession,
} from '@/lib/inventory/admin-inventory-auth'
import { z } from 'zod'

const attributeUpdateSchema = z.object({
  attributeLabel: z.string().min(2).max(200).optional(),
  attributeType: z.enum(['text', 'number', 'select', 'date', 'boolean']).optional(),
  options: z
    .object({
      options: z.array(z.string()),
    })
    .optional(),
  isRequired: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  helpText: z.string().optional(),
})

async function resolveAttributeFamilyScope(
  auth: AdminInventorySession,
  id: string
): Promise<NextResponse | null> {
  const equipmentAttr = await prisma.equipment_type_attributes.findUnique({
    where: { id },
    select: { equipmentType: { select: { familyId: true } } },
  })
  if (equipmentAttr) {
    return assertFamilyInManageScope(auth, equipmentAttr.equipmentType.familyId)
  }

  const licenseAttr = await prisma.license_type_attributes.findUnique({
    where: { id },
    select: { licenseType: { select: { familyId: true } } },
  })
  if (licenseAttr) {
    return assertFamilyInManageScope(auth, licenseAttr.licenseType.familyId)
  }

  const consumableAttr = await prisma.consumable_type_attributes.findUnique({
    where: { id },
    select: { consumableType: { select: { familyId: true } } },
  })
  if (consumableAttr) {
    return assertFamilyInManageScope(auth, consumableAttr.consumableType.familyId)
  }

  return NextResponse.json({ error: 'Atributo no encontrado' }, { status: 404 })
}

/**
 * PUT - Actualizar atributo
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const params = await context.params
    const { id } = params

    const denied = await resolveAttributeFamilyScope(access.auth, id)
    if (denied) return denied

    const body = await request.json()

    // Validar
    const validation = attributeUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Actualizar (intentar en las 3 tablas)
    let attribute = null

    try {
      attribute = await prisma.equipment_type_attributes.update({
        where: { id },
        data: validation.data,
      })
    } catch {
      try {
        attribute = await prisma.license_type_attributes.update({
          where: { id },
          data: validation.data,
        })
      } catch {
        attribute = await prisma.consumable_type_attributes.update({
          where: { id },
          data: validation.data,
        })
      }
    }

    return NextResponse.json({ attribute })
  } catch (error) {
    console.error('Error actualizando atributo:', error)
    return NextResponse.json({ error: 'Error al actualizar atributo' }, { status: 500 })
  }
}

/**
 * DELETE - Eliminar atributo
 */
export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    const access = await requireAdminInventoryAccess(session)
    if (!access.ok) return access.response

    const params = await context.params
    const { id } = params

    const denied = await resolveAttributeFamilyScope(access.auth, id)
    if (denied) return denied

    // Eliminar (intentar en las 3 tablas)
    try {
      await prisma.equipment_type_attributes.delete({ where: { id } })
    } catch {
      try {
        await prisma.license_type_attributes.delete({ where: { id } })
      } catch {
        await prisma.consumable_type_attributes.delete({ where: { id } })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error eliminando atributo:', error)
    return NextResponse.json({ error: 'Error al eliminar atributo' }, { status: 500 })
  }
}
