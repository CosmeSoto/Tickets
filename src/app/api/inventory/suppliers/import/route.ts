/**
 * POST /api/inventory/suppliers/import
 *
 * Importación masiva de proveedores desde un Excel/CSV con columnas básicas
 * (Nombre, RUC/NIT, Email, Teléfono, Contacto, Área — ver
 * src/lib/inventory/supplier-import.ts para el parseo de encabezados, que
 * corre en el cliente antes de llegar acá).
 *
 * Body: { rows: ParsedImportRow[], defaultFamilyId?: string }
 *   - defaultFamilyId se usa solo para filas cuya columna Área venga vacía
 *     o no coincida con ninguna familia existente.
 *
 * Mismos permisos que el alta manual de un proveedor (canManageInventory +
 * assertInventoryManageByFamily por área). Duplicados (mismo RUC/NIT o mismo
 * nombre) se omiten y se reportan, nunca se sobrescriben.
 *
 * Nunca aborta el lote completo por una fila mala: reporta fila por fila
 * (mismo criterio que el resto de importaciones masivas del sistema) para
 * que el usuario pueda corregir y reintentar solo lo que falló.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import prisma from '@/lib/prisma'
import { canManageInventory, inventoryForbidden } from '@/lib/inventory-access'
import {
  assertInventoryManageByFamily,
  InventoryAccessError,
  toInventoryAccessUser,
} from '@/lib/inventory/inventory-resource-access'
import { sanitizeSupplierPayload } from '@/lib/validations/inventory/supplier'
import { supplierAuditMessage } from '@/lib/inventory/supplier-audit'
import { validateImportRow, type ParsedImportRow } from '@/lib/inventory/supplier-import'
import { ZodError } from 'zod'

interface RowResult {
  rowNumber: number
  status: 'created' | 'skipped' | 'error'
  name: string
  supplierId?: string
  error?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    if (!(await canManageInventory(session.user.id, session.user.role))) {
      return inventoryForbidden()
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

    // Si se eligió un área por defecto explícita, se valida de una vez: si el
    // usuario no puede gestionar esa familia, sí abortamos todo el lote (fue
    // una elección explícita e inválida, no una fila individual sin resolver).
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

    const families = await prisma.families.findMany({
      select: { id: true, name: true, code: true },
    })
    const familyByKey = new Map<string, { id: string; name: string }>()
    for (const f of families) {
      familyByKey.set(f.name.trim().toLowerCase(), f)
      familyByKey.set(f.code.trim().toLowerCase(), f)
    }

    // Cache de permisos por familia ya resuelta en este lote (evita repetir el
    // chequeo por cada fila cuando varias comparten área).
    const familyAccessCache = new Map<string, string | null>() // familyId -> null (ok) | mensaje de error

    async function checkFamilyAccess(familyId: string): Promise<string | null> {
      if (familyAccessCache.has(familyId)) return familyAccessCache.get(familyId)!
      try {
        await assertInventoryManageByFamily(user, familyId)
        familyAccessCache.set(familyId, null)
        return null
      } catch (err) {
        const message =
          err instanceof InventoryAccessError ? err.message : 'Sin permiso sobre el área'
        familyAccessCache.set(familyId, message)
        return message
      }
    }

    const results: RowResult[] = []

    for (const row of rows) {
      const validationError = validateImportRow(row)
      if (validationError) {
        results.push({
          rowNumber: row.rowNumber,
          status: 'error',
          name: row.name,
          error: validationError,
        })
        continue
      }

      try {
        // Resolver área: columna Área de la fila > área por defecto > ninguna.
        let familyId: string | null = null
        if (row.familyName) {
          const match = familyByKey.get(row.familyName.trim().toLowerCase())
          if (!match) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: `Área no encontrada: "${row.familyName}"`,
            })
            continue
          }
          familyId = match.id
        } else if (defaultFamilyId) {
          familyId = defaultFamilyId
        }

        if (!familyId && !user.isSuperAdmin) {
          results.push({
            rowNumber: row.rowNumber,
            status: 'error',
            name: row.name,
            error:
              'Falta el área: agrégala en la columna Área o elige una por defecto (o pide a un Super Admin que la importe).',
          })
          continue
        }

        if (familyId) {
          const accessError = await checkFamilyAccess(familyId)
          if (accessError) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: accessError,
            })
            continue
          }
        }

        // Duplicados: se omiten y se reportan, nunca se sobrescriben.
        // El RUC/NIT manda por ser único e inequívoco; el nombre es solo un
        // respaldo (dos proveedores distintos pueden compartir razón social o
        // nombre comercial similar) — se usa cuando no hay RUC en la fila, o
        // cuando el RUC de la fila no coincide con ningún proveedor existente.
        let existing = row.taxId
          ? await prisma.suppliers.findUnique({ where: { taxId: row.taxId } })
          : null
        let matchedBy: 'taxId' | 'name' | null = existing ? 'taxId' : null
        if (!existing) {
          existing = await prisma.suppliers.findFirst({
            where: { name: { equals: row.name, mode: 'insensitive' } },
          })
          if (existing) matchedBy = 'name'
        }
        if (existing) {
          results.push({
            rowNumber: row.rowNumber,
            status: 'skipped',
            name: row.name,
            supplierId: existing.id,
            error:
              matchedBy === 'taxId'
                ? `Ya existe un proveedor con este RUC/NIT ("${existing.name}")`
                : `Ya existe un proveedor con este nombre ("${existing.name}")`,
          })
          continue
        }

        let data: ReturnType<typeof sanitizeSupplierPayload>
        try {
          data = sanitizeSupplierPayload({
            name: row.name,
            taxId: row.taxId || undefined,
            email: row.email || undefined,
            phone: row.phone || undefined,
            contactName: row.contactName || undefined,
            familyId: familyId || undefined,
          })
        } catch (err) {
          const message =
            err instanceof ZodError
              ? (err.errors[0]?.message ?? 'Datos inválidos')
              : 'Datos inválidos'
          results.push({
            rowNumber: row.rowNumber,
            status: 'error',
            name: row.name,
            error: message,
          })
          continue
        }

        const supplier = await prisma.suppliers.create({ data })

        await prisma.audit_logs.create({
          data: {
            id: randomUUID(),
            action: 'CREATE',
            entityType: 'SUPPLIER',
            entityId: supplier.id,
            userId: session.user.id,
            userEmail: session.user.email,
            details: {
              message:
                supplierAuditMessage('CREATE', supplier.name, session.user.email) +
                ' (importación masiva)',
            },
          },
        })

        results.push({
          rowNumber: row.rowNumber,
          status: 'created',
          name: supplier.name,
          supplierId: supplier.id,
        })
      } catch (rowErr) {
        console.error('[POST /api/inventory/suppliers/import] fila', row.rowNumber, rowErr)
        results.push({
          rowNumber: row.rowNumber,
          status: 'error',
          name: row.name,
          error: rowErr instanceof Error ? rowErr.message : 'Error desconocido',
        })
      }
    }

    const created = results.filter(r => r.status === 'created').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'error').length

    return NextResponse.json({
      summary: { total: rows.length, created, skipped, failed },
      results,
    })
  } catch (error) {
    console.error('[POST /api/inventory/suppliers/import]', error)
    return NextResponse.json({ error: 'Error al importar proveedores' }, { status: 500 })
  }
}
