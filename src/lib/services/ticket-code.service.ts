import prisma from '@/lib/prisma'

export class TicketCodeService {
  /**
   * Genera código automático con transacción atómica.
   * Usa SELECT ... FOR UPDATE en ticket_code_counters para evitar race conditions.
   * Formato: {codePrefix}-{year}-{sequence padded to 4 digits}
   * Ej: "TI-2026-0001"
   */
  static async generateCode(familyId: string, year?: number): Promise<string> {
    const currentYear = year ?? new Date().getFullYear()

    return await prisma.$transaction(async tx => {
      // Obtener config y familia para el prefijo
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

      // Bloquear fila del contador para esta familia+año con SELECT ... FOR UPDATE
      const counters = await tx.$queryRaw<Array<{ last_sequence: number }>>`
        SELECT last_sequence FROM ticket_code_counters
        WHERE family_id = ${familyId} AND year = ${currentYear}
        FOR UPDATE
      `

      const counterSeq = counters[0]?.last_sequence ?? 0

      // Sincronizar con el máximo real en tickets para evitar colisiones
      // cuando el contador esté desincronizado con los datos reales
      const maxInDb = await tx.$queryRaw<Array<{ max_seq: number | null }>>`
        SELECT MAX(
          CAST(SPLIT_PART(ticket_code, '-', ARRAY_LENGTH(STRING_TO_ARRAY(ticket_code, '-'), 1)) AS INTEGER)
        ) AS max_seq
        FROM tickets
        WHERE family_id = ${familyId}
          AND ticket_code LIKE ${prefix + '-' + currentYear + '-%'}
      `

      const dbMaxSeq = maxInDb[0]?.max_seq ?? 0
      const nextSeq = Math.max(counterSeq, dbMaxSeq) + 1

      // Upsert del contador con el valor sincronizado
      await tx.ticket_code_counters.upsert({
        where: { familyId_year: { familyId, year: currentYear } },
        update: { lastSequence: nextSeq },
        create: { familyId, year: currentYear, lastSequence: nextSeq },
      })

      return `${prefix}-${currentYear}-${String(nextSeq).padStart(4, '0')}`
    })
  }

  /**
   * Valida que el código manual:
   * 1. Siga el formato {PREFIJO}-{AÑO}-{SECUENCIA}
   * 2. El prefijo corresponda a la familia (ticket_family_config.codePrefix o families.code)
   * 3. No esté ya en uso en tickets
   */
  static async validateManualCode(
    code: string,
    familyId: string
  ): Promise<{ valid: boolean; error?: string }> {
    // 1. Validar formato
    const formatRegex = /^[A-Z0-9]+-\d{4}-\d{4}$/
    if (!formatRegex.test(code)) {
      return {
        valid: false,
        error: 'El código debe seguir el formato {PREFIJO}-{AÑO}-{SECUENCIA} (ej: TI-2026-0001)',
      }
    }

    // 2. Obtener prefijo esperado de la familia
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
    const codePrefix = code.split('-')[0]

    if (codePrefix !== expectedPrefix) {
      return {
        valid: false,
        error: `El prefijo "${codePrefix}" no corresponde a la familia (prefijo esperado: "${expectedPrefix}")`,
      }
    }

    // 3. Verificar que no esté en uso
    const existing = await prisma.tickets.findUnique({
      where: { ticketCode: code },
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
