import prisma from '@/lib/prisma'
import { EncryptionService } from './encryption.service'
import type { SoftwareLicense, CreateLicenseData, UpdateLicenseData, AssignLicenseData, LicenseSummary, LicenseListResponse } from '@/types/inventory/license'

const licenseInclude = {
  licenseType: true,
  equipment: true,
  user: true,
  department: true,
}

/**
 * Servicio para gestión de licencias de software / contratos
 */
export class LicenseService {
  /**
   * Crea una nueva licencia
   */
  static async createLicense(data: CreateLicenseData, userId: string): Promise<SoftwareLicense> {
    const encryptedKey = data.key ? EncryptionService.encrypt(data.key) : null

    const license = await prisma.software_licenses.create({
      data: {
        name: data.name,
        typeId: data.typeId,
        key: encryptedKey,
        purchaseDate: data.purchaseDate || null,
        expirationDate: data.expirationDate || null,
        cost: data.cost,
        vendor: data.vendor,
        notes: data.notes,
        assignedToEquipment: data.assignedToEquipment || null,
        assignedToUser: data.assignedToUser || null,
        assignedToDepartment: data.assignedToDepartment || null,
      },
      include: licenseInclude,
    })

    return this.decryptLicenseKey(license) as SoftwareLicense
  }

  /**
   * Actualiza una licencia existente
   */
  static async updateLicense(id: string, data: UpdateLicenseData, userId: string): Promise<SoftwareLicense> {
    const updateData: any = { ...data }

    // Solo encriptar si se envía una nueva clave
    if (data.key !== undefined) {
      updateData.key = data.key ? EncryptionService.encrypt(data.key) : null
    }

    const license = await prisma.software_licenses.update({
      where: { id },
      data: updateData,
      include: licenseInclude,
    })

    return this.decryptLicenseKey(license) as SoftwareLicense
  }

  /**
   * Elimina una licencia
   */
  static async deleteLicense(id: string, userId: string): Promise<void> {
    await prisma.software_licenses.delete({ where: { id } })
  }

  /**
   * Asigna una licencia a equipo, usuario y/o departamento
   */
  static async assignLicense(id: string, data: AssignLicenseData, userId: string): Promise<SoftwareLicense> {
    const license = await prisma.software_licenses.update({
      where: { id },
      data: {
        assignedToEquipment: data.assignedToEquipment || null,
        assignedToUser: data.assignedToUser || null,
        assignedToDepartment: data.assignedToDepartment || null,
      },
      include: licenseInclude,
    })

    return this.decryptLicenseKey(license) as SoftwareLicense
  }

  /**
   * Desasigna una licencia de todo
   */
  static async unassignLicense(id: string, userId: string): Promise<SoftwareLicense> {
    const license = await prisma.software_licenses.update({
      where: { id },
      data: {
        assignedToEquipment: null,
        assignedToUser: null,
        assignedToDepartment: null,
      },
      include: licenseInclude,
    })

    return this.decryptLicenseKey(license) as SoftwareLicense
  }

  /**
   * Obtiene una licencia por ID
   */
  static async getLicenseById(id: string, role: string): Promise<SoftwareLicense | null> {
    const license = await prisma.software_licenses.findUnique({
      where: { id },
      include: licenseInclude,
    })

    if (!license) return null

    // Solo ADMIN y TECHNICIAN ven la clave desencriptada
    if (role === 'ADMIN' || role === 'TECHNICIAN') {
      return this.decryptLicenseKey(license) as SoftwareLicense
    }

    return { ...license, key: license.key ? '••••••••' : null } as SoftwareLicense
  }

