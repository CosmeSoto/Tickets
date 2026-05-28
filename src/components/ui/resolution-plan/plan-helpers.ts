import type { ResolutionTask } from '@/hooks/use-resolution-plan'
import { calculateDuration, formatDuration } from '@/lib/utils/time-utils'

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// Re-exportar funciones globales para mantener compatibilidad con código existente
export { calculateDuration, formatDuration }

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
