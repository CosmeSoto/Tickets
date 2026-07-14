import { randomUUID } from 'crypto'
import { prisma } from '@/lib/prisma'
import { computeNextRunAt } from '@/lib/inventory/reports/schedule-utils'
import { InventorySavedReportService } from '@/lib/services/inventory-saved-report.service'
import type {
  CreateInventoryScheduledReportInput,
  UpdateInventoryScheduledReportInput,
} from '@/lib/validations/inventory-scheduled-report'

const scheduleSelect = {
  id: true,
  userId: true,
  savedReportId: true,
  enabled: true,
  frequency: true,
  scheduleTime: true,
  dayOfWeek: true,
  dayOfMonth: true,
  recipients: true,
  exportFormat: true,
  lastRunAt: true,
  nextRunAt: true,
  lastStatus: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  savedReport: {
    select: {
      id: true,
      name: true,
      kind: true,
      targetId: true,
    },
  },
} as const

function serializeSchedule(row: {
  id: string
  userId: string
  savedReportId: string
  enabled: boolean
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  scheduleTime: string
  dayOfWeek: number | null
  dayOfMonth: number | null
  recipients: unknown
  exportFormat: 'CSV' | 'PDF' | 'BOTH'
  lastRunAt: Date | null
  nextRunAt: Date | null
  lastStatus: string | null
  lastError: string | null
  createdAt: Date
  updatedAt: Date
  savedReport: { id: string; name: string; kind: string; targetId: string }
}) {
  return {
    id: row.id,
    savedReportId: row.savedReportId,
    savedReportName: row.savedReport.name,
    savedReportKind: row.savedReport.kind,
    savedReportTargetId: row.savedReport.targetId,
    enabled: row.enabled,
    frequency: row.frequency,
    scheduleTime: row.scheduleTime,
    dayOfWeek: row.dayOfWeek,
    dayOfMonth: row.dayOfMonth,
    recipients: (row.recipients as string[]) ?? [],
    exportFormat: row.exportFormat,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    lastStatus: row.lastStatus,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export class InventoryScheduledReportService {
  static async listByUser(userId: string) {
    const rows = await prisma.inventory_scheduled_reports.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: scheduleSelect,
    })
    return rows.map(serializeSchedule)
  }

  static async getByIdForUser(id: string, userId: string) {
    const row = await prisma.inventory_scheduled_reports.findFirst({
      where: { id, userId },
      select: scheduleSelect,
    })
    if (!row) return null
    return serializeSchedule(row)
  }

  static async create(userId: string, input: CreateInventoryScheduledReportInput) {
    const saved = await InventorySavedReportService.getByIdForUser(input.savedReportId, userId)
    if (!saved) throw new Error('Reporte guardado no encontrado')

    const nextRunAt = computeNextRunAt({
      frequency: input.frequency,
      scheduleTime: input.scheduleTime,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
    })

    const row = await prisma.inventory_scheduled_reports.create({
      data: {
        id: randomUUID(),
        userId,
        savedReportId: input.savedReportId,
        enabled: input.enabled ?? true,
        frequency: input.frequency,
        scheduleTime: input.scheduleTime,
        dayOfWeek: input.dayOfWeek ?? null,
        dayOfMonth: input.dayOfMonth ?? null,
        recipients: input.recipients ?? [],
        exportFormat: input.exportFormat ?? 'BOTH',
        nextRunAt,
      },
      select: scheduleSelect,
    })
    return serializeSchedule(row)
  }

  static async update(id: string, userId: string, input: UpdateInventoryScheduledReportInput) {
    const existing = await prisma.inventory_scheduled_reports.findFirst({
      where: { id, userId },
    })
    if (!existing) return null

    const frequency = input.frequency ?? existing.frequency
    const scheduleTime = input.scheduleTime ?? existing.scheduleTime
    const dayOfWeek = input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek
    const dayOfMonth = input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth

    const timingChanged =
      input.frequency !== undefined ||
      input.scheduleTime !== undefined ||
      input.dayOfWeek !== undefined ||
      input.dayOfMonth !== undefined

    const nextRunAt = timingChanged
      ? computeNextRunAt({ frequency, scheduleTime, dayOfWeek, dayOfMonth })
      : existing.nextRunAt

    const row = await prisma.inventory_scheduled_reports.update({
      where: { id },
      data: {
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.frequency !== undefined ? { frequency: input.frequency } : {}),
        ...(input.scheduleTime !== undefined ? { scheduleTime: input.scheduleTime } : {}),
        ...(input.dayOfWeek !== undefined ? { dayOfWeek: input.dayOfWeek ?? null } : {}),
        ...(input.dayOfMonth !== undefined ? { dayOfMonth: input.dayOfMonth ?? null } : {}),
        ...(input.recipients !== undefined ? { recipients: input.recipients } : {}),
        ...(input.exportFormat !== undefined ? { exportFormat: input.exportFormat } : {}),
        ...(timingChanged ? { nextRunAt } : {}),
      },
      select: scheduleSelect,
    })
    return serializeSchedule(row)
  }

  static async delete(id: string, userId: string) {
    const existing = await prisma.inventory_scheduled_reports.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    if (!existing) return false
    await prisma.inventory_scheduled_reports.delete({ where: { id } })
    return true
  }

  static async listDue(now = new Date()) {
    return prisma.inventory_scheduled_reports.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now },
      },
      include: {
        savedReport: true,
        owner: { select: { id: true, email: true, role: true, isSuperAdmin: true, name: true } },
      },
    })
  }

  static async markRunResult(
    id: string,
    result: { success: boolean; error?: string; nextRunAt: Date }
  ) {
    await prisma.inventory_scheduled_reports.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        nextRunAt: result.nextRunAt,
        lastStatus: result.success ? 'sent' : 'failed',
        lastError: result.error ?? null,
      },
    })
  }
}
