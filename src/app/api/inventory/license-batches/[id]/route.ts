import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { getLicenseBatchById, renewLicenseBatch } from '@/lib/services/license-batches.service'
import {
  assertInventoryResourceRead,
  assertInventoryResourceManage,
  InventoryAccessError,
  inventoryAccessToResponse,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'

/**
 * GET /api/inventory/license-batches/[id]
 * Usado por el badge de la lista de licencias y la tarjeta "Parte del lote"
 * en la ficha de la licencia — no hay una pantalla propia de lotes.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id } = await params

    const result = await getLicenseBatchById(id)
    if (!result) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
    }

    // Reusa el chequeo de lectura de cualquiera de las licencias del lote —
    // todas comparten familia (mismo licenseType), así que basta la primera.
    if (result.licenses[0]) {
      try {
        await assertInventoryResourceRead(
          toInventoryAccessUser(session.user),
          'LICENSE',
          result.licenses[0].id
        )
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en GET /api/inventory/license-batches/[id]:', error)
    return NextResponse.json({ error: 'Error al obtener el lote' }, { status: 500 })
  }
}

const renewLicenseBatchSchema = z.object({
  renewalDate: z
    .union([z.string(), z.date(), z.null()])
    .optional()
    .transform(val => (val ? new Date(val) : val === null ? null : undefined)),
  renewalCost: z.number().min(0).nullable().optional(),
  renewalFrequency: z
    .enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM'])
    .nullable()
    .optional(),
  customFrequencyMonths: z.number().int().min(1).nullable().optional(),
})

/**
 * PUT /api/inventory/license-batches/[id]
 * "Renovar lote completo" — botón disponible desde la ficha de cualquier
 * licencia del lote. Propaga a todas las licencias con batchRenewalLinked=true.
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const { id } = await params

    const existing = await getLicenseBatchById(id)
    if (!existing) {
      return NextResponse.json({ error: 'Lote no encontrado' }, { status: 404 })
    }
    if (existing.licenses[0]) {
      try {
        await assertInventoryResourceManage(
          toInventoryAccessUser(session.user),
          'LICENSE',
          existing.licenses[0].id
        )
      } catch (err) {
        if (err instanceof InventoryAccessError) return inventoryAccessToResponse(err)
        throw err
      }
    }

    const body = await request.json()
    const input = renewLicenseBatchSchema.parse(body)

    const result = await renewLicenseBatch(id, input, session.user.id)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error en PUT /api/inventory/license-batches/[id]:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.errors }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Error al renovar el lote'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
