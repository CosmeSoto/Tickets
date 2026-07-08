export const MAX_IMPORT_ROWS = 100

export const IMPORT_MODES = ['add', 'update'] as const

export const VALID_CONDITIONS = ['NEW', 'USED', 'DAMAGED'] as const
export type ValidCondition = (typeof VALID_CONDITIONS)[number]

/** Alias adicionales aceptados en el archivo (español o inglés) */
export const CONDITION_ACCEPTED_ALIASES = 'NUEVO, USADO, DAÑADO, LIKE_NEW, GOOD'

/** Etiquetas en español para guías de usuario */
export function getConditionGuideText(): string {
  const labels: Record<ValidCondition, string> = {
    NEW: 'Nuevo',
    USED: 'Usado',
    DAMAGED: 'Dañado',
  }
  return VALID_CONDITIONS.map(c => labels[c]).join(', ')
}

export const VALID_ACQUISITION_MODES = ['FIXED_ASSET', 'RENTAL', 'LOAN'] as const

/** Columnas fijas de la plantilla (clave técnica → alias en español/inglés) */
export const FIXED_COLUMNS = [
  {
    key: 'serialNumber',
    aliases: ['serialnumber', 'n° de serie', 'n° de serie *', 'n° serie', 'serie', 'serial'],
  },
  { key: 'condition', aliases: ['condición', 'condicion', 'condition'] },
  {
    key: 'warehouse',
    aliases: ['bodega', 'warehouse', 'código bodega', 'codigo bodega', 'warehousecode'],
  },
  {
    key: 'physicalLocation',
    aliases: ['ubicación física', 'ubicacion fisica', 'physical location', 'ubicación'],
  },
  {
    key: 'purchaseDate',
    aliases: ['fecha de compra', 'fecha compra', 'purchase date', 'purchasedate'],
  },
  {
    key: 'purchasePrice',
    aliases: ['precio de compra', 'precio', 'purchase price', 'purchaseprice'],
  },
  {
    key: 'invoiceNumber',
    aliases: ['n° factura', 'n° de factura', 'factura', 'invoice', 'invoicenumber'],
  },
  { key: 'accessories', aliases: ['accesorios', 'accessories'] },
  { key: 'notes', aliases: ['notas', 'notes'] },
] as const

export const CONDITION_ALIASES: Record<string, ValidCondition> = {
  NEW: 'NEW',
  NUEVO: 'NEW',
  USED: 'USED',
  USADO: 'USED',
  LIKE_NEW: 'USED',
  GOOD: 'USED',
  FAIR: 'USED',
  POOR: 'USED',
  DAMAGED: 'DAMAGED',
  DAÑADO: 'DAMAGED',
  DANADO: 'DAMAGED',
}
