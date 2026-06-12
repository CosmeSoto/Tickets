/**
 * Types for Equipment Grouping and Quantity Management
 * Supports visual grouping and bulk creation of identical equipment units
 */

import type { EquipmentCondition, EquipmentStatus, OwnershipType } from '@prisma/client'

// ── Equipment Grouping Types ──────────────────────────────────────────────────

/**
 * Individual equipment item for public display
 */
export interface PublicEquipmentItem {
  id: string
  code: string
  serialNumber: string
  brand: string
  model: string
  type: {
    id: string
    name: string
    code: string
    family: {
      id: string
      name: string
      icon: string | null
      color: string | null
    } | null
  }
  condition: EquipmentCondition
  saleListingPrice: number | null
  photoUrl: string | null
  specifications: Record<string, any> | null
  customAttributes?: Record<
    string,
    {
      value: string
      label: string
      type: string
    }
  >
  contactWhatsapp?: string | null
  createdAt: Date
}

/**
 * Group of identical equipment items
 * Items are considered identical if they have the same:
 * - brand, model, typeId, condition, saleListingPrice
 */
export interface EquipmentGroup {
  /** Unique identifier for the group (hash of grouping criteria) */
  groupId: string

  /** Common data shared by all units in the group */
  brand: string
  model: string
  type: {
    id: string
    name: string
    code: string
    family: {
      id: string
      name: string
      icon: string | null
      color: string | null
    } | null
  }
  condition: EquipmentCondition
  saleListingPrice: number | null
  photoUrl: string | null
  specifications: Record<string, any> | null
  commonAttributes?: Record<
    string,
    {
      value: string
      label: string
      type: string
    }
  >

  /** Individual units in this group */
  units: PublicEquipmentItem[]

  /** Count of available units */
  availableUnits: number

  /** Metadata */
  createdAt: Date
  updatedAt: Date
}

// ── Bulk Equipment Creation Types ─────────────────────────────────────────────

/**
 * Input data for bulk equipment creation
 */
export interface BulkEquipmentInput {
  /** Number of identical units to create (1-100) */
  quantity: number

  /** Code generation mode */
  codeMode: 'auto' | 'manual'

  /** Manual codes (required if codeMode === 'manual', must match quantity) */
  manualCodes?: string[]

  /** Optional serial numbers (one per line, must match quantity or be empty) */
  serialNumbers?: string[]

  // Common equipment data
  modelId: string // NUEVO: Referencia al modelo
  /** DEPRECATED: se rellenan desde el modelo si faltan */
  brand?: string
  /** DEPRECATED: columna legacy `modelDeprecated` en BD (`model`) */
  model?: string
  typeId?: string
  departmentId?: string
  condition: EquipmentCondition
  ownershipType: OwnershipType
  purchasePrice?: number
  supplierId?: string
  purchaseDate?: Date
  specifications?: Record<string, any>
  accessories?: string[]
  notes?: string
  photoUrl?: string
  warehouseId?: string
}

/**
 * Result of bulk equipment creation.
 * Supports both the legacy format (created[]) and the new batch format (batch + equipment).
 */
export interface BulkCreateResult {
  /** Created equipment records (legacy format from /api/inventory/equipment/bulk) */
  created?: Array<{
    id: string
    code: string
    serialNumber: string
    brand: string
    model: string
    status: EquipmentStatus
    condition: EquipmentCondition
    createdAt: Date
  }>

  /** Batch record (new format from /api/inventory/batches) */
  batch?: {
    id: string
    batchCode: string
    description: string | null
    quantity: number
    totalPrice: number
    createdAt: Date
  }

  /** Equipment records (new format from /api/inventory/batches) */
  equipment?: Array<{
    id: string
    code: string
    serialNumber: string
    status: string
    createdAt: Date
  }>

  /** Summary of creation */
  summary: {
    /** Legacy field */
    total?: number
    /** New field */
    totalEquipment?: number
    batchCode?: string
    firstCode: string
    lastCode: string
    message: string
    totalPrice?: number
  }
}

// ── Grouped Inventory View Types ──────────────────────────────────────────────

/**
 * Summary of individual equipment for grouped view
 */
export interface EquipmentSummary {
  id: string
  code: string
  serialNumber: string
  status: EquipmentStatus
  condition: EquipmentCondition
  location: string | null
  physicalLocation: string | null
  assignedTo: {
    id: string
    name: string
    email: string
  } | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Row in grouped inventory table
 */
export interface GroupedInventoryRow {
  /** Unique identifier for the group */
  groupId: string

  /** Common data */
  brand: string
  model: string
  type: {
    id: string
    name: string
    code: string
  }
  family: {
    id: string
    name: string
    icon: string | null
    color: string | null
  } | null

  /** State counters */
  total: number
  available: number
  assigned: number
  maintenance: number
  forSale: number
  sold: number
  retired: number

  /** Individual units (for row expansion) */
  units: EquipmentSummary[]
}

// ── Stock Information Types ───────────────────────────────────────────────────

/**
 * Stock information for a specific equipment model
 */
export interface StockInfo {
  brand: string
  model: string
  typeId: string

  /** State counters */
  total: number
  available: number
  assigned: number
  maintenance: number
  forSale: number
  sold: number
  retired: number

  /** Metadata */
  isNewModel: boolean // true if total === 0
  lastUpdated: Date
}

/**
 * Stock indicator color based on availability
 */
export type StockIndicatorColor = 'green' | 'yellow' | 'red'

/**
 * Helper to determine stock indicator color
 */
export function getStockIndicatorColor(availableCount: number): StockIndicatorColor {
  if (availableCount > 5) return 'green'
  if (availableCount >= 1) return 'yellow'
  return 'red'
}

// ── Grouping Criteria ─────────────────────────────────────────────────────────

/**
 * Criteria used to group equipment
 */
export interface GroupingCriteria {
  brand: string
  model: string
  typeId: string
  condition: EquipmentCondition
  saleListingPrice: number | null
}

/**
 * Generate a unique group ID from grouping criteria
 */
export function generateGroupId(criteria: GroupingCriteria): string {
  const parts = [
    criteria.brand,
    criteria.model,
    criteria.typeId,
    criteria.condition,
    criteria.saleListingPrice?.toString() ?? 'null',
  ]
  return parts.join('::')
}

/**
 * Extract grouping criteria from equipment item
 */
export function extractGroupingCriteria(item: PublicEquipmentItem): GroupingCriteria {
  return {
    brand: item.brand,
    model: item.model,
    typeId: item.type.id,
    condition: item.condition,
    saleListingPrice: item.saleListingPrice,
  }
}
