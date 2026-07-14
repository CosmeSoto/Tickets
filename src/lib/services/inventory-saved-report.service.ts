import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import type { SavedReportKind } from '@prisma/client'
import type {
  CreateInventorySavedReportInput,
  UpdateInventorySavedReportInput,
} from '@/lib/validations/inventory-saved-report'

const savedReportSelect = {
  id: true,
  name: true,
  kind: true,
  targetId: true,
  familyId: true,
  filterValues: true,
  visibleColumns: true,
  pinned: true,
  pinnedOrder: true,
  pinnedSpan: true,
  createdAt: true,
  updatedAt: true,
  family: { select: { id: true, name: true, color: true } },
} as const

function serializeSavedReport(row: {
  id: string
  name: string
  kind: SavedReportKind
  targetId: string
  familyId: string | null
  filterValues: unknown
  visibleColumns: unknown
  pinned: boolean
  pinnedOrder: number | null
  pinnedSpan: number
  createdAt: Date
  updatedAt: Date
  family: { id: string; name: string; color: string | null } | null
}) {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    targetId: row.targetId,
    familyId: row.familyId,
    filterValues: (row.filterValues as Record<string, string>) ?? {},
    visibleColumns: (row.visibleColumns as string[]) ?? [],
    pinned: row.pinned,
    pinnedOrder: row.pinnedOrder,
    pinnedSpan: row.pinnedSpan,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    family: row.family,
  }
}

export class InventorySavedReportService {
  static async listByUser(userId: string, options?: { kind?: SavedReportKind; pinned?: boolean }) {
    const rows = await prisma.inventory_saved_reports.findMany({
      where: {
        userId,
        ...(options?.kind ? { kind: options.kind } : {}),
        ...(options?.pinned !== undefined ? { pinned: options.pinned } : {}),
      },
      orderBy:
        options?.pinned === true
          ? [{ pinnedOrder: 'asc' }, { updatedAt: 'desc' }]
          : { updatedAt: 'desc' },
      select: savedReportSelect,
    })
    return rows.map(serializeSavedReport)
  }

  static async getByIdForUser(id: string, userId: string) {
    const row = await prisma.inventory_saved_reports.findFirst({
      where: { id, userId },
      select: savedReportSelect,
    })
    if (!row) return null
    return serializeSavedReport(row)
  }

  static async create(userId: string, input: CreateInventorySavedReportInput) {
    let pinnedOrder: number | null = null
    if (input.pinned) {
      const maxOrder = await prisma.inventory_saved_reports.aggregate({
        where: { userId, pinned: true },
        _max: { pinnedOrder: true },
      })
      pinnedOrder = (maxOrder._max.pinnedOrder ?? -1) + 1
    }

    const row = await prisma.inventory_saved_reports.create({
      data: {
        id: randomUUID(),
        userId,
        name: input.name,
        kind: input.kind,
        targetId: input.targetId,
        familyId: input.familyId ?? null,
        filterValues: input.filterValues,
        visibleColumns: input.visibleColumns,
        pinned: input.pinned ?? false,
        pinnedOrder,
        pinnedSpan: input.pinnedSpan ?? 1,
      },
      select: savedReportSelect,
    })
    return serializeSavedReport(row)
  }

  static async update(id: string, userId: string, input: UpdateInventorySavedReportInput) {
    const existing = await prisma.inventory_saved_reports.findFirst({
      where: { id, userId },
      select: { id: true, pinned: true, pinnedOrder: true },
    })
    if (!existing) return null

    let pinnedOrder = existing.pinnedOrder
    if (input.pinned === true && !existing.pinned) {
      const maxOrder = await prisma.inventory_saved_reports.aggregate({
        where: { userId, pinned: true },
        _max: { pinnedOrder: true },
      })
      pinnedOrder = (maxOrder._max.pinnedOrder ?? -1) + 1
    } else if (input.pinned === false) {
      pinnedOrder = null
    }

    const row = await prisma.inventory_saved_reports.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.kind !== undefined ? { kind: input.kind } : {}),
        ...(input.targetId !== undefined ? { targetId: input.targetId } : {}),
        ...(input.familyId !== undefined ? { familyId: input.familyId ?? null } : {}),
        ...(input.filterValues !== undefined ? { filterValues: input.filterValues } : {}),
        ...(input.visibleColumns !== undefined ? { visibleColumns: input.visibleColumns } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned, pinnedOrder } : {}),
        ...(input.pinnedSpan !== undefined ? { pinnedSpan: input.pinnedSpan } : {}),
      },
      select: savedReportSelect,
    })
    return serializeSavedReport(row)
  }

  static async reorderPinned(userId: string, ids: string[]) {
    const pinned = await prisma.inventory_saved_reports.findMany({
      where: { userId, pinned: true },
      select: { id: true },
    })
    const pinnedIds = new Set(pinned.map(row => row.id))
    if (ids.length !== pinned.length || ids.some(id => !pinnedIds.has(id))) {
      return false
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.inventory_saved_reports.update({
          where: { id },
          data: { pinnedOrder: index },
        })
      )
    )
    return true
  }

  static async delete(id: string, userId: string) {
    const existing = await prisma.inventory_saved_reports.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!existing) return false
    await prisma.inventory_saved_reports.delete({ where: { id } })
    return true
  }
}
