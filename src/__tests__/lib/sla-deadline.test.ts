/**
 * calculateSlaDeadline — antes vivía como método privado de SLAService y
 * calculaba "horas laborales" con Date.getHours()/setHours(), que leen/
 * escriben en la zona horaria del PROCESO de Node, no en la zona horaria
 * configurada de la app (getAppTimezone()/TZ). Además tenía un bug de
 * "hora obsoleta" al saltar al inicio del horario laboral. Este test
 * reproduce un caso real observado en producción (ticket #ADM-20260914-0001,
 * prioridad Baja, política de familia 48h de resolución, horario laboral
 * 08:00–17:00 lun-vie) para confirmar que con la zona horaria de la app el
 * resultado coincide con lo que un humano en esa zona horaria esperaría, no
 * con un cálculo desplazado por el offset UTC del servidor.
 */

import { calculateSlaDeadline } from '@/lib/tickets/sla-deadline'

const TZ = 'America/Guayaquil' // UTC-5, sin horario de verano

describe('calculateSlaDeadline', () => {
  it('sin horario laboral: simplemente suma las horas (independiente de zona horaria)', () => {
    const start = new Date('2026-09-14T22:01:00.000Z')
    const result = calculateSlaDeadline(
      start,
      4,
      false,
      '09:00:00',
      '18:00:00',
      'MON,TUE,WED,THU,FRI',
      TZ
    )
    expect(result.toISOString()).toBe('2026-09-15T02:01:00.000Z')
  })

  it('regresión: un ticket creado un lunes a las 22:01 hora LOCAL (después del horario laboral) empieza a contar horas laborales el martes a las 08:00 local, no a las 03:01 UTC (que ya "cabría" antes de las 08:00 UTC)', () => {
    // 2026-09-14 22:01 en America/Guayaquil (lunes, después de horario) == 2026-09-15T03:01:00Z
    const start = new Date('2026-09-15T03:01:00.000Z')
    // 8 horas de respuesta, 08:00–17:00 lun-vie
    const result = calculateSlaDeadline(
      start,
      8,
      true,
      '08:00:00',
      '17:00:00',
      'MON,TUE,WED,THU,FRI',
      TZ
    )
    // Debe contar desde el martes 08:00 local (13:00Z) + 8h laborales completas
    // (cabe todo el mismo día: 08:00 + 8h = 16:00 local == 21:00Z)
    expect(result.toISOString()).toBe('2026-09-15T21:00:00.000Z')
  })

  it('regresión: 48h laborales (Baja, política de familia real) creado un lunes a las 22:01 local cruza un fin de semana y no debe adelantarse artificialmente por la hora UTC del servidor', () => {
    const start = new Date('2026-09-15T03:01:00.000Z') // lunes 14 sept, 22:01 local
    const result = calculateSlaDeadline(
      start,
      48,
      true,
      '08:00:00',
      '17:00:00',
      'MON,TUE,WED,THU,FRI',
      TZ
    )
    // Cálculo esperado en hora local: empieza martes 08:00 (9h/día)
    // mar+mié+jue+vie = 36h, quedan 12h -> salta fin de semana -> lunes 9h, quedan 3h -> martes 08:00+3h = 11:00 local
    // 11:00 local (UTC-5) == 16:00Z
    expect(result.toISOString()).toBe('2026-09-22T16:00:00.000Z')
  })

  it('un ticket creado dentro del horario laboral cuenta desde ese mismo momento (sin el bug de "hora obsoleta")', () => {
    // 2026-09-15 10:00 local == 15:00Z (martes, dentro de 08:00-17:00)
    const start = new Date('2026-09-15T15:00:00.000Z')
    const result = calculateSlaDeadline(
      start,
      5,
      true,
      '08:00:00',
      '17:00:00',
      'MON,TUE,WED,THU,FRI',
      TZ
    )
    // 10:00 + 5h = 15:00 local == 20:00Z (cabe en el mismo día: quedan 7h hasta las 17:00)
    expect(result.toISOString()).toBe('2026-09-15T20:00:00.000Z')
  })

  it('salta fines de semana y días fuera de businessDays', () => {
    // Viernes 2026-09-18, 16:00 local == 21:00Z (dentro de horario, queda 1h hasta las 17:00)
    const start = new Date('2026-09-18T21:00:00.000Z')
    const result = calculateSlaDeadline(
      start,
      10,
      true,
      '08:00:00',
      '17:00:00',
      'MON,TUE,WED,THU,FRI',
      TZ
    )
    // Queda 1h el viernes -> restan 9h -> lunes 08:00 + 9h = 17:00 local == 22:00Z
    expect(result.toISOString()).toBe('2026-09-21T22:00:00.000Z')
  })
})
