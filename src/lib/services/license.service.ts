import { PrismaClient } from '@prisma/client'
import { EncryptionService } from './encryption.service'
import type { SoftwareLicense, CreateLicenseData, UpdateLicenseData, AssignLicenseData, LicenseSummary } from '@/types/inventory/license'

const prisma = new PrismaClient()

/**
 * Servicio para gestión de licencias de software
 */
export class LicenseService {
  /**
   * Crea una nueva licencia (encripta la clave)
   */
  static async createLicense(data: CreateLicenseData, userId: string): Promise<SoftwareLicense> {
    try {
      // Encriptar la clave antes de guardar
      const encryptedKey = EncryptionService.encrypt(data.key)

      const license = await prisma.software_licenses.create({
        data: {
          name: data.name,
          type: data.type,
          key: encryptedKey,
          purchaseDate: data.purchaseDate,
          expirationDate: data.expirationDate,
          cost: data.cost,
          vendor: data.vendor,
        },
        include: {
          equipment: true,
          user: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'CREATE',
          entityType: 'software_license',
          entityId: license.id,
          userId,
          details: {
            name: data.name,
            type: data.type,
          }
        }
      })

      return license as SoftwareLicense
    } catch (error) {
      console.error('Error creando licencia:', error)
      throw error
    }
  }

  /**
   * Actualiza una licencia
   */
  static async updateLicense(id: string, data: UpdateLicenseData, userId: string): Promise<SoftwareLicense> {
    try {
      const updateData: any = { ...data }

      // Si se actualiza la clave, encriptarla
      if (data.key) {
        updateData.key = EncryptionService.encrypt(data.key)
      }

      const license = await prisma.software_licenses.update({
        where: { id },
        data: updateData,
        include: {
          equipment: true,
          user: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'UPDATE',
          entityType: 'software_license',
          entityId: id,
          userId,
          details: {
            updatedFields: Object.keys(data),
          }
        }
      })

      return license as SoftwareLicense
    } catch (error) {
      console.error('Error actualizando licencia:', error)
      throw error
    }
  }

