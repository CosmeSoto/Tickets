/**
 * Generic Attribute Handler
 * Reutilizable para equipment, license y consumable attributes
 */

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

type TypeKind = 'equipment' | 'license' | 'consumable'

const attributeSchema = z.object({
  attributeName: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z_]+$/, 'Solo minúsculas y guiones bajos'),
  attributeLabel: z.string().min(2).max(200),
  attributeType: z.enum(['text', 'number', 'select', 'date', 'boolean']),
  options: z
    .object({
      options: z.array(z.string()),
    })
    .optional(),
  isRequired: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  order: z.number().int().min(0).optional(),
  helpText: z.string().optional(),
})

const attributeUpdateSchema = attributeSchema.partial().omit({ attributeName: true })

export class AttributeHandler {
  private typeKind: TypeKind
  private attributeTable: string
  private typeTable: string
  private typeIdField: string

  constructor(typeKind: TypeKind) {
    this.typeKind = typeKind
    this.attributeTable = `${typeKind}_type_attributes`
    this.typeTable = `${typeKind}_types`
    this.typeIdField = `${typeKind}TypeId`
  }

  async getAll(typeId: string) {
    try {
      const attributes = await (prisma as any)[this.attributeTable].findMany({
        where: { [this.typeIdField]: typeId },
        orderBy: { order: 'asc' },
      })

      return NextResponse.json({ attributes })
    } catch (error) {
      console.error(`❌ Error obteniendo atributos de ${this.typeKind}:`, error)
      return NextResponse.json({ error: 'Error al obtener atributos' }, { status: 500 })
    }
  }

  async create(typeId: string, body: unknown) {
    try {
      // Validar
      const validation = attributeSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Datos inválidos', details: validation.error.errors },
          { status: 400 }
        )
      }

      // Verificar que el tipo existe
      const type = await (prisma as any)[this.typeTable].findUnique({
        where: { id: typeId },
      })

      if (!type) {
        return NextResponse.json({ error: 'Tipo no encontrado' }, { status: 404 })
      }

      // Verificar que no existe un atributo con el mismo nombre
      const uniqueConstraint = {
        [`${this.typeIdField}_attributeName`]: {
          [this.typeIdField]: typeId,
          attributeName: validation.data.attributeName,
        },
      }

      const existing = await (prisma as any)[this.attributeTable].findUnique({
        where: uniqueConstraint,
      })

      if (existing) {
        return NextResponse.json({ error: 'Ya existe un atributo con ese nombre' }, { status: 409 })
      }

      let order = validation.data.order
      if (order == null) {
        const maxOrder = await (prisma as any)[this.attributeTable].aggregate({
          where: { [this.typeIdField]: typeId },
          _max: { order: true },
        })
        order = (maxOrder._max.order ?? -1) + 1
      }

      const attribute = await (prisma as any)[this.attributeTable].create({
        data: {
          [this.typeIdField]: typeId,
          ...validation.data,
          order,
        },
      })

      return NextResponse.json({ attribute }, { status: 201 })
    } catch (error) {
      console.error(`Error creando atributo de ${this.typeKind}:`, error)
      return NextResponse.json({ error: 'Error al crear atributo' }, { status: 500 })
    }
  }

  async update(id: string, body: unknown) {
    try {
      // Validar
      const validation = attributeUpdateSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Datos inválidos', details: validation.error.errors },
          { status: 400 }
        )
      }

      // Actualizar
      const attribute = await (prisma as any)[this.attributeTable].update({
        where: { id },
        data: validation.data,
      })

      return NextResponse.json({ attribute })
    } catch (error) {
      console.error(`Error actualizando atributo de ${this.typeKind}:`, error)
      return NextResponse.json({ error: 'Error al actualizar atributo' }, { status: 500 })
    }
  }

  async delete(id: string) {
    try {
      await (prisma as any)[this.attributeTable].delete({ where: { id } })
      return NextResponse.json({ success: true })
    } catch (error) {
      console.error(`Error eliminando atributo de ${this.typeKind}:`, error)
      return NextResponse.json({ error: 'Error al eliminar atributo' }, { status: 500 })
    }
  }

  async reorder(typeId: string, attributeIds: string[]) {
    try {
      // Actualizar orden en batch
      const updates = attributeIds.map((id, index) =>
        (prisma as any)[this.attributeTable].update({
          where: { id },
          data: { order: index },
        })
      )

      await prisma.$transaction(updates)

      return NextResponse.json({ success: true })
    } catch (error) {
      console.error(`Error reordenando atributos de ${this.typeKind}:`, error)
      return NextResponse.json({ error: 'Error al reordenar atributos' }, { status: 500 })
    }
  }
}
