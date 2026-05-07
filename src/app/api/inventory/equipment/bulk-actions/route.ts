/**
 * API Endpoint: Bulk Equipment Actions
 * POST /api/inventory/equipment/bulk-actions
 *
 * Permite ejecutar acciones masivas sobre múltiples equipos:
 * - FOR_SALE: Marcar equipos como en venta con precio
 * - MAINTENANCE: Enviar equipos a mantenimiento
 * - DECOMMISSION: Dar de baja equipos
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { EquipmentStatus } from '@prisma/client'

// Schema de validación para acciones masivas
const bulkActionSchema = z.object({
  equipmentIds: z
    .array(z.string().uuid('ID de equipo inválido'))
    .min(1, 'Debe seleccionar al menos un equipo')
    .max(100, 'Máximo 100 equipos por operación'),

  action: z.enum(['FOR_SALE', 'MAINTENANCE', 'DECOMMISSION'], {
    errorMap: () => ({ message: 'Acción inválida' }),
  }),

  // Datos específicos para FOR_SALE
  salePrice: z.number().positive('El precio debe ser positivo').optional(),

  // Datos específicos para MAINTENANCE
  maintenanceType: z.string().min(1).max(100).optional(),
  maintenanceNotes: z.string().max(2000).optional(),

  // Datos específicos para DECOMMISSION
  decommissionReason: z.string().min(1).max(500).optional(),
  decommissionNotes: z.string().max(2000).optional(),

  // Notas generales (opcional)
  notes: z.string().max(2000).optional(),
})

type BulkActionInput = z.infer<typeof bulkActionSchema>

/**
 * POST /api/inventory/equipment/bulk-actions
 * Ejecuta una acción masiva sobre múltiples equipos
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // 2. Parsear y validar body
    const body = await request.json()
    const validatedData = bulkActionSchema.parse(body)

    // 3. Validar datos específicos según la acción
    if (validatedData.action === 'FOR_SALE' && !validatedData.salePrice) {
      return NextResponse.json(
        { error: 'El precio de venta es requerido para la acción FOR_SALE' },
        { status: 400 }
      )
    }

    if (validatedData.action === 'MAINTENANCE' && !validatedData.maintenanceType) {
      return NextResponse.json(
        { error: 'El tipo de mantenimiento es requerido para la acción MAINTENANCE' },
        { status: 400 }
      )
    }

    if (validatedData.action === 'DECOMMISSION' && !validatedData.decommissionReason) {
      return NextResponse.json(
        { error: 'La razón de baja es requerida para la acción DECOMMISSION' },
        { status: 400 }
      )
    }

    // 4. Verificar que todos los equipos existen y están en estado válido
    const equipment = await prisma.equipment.findMany({
      where: {
        id: {
          in: validatedData.equipmentIds,
        },
      },
      select: {
        id: true,
        code: true,
        status: true,
      },
    })

    if (equipment.length !== validatedData.equipmentIds.length) {
      return NextResponse.json({ error: 'Algunos equipos no fueron encontrados' }, { status: 404 })
    }

    // 5. Validar estados según la acción
    const invalidEquipment = equipment.filter(eq => {
      switch (validatedData.action) {
        case 'FOR_SALE':
          // Solo equipos AVAILABLE pueden ponerse en venta
          return eq.status !== EquipmentStatus.AVAILABLE
        case 'MAINTENANCE':
          // Solo equipos AVAILABLE o ASSIGNED pueden ir a mantenimiento
          return eq.status !== EquipmentStatus.AVAILABLE && eq.status !== EquipmentStatus.ASSIGNED
        case 'DECOMMISSION':
          // Solo equipos AVAILABLE, MAINTENANCE o FOR_SALE pueden darse de baja
          return (
            eq.status !== EquipmentStatus.AVAILABLE &&
            eq.status !== EquipmentStatus.MAINTENANCE &&
            eq.status !== EquipmentStatus.FOR_SALE
          )
        default:
          return false
      }
    })

    if (invalidEquipment.length > 0) {
      const codes = invalidEquipment.map(eq => eq.code).join(', ')
      return NextResponse.json(
        {
          error: `Los siguientes equipos no están en un estado válido para esta acción: ${codes}`,
        },
        { status: 400 }
      )
    }

    // 6. Ejecutar la acción en transacción
    const result = await prisma.$transaction(async tx => {
      let updatedCount = 0

      switch (validatedData.action) {
        case 'FOR_SALE':
          // Actualizar equipos a FOR_SALE con precio
          const forSaleResult = await tx.equipment.updateMany({
            where: {
              id: {
                in: validatedData.equipmentIds,
              },
            },
            data: {
              status: EquipmentStatus.FOR_SALE,
              saleListingPrice: validatedData.salePrice,
              notes: validatedData.notes || null,
            },
          })
          updatedCount = forSaleResult.count
          break

        case 'MAINTENANCE':
          // Actualizar equipos a MAINTENANCE
          const maintenanceResult = await tx.equipment.updateMany({
            where: {
              id: {
                in: validatedData.equipmentIds,
              },
            },
            data: {
              status: EquipmentStatus.MAINTENANCE,
              notes: validatedData.maintenanceNotes || validatedData.notes || null,
            },
          })
          updatedCount = maintenanceResult.count

          // Crear registros de mantenimiento
          await tx.maintenance_records.createMany({
            data: validatedData.equipmentIds.map(equipmentId => ({
              equipmentId,
              type: validatedData.maintenanceType!,
              description: validatedData.maintenanceNotes || 'Mantenimiento masivo',
              status: 'PENDING',
              scheduledDate: new Date(),
              performedById: session.user.id,
            })),
          })
          break

        case 'DECOMMISSION':
          // Actualizar equipos a RETIRED
          const decommissionResult = await tx.equipment.updateMany({
            where: {
              id: {
                in: validatedData.equipmentIds,
              },
            },
            data: {
              status: EquipmentStatus.RETIRED,
              notes: validatedData.decommissionNotes || validatedData.notes || null,
            },
          })
          updatedCount = decommissionResult.count

          // Crear registros de auditoría para baja
          await tx.audit_logs.createMany({
            data: validatedData.equipmentIds.map(equipmentId => ({
              userId: session.user.id,
              action: 'DECOMMISSION',
              entityType: 'equipment',
              entityId: equipmentId,
              details: {
                reason: validatedData.decommissionReason,
                notes: validatedData.decommissionNotes,
              },
            })),
          })
          break
      }

      return { updatedCount }
    })

    // 7. Retornar resultado
    return NextResponse.json(
      {
        success: true,
        action: validatedData.action,
        updatedCount: result.updatedCount,
        message: `Se actualizaron ${result.updatedCount} equipos exitosamente`,
      },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Error en bulk-actions:', error)

    // Manejar errores de validación de Zod
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    // Error genérico
    return NextResponse.json(
      {
        error: 'Error ejecutando acción masiva',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
