/**
 * Definiciones compartidas de campos de equipo entre importación masiva y exportación.
 * Una sola fuente de verdad para etiquetas en español y alias de columnas.
 */

export interface EquipmentFieldDef {
  key: string
  /** Encabezado en plantilla de importación (puede incluir *) */
  importLabel: string
  /** Encabezado en exportación CSV/Excel */
  exportLabel: string
  /** Alias normalizables para detectar columnas al importar */
  importAliases: readonly string[]
}

/** Orden alineado con plantilla de importación (fijos antes de atributos dinámicos) */
export const EQUIPMENT_SHARED_FIELDS: EquipmentFieldDef[] = [
  {
    key: 'serialNumber',
    importLabel: 'N° de Serie *',
    exportLabel: 'N° de Serie',
    importAliases: ['serialnumber', 'n° de serie', 'n° de serie *', 'n° serie', 'serie', 'serial'],
  },
  {
    key: 'condition',
    importLabel: 'Condición',
    exportLabel: 'Condición',
    importAliases: ['condición', 'condicion', 'condition'],
  },
  {
    key: 'warehouse',
    importLabel: 'Bodega',
    exportLabel: 'Bodega',
    importAliases: ['bodega', 'warehouse', 'ubicación bodega', 'ubicacion bodega'],
  },
  {
    key: 'physicalLocation',
    importLabel: 'Ubicación física',
    exportLabel: 'Ubicación física',
    importAliases: ['ubicación física', 'ubicacion fisica', 'physical location', 'ubicación'],
  },
  {
    key: 'purchaseDate',
    importLabel: 'Fecha de compra',
    exportLabel: 'Fecha de compra',
    importAliases: ['fecha de compra', 'fecha compra', 'purchase date', 'purchasedate'],
  },
  {
    key: 'purchasePrice',
    importLabel: 'Precio de compra',
    exportLabel: 'Precio de compra',
    importAliases: [
      'precio de compra',
      'precio',
      'purchase price',
      'purchaseprice',
      'costo adquisición',
      'costo adquisicion',
      'costo de adquisición',
      'costo de adquisicion',
    ],
  },
  {
    key: 'invoiceNumber',
    importLabel: 'N° Factura',
    exportLabel: 'N° Factura',
    importAliases: ['n° factura', 'n° de factura', 'factura', 'invoice', 'invoicenumber'],
  },
  {
    key: 'accessories',
    importLabel: 'Accesorios',
    exportLabel: 'Accesorios',
    importAliases: ['accesorios', 'accessories'],
  },
  {
    key: 'notes',
    importLabel: 'Notas',
    exportLabel: 'Notas',
    importAliases: ['notas', 'notes'],
  },
]

/** Columna combinada de atributos (solo exportación legible; importación acepta como respaldo) */
export const EQUIPMENT_ATTRIBUTES_COMBINED_ALIASES = [
  'atributos',
  'attributes',
  'atributos del equipo',
] as const

export function getEquipmentFieldByKey(key: string): EquipmentFieldDef | undefined {
  return EQUIPMENT_SHARED_FIELDS.find(f => f.key === key)
}

export function getImportFixedColumnDefs(): Array<{
  key: string
  aliases: readonly string[]
}> {
  return EQUIPMENT_SHARED_FIELDS.map(({ key, importAliases }) => ({ key, aliases: importAliases }))
}
