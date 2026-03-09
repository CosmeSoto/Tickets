/**
 * Utilidades para manejo de tiempo y horarios
 */

/**
 * Calcula la duración en horas entre dos tiempos
 * @param startTime Hora de inicio en formato HH:mm
 * @param endTime Hora de fin en formato HH:mm
 * @returns Duración en horas o null si los parámetros son inválidos
 */
export function calculateDuration(
  startTime: string | null | undefined,
  endTime: string | null | undefined
): number | null {
  if (!startTime || !endTime) return null
  
  try {
    const start = new Date(`2000-01-01T${startTime}:00`)
    const end = new Date(`2000-01-01T${endTime}:00`)
    
    const durationMs = end.getTime() - start.getTime()
    return durationMs / (1000 * 60 * 60) // Convertir a horas
  } catch (error) {
    console.error('[TIME-UTILS] Error calculando duración:', error)
    return null
  }
}

/**
 * Formatea duración en formato legible
 * @param hours Duración en horas
 * @returns String formateado (ej: "2 horas 30 minutos")
 */
export function formatDuration(hours: number | null | undefined): string {
  if (!hours || hours <= 0) return 'No especificado'
  
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  
  if (h === 0) return `${m} minutos`
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`
  return `${h} ${h === 1 ? 'hora' : 'horas'} ${m} minutos`
}

/**
 * Combina fecha y hora en un DateTime
 * @param date Fecha en formato YYYY-MM-DD
 * @param time Hora en formato HH:mm
 * @returns Date object
 */
export function combineDateAndTime(
  date: string,
  time: string
): Date {
  return new Date(`${date}T${time}:00`)
}

/**
 * Valida que end_time sea posterior a start_time
 * @param startTime Hora de inicio en formato HH:mm
 * @param endTime Hora de fin en formato HH:mm
 * @returns true si el rango es válido
 */
export function validateTimeRange(
  startTime: string,
  endTime: string
): boolean {
  const duration = calculateDuration(startTime, endTime)
  return duration !== null && duration > 0
}

/**
 * Extrae la hora de un DateTime en formato HH:mm
 * @param date Date object
 * @returns Hora en formato HH:mm
 */
export function extractTime(date: Date | null | undefined): string | null {
  if (!date) return null
  
  try {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  } catch (error) {
    console.error('[TIME-UTILS] Error extrayendo hora:', error)
    return null
  }
}

/**
 * Valida formato de hora HH:mm
 * @param time Hora a validar
 * @returns true si el formato es válido
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
  return timeRegex.test(time)
}
