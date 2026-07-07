import * as XLSX from 'xlsx'
import type { TypeAttributeDef } from './types'
import { VALID_CONDITIONS } from './constants'

const FIXED_HEADERS: Array<{ key: string; label: string; example: string }> = [
  { key: 'serialNumber', label: 'N° de Serie *', example: 'SN-LAP-2026-001' },
  { key: 'condition', label: 'Condición', example: 'NEW' },
  { key: 'warehouse', label: 'Bodega', example: 'Bodega Principal' },
  { key: 'physicalLocation', label: 'Ubicación física', example: 'Piso 2 - Rack A' },
  { key: 'purchaseDate', label: 'Fecha de compra', example: '2026-01-15' },
  { key: 'purchasePrice', label: 'Precio de compra', example: '1200.00' },
  { key: 'invoiceNumber', label: 'N° Factura', example: 'FAC-2026-001' },
  { key: 'accessories', label: 'Accesorios', example: 'Cargador,Mouse' },
  { key: 'notes', label: 'Notas', example: 'Equipo importado' },
]

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
    'USED',
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

export function buildTemplateWorkbook(meta: {
  familyName: string
  typeName: string
  brandName: string
  modelName: string
  acquisitionMode: string
  attributes: TypeAttributeDef[]
  warehouses?: Array<{ name: string; code?: string | null }>
}): Buffer {
  const wb = XLSX.utils.book_new()
  const headers = buildTemplateHeaders(meta.attributes)
  const examples = buildTemplateExampleRows(meta.attributes)
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples])
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
    ['Modo de adquisición', meta.acquisitionMode],
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
    ['Condición válida', `${VALID_CONDITIONS.join(', ')} (alias: NUEVO, USADO, LIKE_NEW)`],
    ['Fecha de compra', 'YYYY-MM-DD o DD/MM/YYYY'],
    ['Bodega', 'Nombre o código exacto. Deje vacío para bodega por defecto.'],
    ['Máximo por archivo', '100 equipos'],
    ['Equipos asignados', 'No se actualizan por importación. Devuélvalos a bodega primero.'],
    ['', ''],
    ['Bodegas disponibles en esta familia', ''],
    ...(meta.warehouses?.length
      ? meta.warehouses.map(w => [w.name, w.code ?? '—'])
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

export function buildTemplateCsv(meta: {
  familyName: string
  typeName: string
  brandName: string
  modelName: string
  acquisitionMode: string
  attributes: TypeAttributeDef[]
  warehouses?: Array<{ name: string; code?: string | null }>
}): string {
  const headers = buildTemplateHeaders(meta.attributes)
  const examples = buildTemplateExampleRows(meta.attributes)
  const escape = (v: string) =>
    v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
  const warehouseHint = meta.warehouses?.length
    ? meta.warehouses.map(w => (w.code ? `${w.name} (${w.code})` : w.name)).join('; ')
    : 'sin bodegas activas'
  const lines = [
    `# Familia: ${meta.familyName} | Tipo: ${meta.typeName} | Marca: ${meta.brandName} | Modelo: ${meta.modelName}`,
    `# Modo adquisición: ${meta.acquisitionMode} | Condición: ${VALID_CONDITIONS.join('/')}`,
    `# Bodegas: ${warehouseHint}`,
    headers.map(escape).join(','),
    ...examples.map(row => row.map(escape).join(',')),
  ]
  return `\uFEFF${lines.join('\n')}`
}
