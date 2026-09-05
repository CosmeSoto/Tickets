/**
 * POST /api/inventory/suppliers/evaluations/import
 *
 * Importación masiva de calificaciones desde el Excel "CALIFICACIÓN
 * PROVEEDORES" (ver src/lib/inventory/supplier-evaluation-import.ts para el
 * parseo de encabezados, que corre en el cliente antes de llegar acá).
 *
 * Body: { rows: ParsedImportRow[], defaultFamilyId?: string }
 *   - defaultFamilyId se usa solo para proveedores NUEVOS (nombre no
 *     encontrado en el maestro); los proveedores existentes conservan su
 *     área actual.
 *
 * Nunca aborta el lote completo por una fila mala: reporta fila por fila
 * (mismo criterio que el alta de licencias por lote — ver
 * bulk-license.service.ts) para que el usuario pueda corregir y reintentar
 * solo lo que falló.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { validateImportRow, type ParsedImportRow } from '@/lib/inventory/supplier-evaluation-import'
import {
  computeTotal,
  classifyTotal,
  getSupplierQualificationThresholds,
} from '@/lib/inventory/supplier-qualification'
import { sanitizeSupplierPayload } from '@/lib/validations/inventory/supplier'
import { ZodError } from 'zod'

interface RowResult {
  rowNumber: number
  status: 'created' | 'error'
  supplierName: string
  supplierCreated?: boolean
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const role = session.user.role
    const isSuperAdmin = (session.user as any).isSuperAdmin === true
    if (role !== 'ADMIN' && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Solo el administrador puede importar calificaciones de proveedores' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const rows: ParsedImportRow[] = Array.isArray(body?.rows) ? body.rows : []
    const defaultFamilyId: string | null = body?.defaultFamilyId || null

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No hay filas para importar' }, { status: 422 })
    }
    if (rows.length > 500) {
      return NextResponse.json(
        { error: 'Máximo 500 filas por importación. Divide el archivo.' },
        { status: 422 }
      )
    }

    const user = toInventoryAccessUser(session.user)
    if (defaultFamilyId) {
      try {
        await assertInventoryManageByFamily(user, defaultFamilyId)
      } catch (err) {
        if (err instanceof InventoryAccessError) {
          return NextResponse.json({ error: err.message }, { status: err.statusCode })
        }
        throw err
      }
    }
    // Sin área elegida y sin ser Super Admin: no abortamos el lote completo — solo
    // fallarán, fila por fila, las que de verdad necesiten crear un proveedor nuevo
    // (ver más abajo). Las filas de proveedores ya existentes se importan igual.
    const requiresFamilyForNewSuppliers = !defaultFamilyId && !isSuperAdmin

    const thresholds = await getSupplierQualificationThresholds()
    const results: RowResult[] = []

    for (const row of rows) {
      const validationError = validateImportRow(row)
      if (validationError) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'error',
          supplierName: row.supplierName,
          error: validationError,
        })
        continue
      }

      try {
        // El RUC/NIT manda por ser único e inequívoco; el nombre es solo un
        // respaldo (dos proveedores distintos pueden compartir razón social o
        // nombre comercial similar) — se usa cuando no hay RUC en la fila, o
        // cuando el RUC de la fila no coincide con ningún proveedor existente.
        let supplier = row.taxId
          ? await prisma.suppliers.findUnique({ where: { taxId: row.taxId } })
          : null
        if (!supplier) {
          supplier = await prisma.suppliers.findFirst({
            where: { name: { equals: row.supplierName, mode: 'insensitive' } },
          })
        }

        let supplierCreated = false
        if (!supplier) {
          if (requiresFamilyForNewSuppliers) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              supplierName: row.supplierName,
              error:
                'Proveedor nuevo: selecciona un área por defecto para poder crearlo (o pide a un Super Admin que la importe).',
            })
            continue
          }
          let newSupplierData: ReturnType<typeof sanitizeSupplierPayload>
          try {
            newSupplierData = sanitizeSupplierPayload({
              name: row.supplierName,
              taxId: row.taxId || undefined,
              email: row.email || undefined,
              contactName: row.contact || undefined,
              familyId: defaultFamilyId || undefined,
            })
          } catch (err) {
            const message =
              err instanceof ZodError
                ? (err.errors[0]?.message ?? 'Datos inválidos')
                : 'Datos inválidos'
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              supplierName: row.supplierName,
              error: `Proveedor nuevo: ${message}`,
            })
            continue
          }
          supplier = await prisma.suppliers.create({ data: newSupplierData })
          supplierCreated = true

          await prisma.audit_logs.create({
            data: {
              id: randomUUID(),
              action: 'CREATE',
              entityType: 'SUPPLIER',
              entityId: supplier.id,
              userId: session.user.id,
              userEmail: session.user.email,
              details: {
                message: `Proveedor "${supplier.name}" creado por importación de calificaciones (${session.user.email})`,
              },
            },
          })
        }

        const scores = {
          quality: row.quality!,
          creditTime: row.creditTime!,
          deliveryTime: row.deliveryTime!,
          price: row.price!,
          references: row.references!,
          equipmentScore: row.equipmentScore!,
        }
        const total = computeTotal(scores)
        const classification = classifyTotal(total, thresholds)

        await prisma.supplier_evaluations.create({
          data: {
            supplierId: supplier.id,
            year: row.year!,
            detail: row.detail || null,
            ...scores,
            total,
            classification,
            evaluatedById: session.user.id,
          },
        })

        results.push({
          rowNumber: row.rowNumber,
          status: 'created',
          supplierName: supplier.name,
          supplierCreated,
        })
      } catch (rowErr) {
        console.error(
          '[POST /api/inventory/suppliers/evaluations/import] fila',
          row.rowNumber,
          rowErr
        )
        results.push({
          rowNumber: row.rowNumber,
          status: 'error',
          supplierName: row.supplierName,
          error: rowErr instanceof Error ? rowErr.message : 'Error desconocido',
        })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const suppliersCreated = results.filter(r => r.supplierCreated).length
    const failed = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      summary: { total: rows.length, created, suppliersCreated, failed },
      results,
    })
  } catch (error) {
    console.error('[POST /api/inventory/suppliers/evaluations/import]', error)
    return NextResponse.json({ error: 'Error al importar calificaciones' }, { status: 500 })
  }
}
