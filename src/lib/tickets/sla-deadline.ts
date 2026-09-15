/**
 * Cálculo del deadline de un SLA, respetando "solo horas hábiles" cuando aplica.
 *
 * Extraído de `SLAService.calculateDeadline` como función pura para poder
 * probarlo sin mockear Prisma, y porque tenía dos bugs reales:
 *
 * 1. Usaba `Date.getHours()/getDay()/setHours()`, que leen/escriben en la
 *    zona horaria del PROCESO de Node (la del servidor donde corre, casi
 *    siempre UTC en producción/Docker), no en la zona horaria configurada de
 *    la app (`getAppTimezone()` / `TZ`, ej. America/Guayaquil, la misma que
 *    usa `date-utils.ts` para mostrarle fechas al usuario). Un admin que
 *    configura "horario laboral 08:00–17:00" lo hace pensando en hora local,
 *    pero el cálculo lo interpretaba como 08:00–17:00 UTC — con
 *    America/Guayaquil (UTC-5) eso equivale en la práctica a un horario
 *    laboral de 03:00–12:00 hora local, y además puede "correr" la fecha de
 *    creación al día calendario siguiente (22:01 local del lunes = 03:01 UTC
 *    del martes). Resultado: deadlines que no corresponden a lo configurado
 *    ni a lo que se ve en pantalla.
 * 2. Al adelantar `deadline` al inicio del horario laboral cuando el ticket
 *    se creaba antes de que abriera, seguía calculando `hoursUntilEnd` con
 *    el `currentHour`/`currentMinute` de ANTES del ajuste (valor obsoleto),
 *    inflando artificialmente las horas disponibles ese primer día.
 *
 * Esta versión hace toda la aritmética en "hora civil" del negocio (año,
 * mes, día, hora, minuto, día de la semana tal como se ven en `timeZone`),
 * y solo al final convierte el resultado a un instante real (UTC) — así
 * "08:00–17:00" siempre significa 08:00–17:00 en la zona horaria de la app,
 * sin importar dónde corra el proceso de Node.
 */

interface ZonedParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  weekday: string // 'SUN' | 'MON' | ...
}

/** Componentes de fecha/hora "civil" de `date` tal como se ven en `timeZone`. */
function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''

  // Algunos motores devuelven "24" para la medianoche con hour12:false.
  let hour = Number(get('hour'))
  if (hour === 24) hour = 0

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
    weekday: get('weekday').toUpperCase().slice(0, 3),
  }
}

/** Convierte una fecha/hora civil (tal como se vería en `timeZone`) al instante UTC real. */
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  // 1) Suposición inicial: tratar los componentes como si ya fueran UTC.
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  // 2) ¿Qué hora civil produce ese instante en `timeZone`? La diferencia es el offset real.
  const seen = getZonedParts(guess, timeZone)
  const seenAsUtc = Date.UTC(
    seen.year,
    seen.month - 1,
    seen.day,
    seen.hour,
    seen.minute,
    seen.second
  )
  const correction = guess.getTime() - seenAsUtc
  return new Date(guess.getTime() + correction)
}

/**
 * Calcula el deadline de un SLA a partir de `startDate` y una cantidad de
 * horas, respetando horario laboral si `businessHoursOnly` es true.
 *
 * @param timeZone Zona horaria en la que se interpretan `businessStart`/`businessEnd`
 *                 y en la que se hace toda la aritmética de días/horas. Por defecto,
 *                 la zona horaria configurada de la app (`getAppTimezone()`).
 */
export function calculateSlaDeadline(
  startDate: Date,
  hours: number,
  businessHoursOnly: boolean,
  businessStart: string = '09:00:00',
  businessEnd: string = '18:00:00',
  businessDays: string = 'MON,TUE,WED,THU,FRI',
  timeZone: string
): Date {
  if (!businessHoursOnly) {
    return new Date(startDate.getTime() + hours * 60 * 60 * 1000)
  }

  const businessDaysArray = businessDays.split(',')
  const [startHour, startMinute] = businessStart.split(':').map(Number)
  const [endHour, endMinute] = businessEnd.split(':').map(Number)

  let { year, month, day, hour, minute, weekday } = getZonedParts(startDate, timeZone)
  let remainingHours = hours

  /** Avanza un día civil completo y deja hour/minute al inicio del horario laboral. */
  const advanceToNextDay = () => {
    // Se usa el mediodía como ancla para evitar ambigüedades si algún día
    // tuviera un cambio de horario (Guayaquil no lo tiene, pero la función
    // queda correcta para cualquier zona horaria).
    const noonUtc = zonedTimeToUtc(year, month, day, 12, 0, timeZone)
    const next = getZonedParts(new Date(noonUtc.getTime() + 24 * 60 * 60 * 1000), timeZone)
    year = next.year
    month = next.month
    day = next.day
    weekday = next.weekday
    hour = startHour
    minute = startMinute
  }

  while (remainingHours > 0) {
    if (!businessDaysArray.includes(weekday)) {
      advanceToNextDay()
      continue
    }

    // Antes del horario laboral: mover al inicio (mismo día).
    if (hour < startHour || (hour === startHour && minute < startMinute)) {
      hour = startHour
      minute = startMinute
    }

    // Después del horario laboral: pasar al siguiente día laboral.
    if (hour >= endHour) {
      advanceToNextDay()
      continue
    }

    const hoursUntilEnd = endHour - hour + (endMinute - minute) / 60

    if (remainingHours <= hoursUntilEnd) {
      const totalMinutes = hour * 60 + minute + Math.round(remainingHours * 60)
      hour = Math.floor(totalMinutes / 60)
      minute = totalMinutes % 60
      remainingHours = 0
    } else {
      remainingHours -= hoursUntilEnd
      advanceToNextDay()
    }
  }

  return zonedTimeToUtc(year, month, day, hour, minute, timeZone)
}
