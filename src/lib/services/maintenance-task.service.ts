/**
 * MaintenanceTaskService — checklist de pasos marcables dentro de un
 * mantenimiento (ej. "Limpieza", "Cambio de pasta térmica", "Prueba
 * final"). Puramente organizativo: no condiciona el flujo de estados del
 * mantenimiento (REQUESTED/SCHEDULED/ACCEPTED/COMPLETED/CANCELLED).
 *
 * Mismo estilo que equipment-invoice.service.ts — createAuditLog() en vez
 * del patrón inline tx.audit_logs.create() que usa el resto de
 * maintenance.service.ts, porque esta tabla hija no toca el equipo ni
 * necesita atomicidad salvo al calcular/reordenar `order`.
 */

import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'
import { createAuditLog } from '@/lib/audit'

export interface CreateMaintenanceTaskInput {
  maintenanceRecordId: string
  description: string
  createdBy: string
}

const taskInclude = {
  creator: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
} as const

export class MaintenanceTaskService {
  // ── Listar tareas de un mantenimiento ─────────────────────────────────────

  static async listByMaintenance(maintenanceRecordId: string) {
    return prisma.maintenance_tasks.findMany({
      where: { maintenanceRecordId },
      include: taskInclude,
      orderBy: { order: 'asc' },
    })
  }

  // ── Obtener una tarea ──────────────────────────────────────────────────────

  static async getById(id: string) {
    return prisma.maintenance_tasks.findUnique({
      where: { id },
      include: taskInclude,
    })
  }

  // ── Crear tarea ────────────────────────────────────────────────────────────

  static async create(input: CreateMaintenanceTaskInput) {
    const task = await prisma.$transaction(async tx => {
      const last = await tx.maintenance_tasks.findFirst({
        where: { maintenanceRecordId: input.maintenanceRecordId },
        orderBy: { order: 'desc' },
        select: { order: true },
      })
      return tx.maintenance_tasks.create({
        data: {
          id: randomUUID(),
          maintenanceRecordId: input.maintenanceRecordId,
          description: input.description.trim(),
          order: (last?.order ?? 0) + 1,
          createdBy: input.createdBy,
        },
        include: taskInclude,
      })
    })

    await createAuditLog({
      entityType: 'maintenance_task',
      entityId: task.id,
      action: 'MAINTENANCE_TASK_CREATED',
      userId: input.createdBy,
      changes: { maintenanceRecordId: input.maintenanceRecordId, description: task.description },
    })

    return task
  }

  // ── Editar texto ───────────────────────────────────────────────────────────

  static async updateDescription(id: string, description: string, updatedBy: string) {
    const task = await prisma.maintenance_tasks.update({
      where: { id },
      data: { description: description.trim() },
      include: taskInclude,
    })

    await createAuditLog({
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_UPDATED',
      userId: updatedBy,
      changes: { description: task.description },
    })

    return task
  }

  // ── Marcar / desmarcar completada ─────────────────────────────────────────

  static async toggle(id: string, isCompleted: boolean, userId: string) {
    const task = await prisma.maintenance_tasks.update({
      where: { id },
      data: {
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        completedById: isCompleted ? userId : null,
      },
      include: taskInclude,
    })

    await createAuditLog({
      entityType: 'maintenance_task',
      entityId: id,
      action: isCompleted ? 'MAINTENANCE_TASK_COMPLETED' : 'MAINTENANCE_TASK_REOPENED',
      userId,
      changes: { isCompleted },
    })

    return task
  }

  // ── Reordenar — intercambia con el vecino adyacente ───────────────────────

  static async move(id: string, direction: 'up' | 'down') {
    return prisma.$transaction(async tx => {
      const current = await tx.maintenance_tasks.findUnique({ where: { id } })
      if (!current) throw new Error('Tarea no encontrada')

      const neighbor = await tx.maintenance_tasks.findFirst({
        where: {
          maintenanceRecordId: current.maintenanceRecordId,
          order: direction === 'up' ? { lt: current.order } : { gt: current.order },
        },
        orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
      })
      if (!neighbor) return current // ya está en el extremo — no hay nada que mover

      // Swap vía un valor temporal — @@unique([maintenanceRecordId, order])
      // impide escribir el mismo `order` dos veces dentro de la transacción.
      await tx.maintenance_tasks.update({ where: { id: current.id }, data: { order: -1 } })
      await tx.maintenance_tasks.update({
        where: { id: neighbor.id },
        data: { order: current.order },
      })
      return tx.maintenance_tasks.update({
        where: { id: current.id },
        data: { order: neighbor.order },
        include: taskInclude,
      })
    })
  }

  // ── Eliminar ──────────────────────────────────────────────────────────────

  static async delete(id: string, deletedBy: string) {
    const task = await prisma.maintenance_tasks.findUnique({
      where: { id },
      select: { description: true, maintenanceRecordId: true },
    })
    if (!task) throw new Error('Tarea no encontrada')

    await prisma.maintenance_tasks.delete({ where: { id } })

    await createAuditLog({
      entityType: 'maintenance_task',
      entityId: id,
      action: 'MAINTENANCE_TASK_DELETED',
      userId: deletedBy,
      changes: { description: task.description, maintenanceRecordId: task.maintenanceRecordId },
    })
  }
}
