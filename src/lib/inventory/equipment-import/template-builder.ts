import * as XLSX from 'xlsx'
import type { TypeAttributeDef } from './types'
import { VALID_CONDITIONS, getConditionGuideText } from './constants'
import { getAcquisitionModeLabel } from '@/lib/utils/inventory-utils'
import { EQUIPMENT_SHARED_FIELDS } from '@/lib/inventory/equipment-field-definitions'

const FIXED_HEADER_EXAMPLES: Record<string, string> = {
  serialNumber: 'SN-LAP-2026-001',
  condition: 'Nuevo',
  warehouse: 'Bodega Principal',
  physicalLocation: 'Piso 2 - Rack A',
  purchaseDate: '2026-01-15',
  purchasePrice: '1200.00',
  invoiceNumber: 'FAC-2026-001',
  accessories: 'Cargador,Mouse',
  notes: 'Equipo importado',
}

const FIXED_HEADERS = EQUIPMENT_SHARED_FIELDS.map(f => ({
  key: f.key,
  label: f.importLabel,
  example: FIXED_HEADER_EXAMPLES[f.key] ?? '',
}))

function attributeExample(attr: TypeAttributeDef): string {
  if (attr.attributeType === 'number') return '16'
  if (attr.attributeType === 'select' && Array.isArray(attr.options) && attr.options.length > 0) {
    return String(attr.options[0])
  }
  return `Ej. ${attr.attributeLabel}`
}

export function buildTemplateHeaders(attributes: TypeAttributeDef[]): string[] {
  const dynamic = attributes.map(a => (a.isRequired ? `${a.attributeLabel} *` : a.attributeLabel))
  return [...FIXED_HEADERS.map(h => h.label), ...dynamic]
}

export function buildTemplateExampleRows(attributes: TypeAttributeDef[]): string[][] {
  const row1 = [...FIXED_HEADERS.map(h => h.example), ...attributes.map(a => attributeExample(a))]
  const row2 = [
    'SN-MON-2026-002',
    'Usado',
    '',
    'Recepción',
    '15/02/2026',
    '450',
    '',
    'Cable HDMI',
    '',
    ...attributes.map(a => (a.attributeType === 'number' ? '8' : `Valor ${a.attributeLabel}`)),
  ]
  return [row1, row2]
}

export function buildTemplateWorkbook(
  meta: {
    familyName: string
    typeName: string
    brandName: string
    modelName: string
    acquisitionMode: string
    attributes: TypeAttributeDef[]
    warehouses?: Array<{ name: string; location?: string | null }>
  },
  options?: { dataRows?: string[][]; prefillNote?: string }
): Buffer {
  const wb = XLSX.utils.book_new()
  const headers = buildTemplateHeaders(meta.attributes)
  const bodyRows = options?.dataRows?.length
    ? options.dataRows
    : buildTemplateExampleRows(meta.attributes)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...bodyRows])
  ws['!cols'] = headers.map(() => ({ wch: 22 }))
  XLSX.utils.book_append_sheet(wb, ws, 'Equipos')

  const info = [
    ['IMPORTACIÓN DE EQUIPOS', ''],
    ['', ''],
    ['Catálogo fijado en el asistente (no va en el Excel)', ''],
    ['Familia', meta.familyName],
    ['Tipo', meta.typeName],
    ['Marca', meta.brandName],
    ['Modelo', meta.modelName],
    ['Modo de adquisición', getAcquisitionModeLabel(meta.acquisitionMode)],
    ...(options?.prefillNote
      ? [
          ['', ''],
          ['Origen del archivo', options.prefillNote],
        ]
      : []),
    ['', ''],
    ['Modos de importación en el asistente', ''],
    ['Solo agregar', 'Crea nuevos. Series existentes se omiten.'],
    [
      'Agregar y actualizar',
      'Crea nuevos y fusiona metadatos de series existentes (mismo tipo/modelo).',
    ],
    ['', ''],
    ['Reglas importantes', ''],
    ['N° de Serie', 'Obligatorio y único por equipo. No repita series en el archivo.'],
    ['Condición válida', `${getConditionGuideText()} (también: NUEVO, USADO, DAÑADO, LIKE_NEW)`],
    ['Fecha de compra', 'YYYY-MM-DD o DD/MM/YYYY'],
    ['Bodega', 'Nombre exacto de la bodega. Deje vacío para bodega por defecto.'],
    ['Accesorios', 'Separados por coma (ej. Cargador, Mouse). Columna opcional.'],
    ['Máximo por archivo', '100 equipos por importación'],
    ['Equipos asignados', 'No se actualizan por importación. Devuélvalos a bodega primero.'],
    ['', ''],
    ['Bodegas disponibles en esta familia', ''],
    ...(meta.warehouses?.length
      ? meta.warehouses.map(w => [w.name, w.location ?? '—'])
      : [['(ninguna activa)', 'Cree bodegas en Inventario → Bodegas']]),
    ['', ''],
    ['Atributos del tipo (columnas dinámicas)', ''],
    ...meta.attributes.map(a => [
      a.isRequired ? `${a.attributeLabel} *` : a.attributeLabel,
      `${a.attributeType}${Array.isArray(a.options) && a.options.length ? ` · Valores: ${(a.options as string[]).join(', ')}` : ''}`,
    ]),
  ]
  const wsInfo = XLSX.utils.aoa_to_sheet(info)
  wsInfo['!cols'] = [{ wch: 28 }, { wch: 40 }]
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instrucciones')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildTemplateCsv(
  meta: {
    familyName: string
    typeName: string
    brandName: string
    modelName: string
    acquisitionMode: string
    attributes: TypeAttributeDef[]
    warehouses?: Array<{ name: string; location?: string | null }>
  },
  options?: { dataRows?: string[][]; prefillNote?: string }
): string {
  const headers = buildTemplateHeaders(meta.attributes)
  const bodyRows = options?.dataRows?.length
    ? options.dataRows
    : buildTemplateExampleRows(meta.attributes)
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
  const warehouseHint = meta.warehouses?.length
    ? meta.warehouses.map(w => (w.location ? `${w.name} (${w.location})` : w.name)).join('; ')
    : 'sin bodegas activas'
  const lines = [
    `# Familia: ${meta.familyName} | Tipo: ${meta.typeName} | Marca: ${meta.brandName} | Modelo: ${meta.modelName}`,
    `# Modo adquisición: ${getAcquisitionModeLabel(meta.acquisitionMode)} | ${getConditionGuideText()} | Máx. 100 equipos`,
    ...(options?.prefillNote ? [`# ${options.prefillNote}`] : []),
    `# Bodegas: ${warehouseHint}`,
    headers.map(escape).join(','),
    ...bodyRows.map(row => row.map(escape).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}
