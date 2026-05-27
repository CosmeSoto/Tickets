import type { ResolutionTask } from '@/hooks/use-resolution-plan'

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

export const formatDuration = (hours?: number): string => {
  if (hours === undefined || hours === null) return '-'
  if (hours === 0) return '0h'
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}m`
  }
  const wholeHours = Math.floor(hours)
  const minutes = Math.round((hours - wholeHours) * 60)
  if (minutes > 0) {
    return `${wholeHours}h ${minutes}m`
  }
  return `${wholeHours}h`
}

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    draft: 'Borrador',
    active: 'Activo',
    completed: 'Completado',
    cancelled: 'Cancelado',
  }
  return labels[status] || status
}

export const getPriorityLabel = (priority: ResolutionTask['priority']) => {
  switch (priority) {
    case 'high':
      return 'Alta'
    case 'medium':
      return 'Media'
    default:
      return 'Baja'
  }
}

export const getStatusColor = (status: ResolutionTask['status'] | string) => {
  switch (status) {
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    case 'in_progress':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'blocked':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'active':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    case 'draft':
      return 'bg-muted text-foreground'
    default:
      return 'bg-muted text-foreground'
  }
}

export const getPriorityColor = (priority: ResolutionTask['priority']) => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    default:
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  }
}
