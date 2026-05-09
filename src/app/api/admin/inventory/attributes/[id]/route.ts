/**
 * API: Individual Attribute Management
 * PUT /api/admin/inventory/attributes/[id]
 * DELETE /api/admin/inventory/attributes/[id]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
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

/**
 * PUT - Actualizar atributo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = params
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
    return NextResponse.json(
      { error: 'Error al actualizar atributo' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Eliminar atributo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN' && !session.user.isSuperAdmin) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = params

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
    return NextResponse.json(
      { error: 'Error al eliminar atributo' },
      { status: 500 }
    )
  }
}
