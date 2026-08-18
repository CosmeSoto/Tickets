import prisma from '@/lib/prisma'
import { formatYmdCompact } from '@/lib/utils/date-utils'
import {
  exampleTicketCode,
  formatTicketCode,
  parseTicketCode,
} from '@/lib/tickets/ticket-code-format'

export {
  exampleTicketCode,
  formatTicketCode,
  parseTicketCode,
} from '@/lib/tickets/ticket-code-format'
export type { ParsedTicketCode } from '@/lib/tickets/ticket-code-format'

export class TicketCodeService {
  /**
   * Genera código automático con transacción atómica.
   * Usa SELECT ... FOR UPDATE en ticket_code_counters para evitar race conditions.
   * Formato: {codePrefix}-{YYYYMMDD}-{sequence padded to 4 digits}
   * Ej: "ADM-20260818-0001"
   * La secuencia sigue siendo anual por familia (el mes-día identifica el día de creación).
   */
  static async generateCode(
    familyId: string,
    year?: number,
    now: Date = new Date()
  ): Promise<string> {
    const dateStamp = formatYmdCompact(now)
    const currentYear = year ?? parseInt(dateStamp.slice(0, 4), 10)

    return await prisma.$transaction(async tx => {
      const config = await tx.ticket_family_config.findUnique({
        where: { familyId },
        select: { codePrefix: true },
      })

      const family = await tx.families.findUnique({
        where: { id: familyId },
        select: { code: true },
      })

      if (!family) {
        throw new Error(`Familia con id "${familyId}" no encontrada`)
      }

      const prefix = config?.codePrefix ?? family.code

      const counters = await tx.$queryRaw<Array<{ last_sequence: number }>>`
        SELECT last_sequence FROM ticket_code_counters
        WHERE family_id = ${familyId} AND year = ${currentYear}
        FOR UPDATE
      `

      const counterSeq = counters[0]?.last_sequence ?? 0

      // Códigos nuevos (PREF-YYYYMMDD-0001) y legacy (PREF-YYYY-0001) del mismo año
      const yearPrefix = `${prefix}-${currentYear}`
      const maxInDb = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
        SELECT MAX(
          CAST(SPLIT_PART(ticket_code, '-', ARRAY_LENGTH(STRING_TO_ARRAY(ticket_code, '-'), 1)) AS INTEGER)
        ) AS max_seq
        FROM tickets
        WHERE family_id = ${familyId}
          AND ticket_code LIKE ${yearPrefix + '%'}
          AND ticket_code ~ '[0-9]+$'
      `

      const dbMaxSeq = maxInDb[0]?.max_seq ?? 0
      const nextSeq = Math.max(counterSeq, dbMaxSeq) + 1

      await tx.ticket_code_counters.upsert({
        where: { familyId_year: { familyId, year: currentYear } },
        update: { lastSequence: nextSeq },
        create: { familyId, year: currentYear, lastSequence: nextSeq },
      })

      return formatTicketCode(prefix, dateStamp, nextSeq)
    })
  }

  /**
   * Valida que el código manual:
   * 1. Siga el formato {PREFIJO}-{YYYYMMDD}-{SECUENCIA} (o el legado {PREFIJO}-{AÑO}-{SECUENCIA})
   * 2. El prefijo corresponda a la familia
   * 3. No esté ya en uso
   */
  static async validateManualCode(
    code: string,
    familyId: string
  ): Promise<{ valid: boolean; error?: string }> {
    const parsed = parseTicketCode(code)
    if (!parsed) {
      return {
        valid: false,
        error: `El código debe seguir el formato {PREFIJO}-{AÑOMESDÍA}-{SECUENCIA} (ej: ${exampleTicketCode('TI')})`,
      }
    }

    const [config, family] = await Promise.all([
      prisma.ticket_family_config.findUnique({
        where: { familyId },
        select: { codePrefix: true },
      }),
      prisma.families.findUnique({
        where: { id: familyId },
        select: { code: true },
      }),
    ])

    if (!family) {
      return { valid: false, error: `Familia con id "${familyId}" no encontrada` }
    }

    const expectedPrefix = config?.codePrefix ?? family.code

    if (parsed.prefix !== expectedPrefix) {
      return {
        valid: false,
        error: `El prefijo "${parsed.prefix}" no corresponde a la familia (prefijo esperado: "${expectedPrefix}")`,
      }
    }

    const existing = await prisma.tickets.findUnique({
      where: { ticketCode: code.trim().toUpperCase() },
      select: { id: true },
    })

    if (existing) {
      return { valid: false, error: `El código "${code}" ya está en uso` }
    }

    return { valid: true }
  }

  /**
   * Si la secuencia del código manual es mayor al contador actual,
   * actualiza el contador para evitar colisiones futuras.
   */
  static async updateCounterIfNeeded(
    familyId: string,
    year: number,
    sequence: number
  ): Promise<void> {
    const counter = await prisma.ticket_code_counters.findUnique({
      where: { familyId_year: { familyId, year } },
      select: { lastSequence: true },
    })

    const currentSeq = counter?.lastSequence ?? 0

    if (sequence > currentSeq) {
      await prisma.ticket_code_counters.upsert({
        where: { familyId_year: { familyId, year } },
        update: { lastSequence: sequence },
        create: { familyId, year, lastSequence: sequence },
      })
    }
  }
}