  /**
   * Lista licencias con filtros y paginación
   */
  static async listLicenses(filters: any, role: string): Promise<LicenseListResponse> {
    const where: any = {}

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { vendor: { contains: filters.search, mode: 'insensitive' } },
        { notes: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    if (filters.typeId && filters.typeId.length > 0) {
      where.typeId = { in: filters.typeId }
    }

    if (filters.assigned === 'assigned') {
      where.OR = [
        { assignedToEquipment: { not: null } },
        { assignedToUser: { not: null } },
        { assignedToDepartment: { not: null } },
      ]
    } else if (filters.assigned === 'unassigned') {
      where.assignedToEquipment = null
      where.assignedToUser = null
      where.assignedToDepartment = null
    }

    const now = new Date()
    if (filters.expired === 'expired') {
      where.expirationDate = { lt: now }
    } else if (filters.expired === 'active') {
      where.OR = [
        { expirationDate: null },
        { expirationDate: { gte: now } },
      ]
    } else if (filters.expired === 'expiring') {
      const thirtyDays = new Date()
      thirtyDays.setDate(thirtyDays.getDate() + 30)
      where.expirationDate = { gte: now, lte: thirtyDays }
    }

    const [licenses, total] = await Promise.all([
      prisma.software_licenses.findMany({
        where,
        include: licenseInclude,
        orderBy: { createdAt: 'desc' },
        skip: ((filters.page || 1) - 1) * (filters.limit || 10),
        take: filters.limit || 10,
      }),
      prisma.software_licenses.count({ where }),
    ])

    const processedLicenses = licenses.map(l => {
      if (role === 'ADMIN' || role === 'TECHNICIAN') {
        return this.decryptLicenseKey(l)
      }
      return { ...l, key: l.key ? '••••••••' : null }
    })

    return {
      licenses: processedLicenses as SoftwareLicense[],
      total,
      page: filters.page || 1,
      limit: filters.limit || 10,
    }
  }

  /**
   * Obtiene resumen de licencias
   */
  static async getLicenseSummary(): Promise<LicenseSummary> {
    const now = new Date()
    const thirtyDays = new Date()
    thirtyDays.setDate(thirtyDays.getDate() + 30)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const [total, expired, expiringSoon, expiringThisMonth, unassigned, totalCostAgg, byType] = await Promise.all([
      prisma.software_licenses.count(),
      prisma.software_licenses.count({ where: { expirationDate: { lt: now } } }),
      prisma.software_licenses.count({ where: { expirationDate: { gte: now, lte: thirtyDays } } }),
      prisma.software_licenses.count({ where: { expirationDate: { gte: now, lte: endOfMonth } } }),
      prisma.software_licenses.count({
        where: {
          assignedToEquipment: null,
          assignedToUser: null,
          assignedToDepartment: null,
        },
      }),
      prisma.software_licenses.aggregate({ _sum: { cost: true } }),
      prisma.software_licenses.groupBy({
        by: ['typeId'],
        _count: true,
      }),
    ])

    // Resolver nombres de tipos
    const typeIds = byType.map(t => t.typeId)
    const types = typeIds.length > 0
      ? await prisma.license_types.findMany({ where: { id: { in: typeIds } }, select: { id: true, name: true } })
      : []
    const typeMap = Object.fromEntries(types.map(t => [t.id, t.name]))

    const byTypeResolved: Record<string, number> = {}
    for (const t of byType) {
      byTypeResolved[typeMap[t.typeId] || t.typeId] = t._count
    }

    return {
      total,
      active: total - expired,
      expired,
      expiringThisMonth,
      expiringSoon,
      unassigned,
      byType: byTypeResolved,
      totalCost: totalCostAgg._sum.cost || 0,
    }
  }

  /**
   * Verifica si una licencia está expirada
   */
  static isLicenseExpired(license: { expirationDate: Date | null }): boolean {
    if (!license.expirationDate) return false
    return new Date(license.expirationDate) < new Date()
  }

  /**
   * Obtiene licencias próximas a expirar
   */
  static async getExpiringLicenses(daysBeforeExpiration: number): Promise<SoftwareLicense[]> {
    const now = new Date()
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + daysBeforeExpiration)

    const licenses = await prisma.software_licenses.findMany({
      where: {
        expirationDate: {
          gte: now,
          lte: targetDate,
        },
      },
      include: licenseInclude,
    })

    return licenses as SoftwareLicense[]
  }

  /**
   * Desencripta la clave de una licencia si existe
   */
  private static decryptLicenseKey(license: any): any {
    if (!license.key) return license
    try {
      return { ...license, key: EncryptionService.decrypt(license.key) }
    } catch {
      return { ...license, key: '[Error al desencriptar]' }
    }
  }
}
