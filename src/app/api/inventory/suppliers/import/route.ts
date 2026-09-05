/**
 * POST /api/inventory/suppliers/import
 *
 * Importación masiva de proveedores desde un Excel/CSV. Solo Nombre es
 * obligatorio; el resto son los mismos campos opcionales del alta manual
 * (RUC/NIT, contacto, dirección, condiciones comerciales y datos bancarios —
 * ver src/lib/inventory/supplier-import.ts para el parseo de encabezados,
 * que corre en el cliente antes de llegar acá). Área y Tipo de proveedor se
 * resuelven acá contra los catálogos existentes.
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
import {
  sanitizeSupplierPayload,
  SUPPLIER_BANK_ACCOUNT_TYPES,
  SUPPLIER_BANK_ACCOUNT_TYPE_LABELS,
  SUPPLIER_PAYMENT_TERMS_OPTIONS,
} from '@/lib/validations/inventory/supplier'
import { PAYMENT_METHOD_TYPE_VALUES } from '@/lib/validations/contracts'
import { PAYMENT_METHOD_TYPE_LABELS } from '@/types/contracts'
import { supplierAuditMessage } from '@/lib/inventory/supplier-audit'
import { validateImportRow, type ParsedImportRow } from '@/lib/inventory/supplier-import'
import { ZodError } from 'zod'

/** Resuelve un código de enum a partir del propio código o de su etiqueta en español (case-insensitive). */
function resolveEnumByCodeOrLabel(
  raw: string,
  values: readonly string[],
  labels: Record<string, string>
): { value: string | null; error?: string } {
  if (!raw) return { value: null }
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_')
  if (values.includes(upper)) return { value: upper }
  const byLabel = Object.entries(labels).find(
    ([, label]) => label.trim().toLowerCase() === raw.trim().toLowerCase()
  )
  if (byLabel) return { value: byLabel[0] }
  return { value: null, error: raw }
}

/** Acepta un número de días o una de las etiquetas predefinidas (p.ej. "30 días", "Contado / inmediato"). */
function resolvePaymentTermsDays(raw: string): { value: string | null; error?: string } {
  if (!raw) return { value: null }
  const trimmed = raw.trim()
  if (/^-?\d+$/.test(trimmed)) return { value: trimmed }
  const byLabel = SUPPLIER_PAYMENT_TERMS_OPTIONS.find(
    o => o.label.toLowerCase() === trimmed.toLowerCase()
  )
  if (byLabel) return { value: String(byLabel.value) }
  return { value: null, error: trimmed }
}

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

    // Tipos de proveedor: code es único y manda; el nombre puede repetirse
    // entre áreas distintas, así que se busca primero acotado al área de la
    // fila y, si no hay, entre los tipos globales (sin área).
    const supplierTypes = await prisma.supplier_types.findMany({
      select: { id: true, code: true, name: true, familyId: true },
    })
    const typeByCode = new Map<string, { id: string }>()
    const typeByFamilyAndName = new Map<string, { id: string }>()
    const typeByGlobalName = new Map<string, { id: string }>()
    for (const t of supplierTypes) {
      typeByCode.set(t.code.trim().toLowerCase(), t)
      const nameKey = t.name.trim().toLowerCase()
      if (t.familyId) {
        typeByFamilyAndName.set(`${t.familyId}|${nameKey}`, t)
      } else {
        typeByGlobalName.set(nameKey, t)
      }
    }
    function resolveTypeId(
      raw: string,
      familyId: string | null
    ): { id: string | null; error?: string } {
      if (!raw) return { id: null }
      const key = raw.trim().toLowerCase()
      let t = typeByCode.get(key)
      if (!t && familyId) t = typeByFamilyAndName.get(`${familyId}|${key}`)
      if (!t) t = typeByGlobalName.get(key)
      if (!t) return { id: null, error: raw }
      return { id: t.id }
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

        // Catálogos y enums opcionales: se resuelven acá porque solo hacen
        // falta para la fila que sí se va a crear (los duplicados ya se
        // filtraron arriba).
        let typeId: string | null = null
        if (row.typeName) {
          const resolved = resolveTypeId(row.typeName, familyId)
          if (resolved.error) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: `Tipo de proveedor no encontrado: "${resolved.error}"`,
            })
            continue
          }
          typeId = resolved.id
        }

        let preferredPaymentMethod: string | null = null
        if (row.preferredPaymentMethod) {
          const resolved = resolveEnumByCodeOrLabel(
            row.preferredPaymentMethod,
            PAYMENT_METHOD_TYPE_VALUES,
            PAYMENT_METHOD_TYPE_LABELS
          )
          if (resolved.error) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: `Método de pago no reconocido: "${resolved.error}"`,
            })
            continue
          }
          preferredPaymentMethod = resolved.value
        }

        let bankAccountType: string | null = null
        if (row.bankAccountType) {
          const resolved = resolveEnumByCodeOrLabel(
            row.bankAccountType,
            SUPPLIER_BANK_ACCOUNT_TYPES,
            SUPPLIER_BANK_ACCOUNT_TYPE_LABELS
          )
          if (resolved.error) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: `Tipo de cuenta bancaria no reconocido: "${resolved.error}"`,
            })
            continue
          }
          bankAccountType = resolved.value
        }

        let paymentTermsDays: string | null = null
        if (row.paymentTermsDays) {
          const resolved = resolvePaymentTermsDays(row.paymentTermsDays)
          if (resolved.error) {
            results.push({
              rowNumber: row.rowNumber,
              status: 'error',
              name: row.name,
              error: `Plazo de pago no reconocido: "${resolved.error}" (usa un número de días o una opción como "30 días")`,
            })
            continue
          }
          paymentTermsDays = resolved.value
        }

        let data: ReturnType<typeof sanitizeSupplierPayload>
        try {
          data = sanitizeSupplierPayload({
            name: row.name,
            legalName: row.legalName || undefined,
            typeId: typeId || undefined,
            taxId: row.taxId || undefined,
            email: row.email || undefined,
            phone: row.phone || undefined,
            contactName: row.contactName || undefined,
            familyId: familyId || undefined,
            website: row.website || undefined,
            address: row.address || undefined,
            city: row.city || undefined,
            country: row.country || undefined,
            paymentTermsDays: paymentTermsDays || undefined,
            creditLimit: row.creditLimit || undefined,
            creditCurrency: row.creditCurrency || undefined,
            preferredPaymentMethod: preferredPaymentMethod || undefined,
            bankName: row.bankName || undefined,
            bankAccountNumber: row.bankAccountNumber || undefined,
            bankAccountType: bankAccountType || undefined,
            bankSwift: row.bankSwift || undefined,
            notes: row.notes || undefined,
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
