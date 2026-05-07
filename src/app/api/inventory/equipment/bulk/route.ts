/**
 * API Endpoint: POST /api/inventory/equipment/bulk
 *
 * Crea múltiples equipos idénticos en una sola operación
 * Requiere autenticación y permisos de gestión de inventario
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createBulkEquipment } from '@/lib/services/bulk-equipment.service'
import { bulkEquipmentInputSchema } from '@/lib/validations/bulk-equipment'
import { canManageInventory } from '@/lib/inventory-access'
import { invalidateCache } from '@/lib/api-cache'

export const dynamic = 'force-dynamic'

/**
 * POST /api/inventory/equipment/bulk
 *
 * Crea múltiples equipos idénticos
 *
 * @body BulkEquipmentInput - Datos de entrada validados
 * @returns BulkCreateResult - Equipos creados y resumen
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticación
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // 2. Verificar permisos
    const hasPermission = await canManageInventory(session.user.id)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'No tienes permisos para gestionar inventario' },
        { status: 403 }
      )
    }

    // 3. Parsear y validar body
    const body = await request.json()

    // Validar con Zod
    const validationResult = bulkEquipmentInputSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos de entrada inválidos',
          details: validationResult.error.errors,
        },
        { status: 400 }
      )
    }

    // 4. Crear equipos por lote
    const result = await createBulkEquipment(validationResult.data)

    // 5. Invalidar caché de inventario
    await invalidateCache('inventory:equipment:*')

    // 6. Retornar resultado
    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error en creación por lote:', error)

    // Manejar errores específicos
    if (error.message?.includes('ya existen')) {
      return NextResponse.json(
        {
          error: 'Código duplicado',
          message: error.message,
        },
        { status: 409 }
      )
    }

    if (error.message?.includes('Tipo de equipo no encontrado')) {
      return NextResponse.json(
        {
          error: 'Tipo de equipo no encontrado',
          message: error.message,
        },
        { status: 404 }
      )
    }

    if (error.message?.includes('familia asignada')) {
      return NextResponse.json(
        {
          error: 'Configuración inválida',
          message: error.message,
        },
        { status: 400 }
      )
    }

    // Error genérico
    return NextResponse.json(
      {
        error: 'Error al crear equipos por lote',
        message: error.message || 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
