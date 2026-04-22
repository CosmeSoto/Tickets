import prisma from '@/lib/prisma'

/**
 * Servicio para generación de folios secuenciales
 * Formato: ACT-YYYY-NNNNN para actas de entrega
 * Formato: DEV-YYYY-NNNNN para actas de devolución
 */
export class FolioService {
  /**
   * Genera un folio único para acta de entrega
   * Formato: ACT-YYYY-NNNNN
   */
  static async generateDeliveryActFolio(): Promise<string> {
    return this.generateFolio('ACT')
  }

  /**
   * Genera un folio único para acta de devolución
   * Formato: DEV-YYYY-NNNNN
   */
  static async generateReturnActFolio(): Promise<string> {
    return this.generateFolio('DEV')
  }

  /**
   * Genera un folio único para acta de baja
   * Formato: BAJ-YYYY-NNNNN
   */
  static async generateDecommissionActFolio(): Promise<string> {
    return this.generateFolio('BAJ')
  }

  /**
   * Genera un folio secuencial único
   * Thread-safe usando transacciones de Prisma
   */
  private static async generateFolio(type: 'ACT' | 'DEV' | 'BAJ'): Promise<string> {
    const currentYear = new Date().getFullYear()

    try {
      // Usar transacción para garantizar atomicidad
      const result = await prisma.$transaction(async (tx) => {
        // Buscar o crear contador para el año actual
        let counter = await tx.folio_counters.findUnique({
          where: {
            year_type: {
              year: currentYear,
              type: type,
            },
          },
        })

        if (!counter) {
          // Crear nuevo contador para el año
          counter = await tx.folio_counters.create({
            data: {
              year: currentYear,
              type: type,
              lastNumber: 1,
            },
          })
        } else {
          // Incrementar contador existente
          counter = await tx.folio_counters.update({
            where: {
              year_type: {
                year: currentYear,
                type: type,
              },
            },
            data: {
              lastNumber: {
                increment: 1,
              },
            },
          })
        }

        return counter
      })

      // Formatear folio: ACT-2024-00001
      const paddedNumber = result.lastNumber.toString().padStart(5, '0')
      return `${type}-${currentYear}-${paddedNumber}`
    } catch (error) {
      console.error('Error generando folio:', error)
      throw new Error('No se pudo generar el folio')
    }
  }

  /**
   * Verifica si un folio existe
   */
  static async folioExists(folio: string, type: 'delivery' | 'return'): Promise<boolean> {
    try {
      if (type === 'delivery') {
        const act = await prisma.delivery_acts.findUnique({
          where: { folio },
        })
        return !!act
      } else {
        const act = await prisma.return_acts.findUnique({
          where: { folio },
        })
        return !!act
      }
    } catch (error) {
      console.error('Error verificando folio:', error)
      return false
    }
  }

  /**
   * Obtiene el último número de folio para un año y tipo
   */
  static async getLastFolioNumber(year: number, type: 'ACT' | 'DEV' | 'BAJ'): Promise<number> {
    try {
      const counter = await prisma.folio_counters.findUnique({
        where: {
          year_type: {
            year,
            type,
          },
        },
      })

      return counter?.lastNumber || 0
    } catch (error) {
      console.error('Error obteniendo último folio:', error)
      return 0
    }
  }

  /**
   * Reinicia el contador de folios para un año (solo para testing/admin)
   */
  static async resetCounter(year: number, type: 'ACT' | 'DEV' | 'BAJ'): Promise<void> {
    try {
      await prisma.folio_counters.upsert({
        where: {
          year_type: {
            year,
            type,
          },
        },
        update: {
          lastNumber: 0,
        },
        create: {
          year,
          type,
          lastNumber: 0,
        },
      })
    } catch (error) {
      console.error('Error reiniciando contador:', error)
      throw new Error('No se pudo reiniciar el contador')
    }
  }
}
