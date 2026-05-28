/**
 * Formatea una duración en horas en formato completo en español
 * @param hours - Duración en horas (ej: 0.5, 1.3, 2)
 * @param format - 'short' para formato abreviado (1h 30m), 'long' para formato completo (1 hora 30 minutos)
 * @returns Cadena formateada
 */
export const formatDuration = (
  hours?: number,
  format: 'short' | 'long' = 'long'
): string => {
  if (hours === undefined || hours === null) return '-'
  if (hours === 0) return format === 'short' ? '0m' : '0 minutos'
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return format === 'short' 
      ? `${minutes}m` 
      : `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  }
  
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  
  if (minutes > 0) {
    return format === 'short'
      ? `${wholeHours}h ${minutes}m`
      : `${wholeHours} ${wholeHours === 1 ? 'hora' : 'horas'} ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`
  }
  
  return format === 'short'
    ? `${wholeHours}h`
    : `${wholeHours} ${wholeHours === 1 ? 'hora' : 'horas'}`
}

/**
 * Formatea una duración en minutos entre dos horas HH:MM
 */
export const calculateDuration = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return ''

  const [startHour, startMin] = startTime.split(':').map(Number)
  const [endHour, endMin] = endTime.split(':').map(Number)

  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  const durationMinutes = endMinutes - startMinutes

  if (durationMinutes <= 0) return 'Horario inválido'

  const hours = Math.floor(durationMinutes / 60)
  const minutes = durationMinutes % 60

  if (hours === 0) return `${minutes} minutos`
  if (minutes === 0) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  return `${hours} ${hours === 1 ? 'hora' : 'horas'} ${minutes} minutos`
}
