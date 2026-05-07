import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { canManageInventory } from '@/lib/inventory-access'
import { generateAssetCode } from '@/lib/inventory/asset-code-generator'
import { invalidateCache } from '@/lib/api-cache'
import { parseImportFile } from '@/lib/utils/parse-import-file'

type ImportMode = 'add' | 'update'

interface ParsedRow {
  code?: string
  serialNumber: string
  brand: string
  model: string
  typeName: string
  acquisitionMode: string
  status: string
  condition: string
  warehouseName?: string
  physicalLocation?: string
  supplierName?: string
  invoiceNumber?: string
  purchaseDate?: string
  purchasePrice?: number
  usefulLifeYears?: number
  residualValue?: number
  depreciationMethod?: string
  accessories: string[]
  specifications: Record<string, string>
  notes?: string
  _typeId?: string
  _familyId?: string
  _warehouseId?: string
  _supplierId?: string
}

interface ImportError {
  row: number
  serialNumber: string
  error: string
}
interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
  preview?: ParsedRow[]
}

const VALID_STATUS = ['AVAILABLE', 'ASSIGNED', 'MAINTENANCE', 'DAMAGED', 'RETIRED']
const VALID_CONDITION = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']
const VALID_ACQUISITION = ['FIXED_ASSET', 'RENTAL', 'LOAN']
const VALID_DEPRECIATION = ['LINEAR', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION']

function parseAccessories(raw: string): string[] {
  if (!raw?.trim()) return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function parseSpecifications(raw: string): Record<string, string> {
  if (!raw?.trim()) return {}
  const result: Record<string, string> = {}
  raw.split(';').forEach(pair => {
    const idx = pair.indexOf(':')
    if (idx > 0) {
      const key = pair.slice(0, idx).trim()
      const val = pair.slice(idx + 1).trim()
      if (key && val) result[key] = val
    }
  })
  return result
}

/** Busca el índice de una columna por múltiples alias. Devuelve -1 si no existe. */
function findCol(row: string[], ...aliases: string[]): number {
  for (const alias of aliases) {
    const i = row.findIndex(c => c.toLowerCase().trim() === alias.toLowerCase())
    if (i !== -1) return i
  }
  return -1
}

/** Lee el valor de una celda de forma segura — devuelve undefined si el índice es -1 */
function getCell(row: string[], colIdx: number): string | undefined {
  if (colIdx < 0 || colIdx >= row.length) return undefined
  const v = row[colIdx]?.trim()
  return v || undefined
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const isAdmin = session.user.role === 'ADMIN'
  const isSuperAdmin = (session.user as any).isSuperAdmin === true
  const userCanManage = isAdmin || (await canManageInventory(session.user.id, session.user.role))
  if (!userCanManage)
    return NextResponse.json({ error: 'Sin permisos para importar equipos' }, { status: 403 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const dryRun = formData.get('dryRun') === 'true'
    const mode = (formData.get('mode') as ImportMode) || 'add'
    const familyIdFilter = formData.get('familyId') as string | null

    if (!file) return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })

    // Límite de tamaño desde configuración del sistema
    let maxFileSizeMB = 10
    try {
      const { getSetting } = await import('@/lib/api-cache')
      const val = await getSetting('maxFileSize', 600, '10')
      maxFileSizeMB = parseInt(val ?? '10') || 10
    } catch {
      /* usar default */
    }

    if (file.size > maxFileSizeMB * 1024 * 1024) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${maxFileSizeMB} MB` },
        { status: 400 }
      )
    }

    // Parsear CSV o Excel
    let rows: string[][]
    try {
      rows = await parseImportFile(file)
    } catch (e) {
      return NextResponse.json(
        { error: 'No se pudo leer el archivo. Verifica que sea un CSV o Excel válido.' },
        { status: 400 }
      )
    }

    if (rows.length === 0)
      return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })

    // Detectar encabezado — busca palabras clave en la primera fila
    const firstRow = rows[0].map(c => c.toLowerCase().trim())
    const hasHeader = firstRow.some(c =>
      [
        'n° de serie',
        'n° serie',
        'serial',
        'serie',
        'serial number',
        'marca',
        'brand',
        'n° de serie *',
        'marca *',
      ].includes(c)
    )
    const dataRows = hasHeader ? rows.slice(1) : rows

    if (dataRows.length === 0)
      return NextResponse.json(
        { error: 'El archivo no tiene filas de datos (solo encabezado)' },
        { status: 400 }
      )
    if (dataRows.length > 500)
      return NextResponse.json({ error: 'Máximo 500 equipos por importación' }, { status: 400 })

    // Mapear índices de columnas — acepta nombres de la plantilla y variantes
    const headerRow = hasHeader
      ? firstRow
      : [
          'código',
          'n° de serie',
          'marca',
          'modelo',
          'tipo de equipo',
          'modo de adquisición',
          'estado',
          'condición',
          'bodega',
          'ubicación física',
          'proveedor',
          'n° factura',
          'fecha de compra',
          'precio de compra',
          'vida útil (años)',
          'valor residual',
          'método depreciación',
          'accesorios',
          'especificaciones',
          'notas',
        ]

    const idx = {
      code: findCol(headerRow, 'código', 'codigo', 'code'),
      serialNumber: findCol(
        headerRow,
        'n° de serie',
        'n° de serie *',
        'n° serie',
        'serial',
        'serie',
        'serial number'
      ),
      brand: findCol(headerRow, 'marca', 'marca *', 'brand'),
      model: findCol(headerRow, 'modelo', 'modelo *', 'model'),
      typeName: findCol(headerRow, 'tipo de equipo', 'tipo de equipo *', 'tipo', 'type'),
      acquisitionMode: findCol(
        headerRow,
        'modo de adquisición',
        'modo de adquisición *',
        'modo adquisicion',
        'adquisición',
        'acquisition'
      ),
      status: findCol(headerRow, 'estado', 'status'),
      condition: findCol(headerRow, 'condición', 'condicion', 'condition'),
      warehouseName: findCol(headerRow, 'bodega', 'warehouse'),
      physicalLocation: findCol(
        headerRow,
        'ubicación física',
        'ubicacion fisica',
        'physical location'
      ),
      supplierName: findCol(headerRow, 'proveedor', 'supplier'),
      invoiceNumber: findCol(headerRow, 'n° factura', 'n° de factura', 'factura', 'invoice'),
      purchaseDate: findCol(headerRow, 'fecha de compra', 'fecha compra', 'purchase date'),
      purchasePrice: findCol(headerRow, 'precio de compra', 'precio', 'price'),
      usefulLifeYears: findCol(
        headerRow,
        'vida útil (años)',
        'vida util (años)',
        'vida util',
        'useful life'
      ),
      residualValue: findCol(headerRow, 'valor residual', 'residual'),
      depreciationMethod: findCol(
        headerRow,
        'método depreciación',
        'metodo depreciacion',
        'método de depreciación',
        'depreciation'
      ),
      accessories: findCol(headerRow, 'accesorios', 'accessories'),
      specifications: findCol(headerRow, 'especificaciones', 'specifications', 'specs'),
      notes: findCol(headerRow, 'notas', 'notes'),
    }

    // Validar que las columnas obligatorias existan
    if (!hasHeader) {
      // Sin encabezado: asumir orden fijo de la plantilla — serialNumber en col 1
      idx.serialNumber = idx.serialNumber >= 0 ? idx.serialNumber : 1
      idx.brand = idx.brand >= 0 ? idx.brand : 2
      idx.model = idx.model >= 0 ? idx.model : 3
      idx.typeName = idx.typeName >= 0 ? idx.typeName : 4
      idx.acquisitionMode = idx.acquisitionMode >= 0 ? idx.acquisitionMode : 5
    }

    if (idx.serialNumber < 0)
      return NextResponse.json(
        { error: 'No se encontró la columna "N° de Serie" en el archivo' },
        { status: 400 }
      )
    if (idx.brand < 0)
      return NextResponse.json(
        { error: 'No se encontró la columna "Marca" en el archivo' },
        { status: 400 }
      )
    if (idx.model < 0)
      return NextResponse.json(
        { error: 'No se encontró la columna "Modelo" en el archivo' },
        { status: 400 }
      )
    if (idx.typeName < 0)
      return NextResponse.json(
        { error: 'No se encontró la columna "Tipo de equipo" en el archivo' },
        { status: 400 }
      )

    // Cargar catálogos de referencia
    const [equipmentTypes, warehouses, suppliers, existingSerials] = await Promise.all([
      prisma.equipment_types.findMany({ select: { id: true, name: true, familyId: true } }),
      (prisma.warehouses as any).findMany({
        select: { id: true, name: true },
        where: { isActive: true },
      }),
      prisma.suppliers.findMany({ select: { id: true, name: true }, where: { isActive: true } }),
      prisma.equipment.findMany({ select: { serialNumber: true, id: true, code: true } }),
    ])

    const serialMap = new Map(existingSerials.map(e => [e.serialNumber.toLowerCase(), e]))
    const typeMap = new Map(equipmentTypes.map(t => [t.name.toLowerCase(), t]))
    const warehouseMap = new Map(warehouses.map((w: any) => [w.name.toLowerCase(), w]))
    const supplierMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s]))

    // Familias permitidas según rol
    // SuperAdmin → todo
    // Admin normal → sus familias asignadas (o todo si no tiene asignaciones)
    // Gestor → sus familias en inventory_manager_families
    let allowedFamilyIds: Set<string> | null = null

    if (!isSuperAdmin) {
      if (isAdmin) {
        const assignments = await prisma.admin_family_assignments.findMany({
          where: { adminId: session.user.id, isActive: true },
          select: { familyId: true },
        })
        if (assignments.length > 0) {
          allowedFamilyIds = new Set(assignments.map(a => a.familyId))
        }
        // Sin asignaciones → acceso total (admin legacy)
      } else {
        // Gestor de inventario
        const managerFamilies = await prisma.inventory_manager_families.findMany({
          where: { manager_id: session.user.id },
          select: { family_id: true },
        })
        if (managerFamilies.length > 0) {
          allowedFamilyIds = new Set(managerFamilies.map(m => m.family_id))
        }
      }
    }

    // Parsear y validar filas
    const parsed: ParsedRow[] = []
    const errors: ImportError[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]
      const rowNum = i + (hasHeader ? 2 : 1)

      // Saltar filas completamente vacías
      if (row.every(c => !c?.trim())) continue

      const serialNumber = getCell(row, idx.serialNumber)
      if (!serialNumber) {
        errors.push({ row: rowNum, serialNumber: '(vacío)', error: 'N° de serie es obligatorio' })
        continue
      }

      const brand = getCell(row, idx.brand)
      if (!brand) {
        errors.push({ row: rowNum, serialNumber, error: 'Marca es obligatoria' })
        continue
      }

      const model = getCell(row, idx.model)
      if (!model) {
        errors.push({ row: rowNum, serialNumber, error: 'Modelo es obligatorio' })
        continue
      }

      const typeName = getCell(row, idx.typeName)
      if (!typeName) {
        errors.push({ row: rowNum, serialNumber, error: 'Tipo de equipo es obligatorio' })
        continue
      }

      const acquisitionRaw = getCell(row, idx.acquisitionMode)
      const acquisitionMode = acquisitionRaw?.toUpperCase() || 'FIXED_ASSET'
      if (!VALID_ACQUISITION.includes(acquisitionMode)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Modo de adquisición inválido: "${acquisitionRaw}". Valores válidos: ${VALID_ACQUISITION.join(', ')}`,
        })
        continue
      }

      // Resolver tipo de equipo
      const typeEntry = typeMap.get(typeName.toLowerCase())
      if (!typeEntry) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Tipo de equipo "${typeName}" no encontrado. Verifica el nombre exacto en el sistema.`,
        })
        continue
      }

      // Verificar permisos de familia
      if (allowedFamilyIds && typeEntry.familyId && !allowedFamilyIds.has(typeEntry.familyId)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `No tienes permiso para crear equipos del tipo "${typeName}" (familia restringida)`,
        })
        continue
      }
      if (familyIdFilter && typeEntry.familyId && typeEntry.familyId !== familyIdFilter) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `El tipo "${typeName}" no pertenece al área seleccionada`,
        })
        continue
      }

      // Validar status
      const statusRaw = getCell(row, idx.status)
      const status = statusRaw?.toUpperCase() || 'AVAILABLE'
      if (!VALID_STATUS.includes(status)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Estado inválido: "${statusRaw}". Valores válidos: ${VALID_STATUS.join(', ')}`,
        })
        continue
      }

      // Validar condición
      const conditionRaw = getCell(row, idx.condition)
      const condition = conditionRaw?.toUpperCase() || 'NEW'
      if (!VALID_CONDITION.includes(condition)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Condición inválida: "${conditionRaw}". Valores válidos: ${VALID_CONDITION.join(', ')}`,
        })
        continue
      }

      // Resolver bodega (opcional)
      let warehouseId: string | undefined
      const warehouseName = getCell(row, idx.warehouseName)
      if (warehouseName) {
        const wh = warehouseMap.get(warehouseName.toLowerCase())
        if (!wh) {
          errors.push({
            row: rowNum,
            serialNumber,
            error: `Bodega "${warehouseName}" no encontrada o inactiva`,
          })
          continue
        }
        warehouseId = (wh as any).id
      }

      // Resolver proveedor (opcional)
      let supplierId: string | undefined
      const supplierName = getCell(row, idx.supplierName)
      if (supplierName) {
        const sup = supplierMap.get(supplierName.toLowerCase())
        if (!sup) {
          errors.push({
            row: rowNum,
            serialNumber,
            error: `Proveedor "${supplierName}" no encontrado o inactivo`,
          })
          continue
        }
        supplierId = sup.id
      }

      // Verificar duplicado por N° de serie
      const existing = serialMap.get(serialNumber.toLowerCase())
      if (existing && mode === 'add') {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Ya existe un equipo con este N° de serie (código: ${existing.code})`,
        })
        continue
      }

      // Parsear campos numéricos
      const purchasePriceRaw = getCell(row, idx.purchasePrice)
      const purchasePrice = purchasePriceRaw
        ? parseFloat(purchasePriceRaw.replace(',', '.'))
        : undefined
      if (purchasePriceRaw && isNaN(purchasePrice!)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Precio de compra inválido: "${purchasePriceRaw}"`,
        })
        continue
      }

      const usefulLifeRaw = getCell(row, idx.usefulLifeYears)
      const usefulLifeYears = usefulLifeRaw
        ? parseFloat(usefulLifeRaw.replace(',', '.'))
        : undefined
      if (usefulLifeRaw && (isNaN(usefulLifeYears!) || usefulLifeYears! <= 0)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Vida útil inválida: "${usefulLifeRaw}" (debe ser un número positivo)`,
        })
        continue
      }

      const residualRaw = getCell(row, idx.residualValue)
      const residualValue = residualRaw ? parseFloat(residualRaw.replace(',', '.')) : undefined
      if (residualRaw && isNaN(residualValue!)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Valor residual inválido: "${residualRaw}"`,
        })
        continue
      }

      const depreciationRaw = getCell(row, idx.depreciationMethod)
      const depreciationMethod = depreciationRaw?.toUpperCase()
      if (depreciationMethod && !VALID_DEPRECIATION.includes(depreciationMethod)) {
        errors.push({
          row: rowNum,
          serialNumber,
          error: `Método de depreciación inválido: "${depreciationRaw}". Valores válidos: ${VALID_DEPRECIATION.join(', ')}`,
        })
        continue
      }

      // Validar fecha de compra
      const purchaseDateRaw = getCell(row, idx.purchaseDate)
      if (purchaseDateRaw) {
        const d = new Date(purchaseDateRaw)
        if (isNaN(d.getTime())) {
          errors.push({
            row: rowNum,
            serialNumber,
            error: `Fecha de compra inválida: "${purchaseDateRaw}". Use formato YYYY-MM-DD`,
          })
          continue
        }
      }

      parsed.push({
        code: getCell(row, idx.code),
        serialNumber,
        brand,
        model,
        typeName,
        acquisitionMode,
        status,
        condition,
        warehouseName,
        physicalLocation: getCell(row, idx.physicalLocation),
        supplierName,
        invoiceNumber: getCell(row, idx.invoiceNumber),
        purchaseDate: purchaseDateRaw,
        purchasePrice,
        usefulLifeYears,
        residualValue,
        depreciationMethod,
        accessories: parseAccessories(getCell(row, idx.accessories) ?? ''),
        specifications: parseSpecifications(getCell(row, idx.specifications) ?? ''),
        notes: getCell(row, idx.notes),
        _typeId: typeEntry.id,
        _familyId: typeEntry.familyId ?? undefined,
        _warehouseId: warehouseId,
        _supplierId: supplierId,
      })
    }

    const result: ImportResult = {
      total: dataRows.filter(r => r.some(c => c?.trim())).length,
      created: 0,
      updated: 0,
      skipped: errors.length,
      errors,
    }

    if (dryRun) {
      result.preview = parsed
      return NextResponse.json({ success: true, mode, ...result })
    }

    if (parsed.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay filas válidas para importar', ...result },
        { status: 400 }
      )
    }

    // Importar en transacción
    await prisma.$transaction(async tx => {
      for (const row of parsed) {
        const existing = serialMap.get(row.serialNumber.toLowerCase())

        if (existing && mode === 'update') {
          await (tx.equipment.update as any)({
            where: { id: existing.id },
            data: {
              brand: row.brand,
              model: row.model,
              typeId: row._typeId,
              status: row.status as any,
              condition: row.condition as any,
              ownershipType: row.acquisitionMode as any,
              acquisitionMode: row.acquisitionMode as any,
              physicalLocation: row.physicalLocation ?? null,
              warehouseId: row._warehouseId ?? null,
              supplierId: row._supplierId ?? null,
              invoiceNumber: row.invoiceNumber ?? null,
              purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : null,
              purchasePrice: row.purchasePrice ?? null,
              usefulLifeYears: row.usefulLifeYears ?? null,
              residualValue: row.residualValue ?? null,
              depreciationMethod: row.depreciationMethod ? (row.depreciationMethod as any) : null,
              accessories: row.accessories,
              specifications: Object.keys(row.specifications).length ? row.specifications : null,
              notes: row.notes ?? null,
            },
          })
          result.updated++
        } else if (!existing) {
          // Generar código — usar familyId del tipo, con fallback a string vacío
          const familyId = row._familyId ?? ''
          const resolvedCode =
            row.code || (await generateAssetCode(familyId, 'EQUIPMENT', row.acquisitionMode))

          await (tx.equipment.create as any)({
            data: {
              id: randomUUID(),
              code: resolvedCode,
              serialNumber: row.serialNumber,
              brand: row.brand,
              model: row.model,
              typeId: row._typeId,
              status: row.status as any,
              condition: row.condition as any,
              ownershipType: row.acquisitionMode as any,
              acquisitionMode: row.acquisitionMode as any,
              physicalLocation: row.physicalLocation ?? undefined,
              warehouseId: row._warehouseId ?? undefined,
              supplierId: row._supplierId ?? undefined,
              invoiceNumber: row.invoiceNumber ?? undefined,
              purchaseDate: row.purchaseDate ? new Date(row.purchaseDate) : undefined,
              purchasePrice: row.purchasePrice ?? undefined,
              usefulLifeYears: row.usefulLifeYears ?? undefined,
              residualValue: row.residualValue ?? undefined,
              depreciationMethod: row.depreciationMethod
                ? (row.depreciationMethod as any)
                : undefined,
              accessories: row.accessories,
              specifications: Object.keys(row.specifications).length
                ? row.specifications
                : undefined,
              notes: row.notes ?? undefined,
              qrCode: randomUUID(),
            },
          })
          result.created++
        }
      }

      await tx.audit_logs.create({
        data: {
          id: randomUUID(),
          action: 'BULK_IMPORT',
          entityType: 'equipment',
          entityId: 'bulk',
          userId: session.user.id,
          details: {
            mode,
            total: result.total,
            created: result.created,
            updated: result.updated,
            errors: result.errors.length,
          },
        },
      })
    })

    await invalidateCache(['inventory:equipment:*']).catch(() => {})
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[IMPORT EQUIPMENT] Error:', error)
    const msg = error instanceof Error ? error.message : 'Error desconocido'
    return NextResponse.json({ error: `Error al procesar el archivo: ${msg}` }, { status: 500 })
  }
}

interface ParsedRow {
  code?: string
  serialNumber: string
  brand: string
  model: string
  typeName: string
  acquisitionMode: string
  status: string
  condition: string
  warehouseName?: string
  physicalLocation?: string
  supplierName?: string
  invoiceNumber?: string
  purchaseDate?: string
  purchasePrice?: number
  usefulLifeYears?: number
  residualValue?: number
  depreciationMethod?: string
  accessories: string[]
  specifications: Record<string, string>
  notes?: string
  // Resolved
  _typeId?: string
  _familyId?: string
  _warehouseId?: string
  _supplierId?: string
  _error?: string
}

interface ImportError {
  row: number
  serialNumber: string
  error: string
}

interface ImportResult {
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
  preview?: ParsedRow[]
}
