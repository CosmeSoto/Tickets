import type { AssetSubtype } from '@/lib/inventory/family-config'

export interface UnifiedAsset {
  id: string
  name: string
  subtype: AssetSubtype
  familyId: string
  family: { name: string; icon: string | null; color: string | null }
  status: string
  code?: string
  /** Nombre legible del tipo de activo (ej. "Desktop", "Laptop", "Licencia Office") */
  typeName?: string
  acquisitionMode?: string
  condition?: string
  createdAt: string
  // Campos financieros opcionales (solo equipos)
  purchaseDate?: string
  purchasePrice?: number
  invoiceNumber?: string
  purchaseOrderNumber?: string
  // Atributos personalizados y accesorios (solo equipos, como strings planos)
  attributes?: string
  accessories?: string
}

export interface UnifiedAssetsResponse {
  items: UnifiedAsset[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ── Opciones de filtro ───────────────────────────────────────────────────────

export const SUBTYPE_FILTER_OPTIONS: { value: AssetSubtype | ''; label: string }[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'EQUIPMENT', label: 'Equipo' },
  { value: 'MRO', label: 'Material / Consumible' },
  { value: 'LICENSE', label: 'Licencia y Contrato' },
]

export const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'AVAILABLE', label: 'Disponible' },
  { value: 'ASSIGNED', label: 'Asignado' },
  { value: 'MAINTENANCE', label: 'En mantenimiento' },
  { value: 'DAMAGED', label: 'Dañado' },
  { value: 'RETIRED', label: 'Retirado' },
  { value: 'FOR_SALE', label: 'En venta' },
  { value: 'SOLD', label: 'Vendido' },
]

/** Condiciones del equipo — enum EquipmentCondition: NEW, USED, DAMAGED (definitivo) */
export const CONDITION_FILTER_OPTIONS = [
  { value: '', label: 'Todas las condiciones' },
  { value: 'NEW', label: 'Nuevo' },
  { value: 'USED', label: 'Usado' },
  { value: 'DAMAGED', label: 'Dañado' },
]

// ── Columnas configurables ────────────────────────────────────────────────────

export type ColumnKey =
  | 'area'
  | 'codigo'
  | 'estado'
  | 'condicion'
  | 'propiedad'
  | 'creado'
  | 'fechaCompra'
  | 'factura'
  | 'ordenCompra'
  | 'precio'
  | 'atributos'
  | 'accesorios'

export const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'area', label: 'Área' },
  { key: 'codigo', label: 'Código' },
  { key: 'estado', label: 'Estado' },
  { key: 'condicion', label: 'Condición' },
  { key: 'propiedad', label: 'Propiedad' },
  { key: 'creado', label: 'Fecha Creación' },
  { key: 'fechaCompra', label: 'Fecha de Compra' },
  { key: 'factura', label: 'N° Factura' },
  { key: 'ordenCompra', label: 'N° Orden de Compra' },
  { key: 'precio', label: 'Precio / Valor' },
  { key: 'atributos', label: 'Atributos' },
  { key: 'accesorios', label: 'Accesorios' },
]

export const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'area',
  'codigo',
  'estado',
  'condicion',
  'propiedad',
  'creado',
]

/** Mapeo ColumnKey → clave del objeto UnifiedAsset para el export */
export const COLUMN_KEY_TO_ASSET_KEY: Record<ColumnKey, string> = {
  area: 'family',
  codigo: 'code',
  estado: 'status',
  condicion: 'condition',
  propiedad: 'acquisitionMode',
  creado: 'createdAt',
  fechaCompra: 'purchaseDate',
  factura: 'invoiceNumber',
  ordenCompra: 'purchaseOrderNumber',
  precio: 'purchasePrice',
  atributos: 'attributes',
  accesorios: 'accessories',
}
