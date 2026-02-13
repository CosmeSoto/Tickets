/**
 * Utilidades para tickets
 * Funciones compartidas para manejo de tickets, prioridades, estados, etc.
 */

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

/**
 * Obtiene las clases de color para una prioridad
 */
export const getPriorityColor = (priority: Priority | string): string => {
  const colors: Record<string, string> = {
    URGENT: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    LOW: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  }
  return colors[priority] || 'bg-muted text-muted-foreground'
}

/**
 * Obtiene las clases de color para un estado
 */
export const getStatusColor = (status: Status | string): string => {
  const colors: Record<string, string> = {
    OPEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    IN_PROGRESS: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    CLOSED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  }
  return colors[status] || 'bg-muted text-muted-foreground'
}

/**
 * Obtiene la etiqueta en español para una prioridad
 */
export const getPriorityLabel = (priority: Priority | string): string => {
  const labels: Record<string, string> = {
    URGENT: 'Urgente',
    HIGH: 'Alta',
    MEDIUM: 'Media',
    LOW: 'Baja',
  }
  return labels[priority] || priority
}

/**
 * Obtiene la etiqueta en español para un estado
 */
export const getStatusLabel = (status: Status | string): string => {
  const labels: Record<string, string> = {
    OPEN: 'Abierto',
    IN_PROGRESS: 'En Progreso',
    RESOLVED: 'Resuelto',
    CLOSED: 'Cerrado',
  }
  return labels[status] || status
}

/**
 * Formatea el tiempo transcurrido desde una fecha
 */
export const formatTimeElapsed = (date: string | Date): string => {
  const now = new Date()
  const created = new Date(date)
  const diff = now.getTime() - created.getTime()

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return 'Ahora'
}

/**
 * Obtiene el color del icono según la prioridad
 */
export const getPriorityIconColor = (priority: Priority | string): string => {
  const colors: Record<string, string> = {
    URGENT: 'text-red-600 dark:text-red-400',
    HIGH: 'text-orange-600 dark:text-orange-400',
    MEDIUM: 'text-yellow-600 dark:text-yellow-400',
    LOW: 'text-green-600 dark:text-green-400',
  }
  return colors[priority] || 'text-muted-foreground'
}

/**
 * Obtiene el color del icono según el estado
 */
export const getStatusIconColor = (status: Status | string): string => {
  const colors: Record<string, string> = {
    OPEN: 'text-blue-600 dark:text-blue-400',
    IN_PROGRESS: 'text-purple-600 dark:text-purple-400',
    RESOLVED: 'text-green-600 dark:text-green-400',
    CLOSED: 'text-gray-600 dark:text-gray-400',
  }
  return colors[status] || 'text-muted-foreground'
}

/**
 * Obtiene las opciones de prioridad para selects
 */
export const getPriorityOptions = () => [
  { value: 'LOW', label: 'Baja', color: 'green' },
  { value: 'MEDIUM', label: 'Media', color: 'yellow' },
  { value: 'HIGH', label: 'Alta', color: 'orange' },
  { value: 'URGENT', label: 'Urgente', color: 'red' },
]

/**
 * Obtiene las opciones de estado para selects
 */
export const getStatusOptions = () => [
  { value: 'OPEN', label: 'Abierto', color: 'blue' },
  { value: 'IN_PROGRESS', label: 'En Progreso', color: 'purple' },
  { value: 'RESOLVED', label: 'Resuelto', color: 'green' },
  { value: 'CLOSED', label: 'Cerrado', color: 'gray' },
]

/**
 * Verifica si un ticket está vencido (más de 24h sin respuesta)
 */
export const isTicketOverdue = (createdAt: string | Date, lastUpdate?: string | Date): boolean => {
  const now = new Date()
  const reference = lastUpdate ? new Date(lastUpdate) : new Date(createdAt)
  const diff = now.getTime() - reference.getTime()
  const hours = diff / (1000 * 60 * 60)
  return hours > 24
}

/**
 * Obtiene el nivel de urgencia de un ticket (0-100)
 */
export const getTicketUrgencyScore = (
  priority: Priority | string,
  status: Status | string,
  createdAt: string | Date
): number => {
  const priorityScores: Record<string, number> = {
    URGENT: 40,
    HIGH: 30,
    MEDIUM: 20,
    LOW: 10,
  }

  const statusScores: Record<string, number> = {
    OPEN: 30,
    IN_PROGRESS: 20,
    RESOLVED: 5,
    CLOSED: 0,
  }

  const timeScore = Math.min(30, Math.floor(Number(formatTimeElapsed(createdAt).replace(/\D/g, '') || 0)))

  return (priorityScores[priority] || 0) + (statusScores[status] || 0) + timeScore
}

/**
 * Filtra tickets según criterios
 */
export const filterTickets = <T extends { priority: string; status: string; title: string }>(
  tickets: T[],
  filters: {
    priority?: string
    status?: string
    search?: string
  }
): T[] => {
  return tickets.filter(ticket => {
    if (filters.priority && ticket.priority !== filters.priority) return false
    if (filters.status && ticket.status !== filters.status) return false
    if (filters.search && !ticket.title.toLowerCase().includes(filters.search.toLowerCase()))
      return false
    return true
  })
}

/**
 * Ordena tickets por urgencia
 */
export const sortTicketsByUrgency = <
  T extends { priority: string; status: string; createdAt: string }
>(
  tickets: T[]
): T[] => {
  return [...tickets].sort((a, b) => {
    const scoreA = getTicketUrgencyScore(a.priority, a.status, a.createdAt)
    const scoreB = getTicketUrgencyScore(b.priority, b.status, b.createdAt)
    return scoreB - scoreA
  })
}