  /**
   * Elimina una licencia
   */
  static async deleteLicense(id: string, userId: string): Promise<void> {
    try {
      await prisma.software_licenses.delete({
        where: { id }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'DELETE',
          entityType: 'software_license',
          entityId: id,
          userId,
          details: {}
        }
      })
    } catch (error) {
      console.error('Error eliminando licencia:', error)
      throw error
    }
  }

  /**
   * Asigna una licencia a un equipo o usuario
   */
  static async assignLicense(id: string, data: AssignLicenseData, userId: string): Promise<SoftwareLicense> {
    try {
      // Validar que no esté asignada a ambos
      if (data.assignedToEquipment && data.assignedToUser) {
        throw new Error('La licencia solo puede asignarse a un equipo O a un usuario, no a ambos')
      }

      const license = await prisma.software_licenses.update({
        where: { id },
        data: {
          assignedToEquipment: data.assignedToEquipment || null,
          assignedToUser: data.assignedToUser || null,
        },
        include: {
          equipment: true,
          user: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'ASSIGN',
          entityType: 'software_license',
          entityId: id,
          userId,
          details: {
            assignedToEquipment: data.assignedToEquipment,
            assignedToUser: data.assignedToUser,
          }
        }
      })

      return license as SoftwareLicense
    } catch (error) {
      console.error('Error asignando licencia:', error)
      throw error
    }
  }

  /**
   * Desasigna una licencia
   */
  static async unassignLicense(id: string, userId: string): Promise<SoftwareLicense> {
    try {
      const license = await prisma.software_licenses.update({
        where: { id },
        data: {
          assignedToEquipment: null,
          assignedToUser: null,
        },
        include: {
          equipment: true,
          user: true,
        }
      })

      // Registrar en auditoría
      await prisma.audit_logs.create({
        data: {
          action: 'UNASSIGN',
          entityType: 'software_license',
          entityId: id,
          userId,
          details: {}
        }
      })

      return license as SoftwareLicense
    } catch (error) {
      console.error('Error desasignando licencia:', error)
      throw error
    }
  }

  /**
   * Obtiene una licencia por ID (desencripta la clave solo para ADMIN)
   */
  static async getLicenseById(id: string, userRole: string): Promise<SoftwareLicense | null> {
    try {
      const license = await prisma.software_licenses.findUnique({
        where: { id },
        include: {
          equipment: true,
          user: true,
        }
      })

      if (!license) {
        return null
      }

      // Desencriptar clave solo para ADMIN
      if (userRole === 'ADMIN') {
        try {
          license.key = EncryptionService.decrypt(license.key)
        } catch (error) {
          console.error('Error desencriptando clave:', error)
          license.key = '[Error al desencriptar]'
        }
      } else {
        // Para otros roles, enmascarar la clave
        license.key = EncryptionService.maskKey(license.key, 4)
      }

      return license as SoftwareLicense
    } catch (error) {
      console.error('Error obteniendo licencia:', error)
      throw error
    }
  }

  /**
   * Lista licencias con filtros
   */
  static async listLicenses(filters: any, userRole: string): Promise<{ licenses: SoftwareLicense[], total: number }> {
    try {
      const where: any = {}

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { vendor: { contains: filters.search, mode: 'insensitive' } },
        ]
      }

      if (filters.type && filters.type.length > 0) {
        where.type = { in: filters.type }
      }

      if (filters.assigned === 'assigned') {
        where.OR = [
          { assignedToEquipment: { not: null } },
          { assignedToUser: { not: null } },
        ]
      } else if (filters.assigned === 'unassigned') {
        where.assignedToEquipment = null
        where.assignedToUser = null
      }

      if (filters.expired === 'expired') {
        where.expirationDate = { lt: new Date() }
      } else if (filters.expired === 'active') {
        where.OR = [
          { expirationDate: null },
          { expirationDate: { gte: new Date() } },
        ]
      } else if (filters.expired === 'expiring') {
        const thirtyDaysFromNow = new Date()
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
        where.expirationDate = {
          gte: new Date(),
          lte: thirtyDaysFromNow,
        }
      }

      const [licenses, total] = await Promise.all([
        prisma.software_licenses.findMany({
          where,
          include: {
            equipment: true,
            user: true,
          },
          skip: (filters.page - 1) * filters.limit,
          take: filters.limit,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.software_licenses.count({ where }),
      ])

      // Enmascarar claves según rol
      licenses.forEach(license => {
        if (userRole === 'ADMIN') {
          try {
            license.key = EncryptionService.decrypt(license.key)
          } catch (error) {
            license.key = '[Error al desencriptar]'
          }
        } else {
          license.key = EncryptionService.maskKey(license.key, 4)
        }
      })

      return { licenses: licenses as SoftwareLicense[], total }
    } catch (error) {
      console.error('Error listando licencias:', error)
      throw error
    }
  }

  /**
   * Obtiene resumen de licencias
   */
  static async getLicenseSummary(): Promise<LicenseSummary> {
    try {
      const now = new Date()
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const [total, expired, expiringSoon, unassigned, byType, totalCostResult] = await Promise.all([
        prisma.software_licenses.count(),
        prisma.software_licenses.count({
          where: { expirationDate: { lt: now } }
        }),
        prisma.software_licenses.count({
          where: {
            expirationDate: {
              gte: now,
              lte: thirtyDaysFromNow,
            }
          }
        }),
        prisma.software_licenses.count({
          where: {
            assignedToEquipment: null,
            assignedToUser: null,
          }
        }),
        prisma.software_licenses.groupBy({
          by: ['type'],
          _count: true,
        }),
        prisma.software_licenses.aggregate({
          _sum: { cost: true }
        }),
      ])

      const byTypeMap: Record<string, number> = {}
      byType.forEach(item => {
        byTypeMap[item.type] = item._count
      })

      return {
        total,
        active: total - expired,
        expired,
        expiringThisMonth: expiringSoon,
        expiringSoon,
        unassigned,
        byType: byTypeMap,
        totalCost: totalCostResult._sum.cost || 0,
      }
    } catch (error) {
      console.error('Error obteniendo resumen de licencias:', error)
      throw error
    }
  }

  /**
   * Verifica si una licencia está expirada
   */
  static isLicenseExpired(license: SoftwareLicense): boolean {
    if (!license.expirationDate) {
      return false
    }
    return new Date() > new Date(license.expirationDate)
  }

  /**
   * Obtiene licencias próximas a expirar
   */
  static async getExpiringLicenses(days: number): Promise<SoftwareLicense[]> {
    try {
      const targetDate = new Date()
      targetDate.setDate(targetDate.getDate() + days)

      const licenses = await prisma.software_licenses.findMany({
        where: {
          expirationDate: {
            lte: targetDate,
            gte: new Date(),
          }
        },
        include: {
          equipment: true,
          user: true,
        },
        orderBy: { expirationDate: 'asc' },
      })

      return licenses as SoftwareLicense[]
    } catch (error) {
      console.error('Error obteniendo licencias por expirar:', error)
      throw error
    }
  }
}
