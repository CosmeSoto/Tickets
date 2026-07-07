export type ImportMode = 'add' | 'update'

export interface ImportCatalogContext {
  familyId: string
  typeId: string
  brandId: string
  modelId: string
  acquisitionMode: 'FIXED_ASSET' | 'RENTAL' | 'LOAN'
}

export interface TypeAttributeDef {
  attributeName: string
  attributeLabel: string
  attributeType: string
  isRequired: boolean
  options?: unknown
}

export interface ImportRowError {
  row: number
  field: string
  fieldLabel?: string
  message: string
  hint?: string
  serialNumber?: string
}

export interface ParsedImportRow {
  rowNumber: number
  serialNumber: string
  action: 'create' | 'update'
  existingEquipmentId?: string
  condition: string
  warehouseId?: string
  physicalLocation?: string
  purchaseDate?: Date
  purchasePrice?: number
  invoiceNumber?: string
  accessories: string[]
  notes?: string
  customValues: Array<{ fieldName: string; fieldValue: string }>
}

export interface ImportPreviewRow {
  rowNumber: number
  serialNumber: string
  action: 'create' | 'update' | 'skip'
  condition: string
  warehouseName?: string
  customValues: Record<string, string>
  reason?: string
  existingCode?: string
}

export interface ImportSkippedRow {
  rowNumber: number
  serialNumber: string
  reason: string
  existingCode?: string
}

export interface EquipmentImportResult {
  valid: boolean
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportRowError[]
  preview?: ImportPreviewRow[]
  skippedRows?: ImportSkippedRow[]
  codes?: string[]
}
