import type { Ticket } from '@/hooks/use-ticket-data'

export interface TicketFilterValues {
  search?: string
  status?: string
  priority?: string
  category?: string
  assignee?: string
  dateRange?: string
}

/**
 * Aplica filtros de fecha sobre un ticket.
 * Retorna false si el ticket NO cumple el filtro (debe excluirse).
 */
function matchesDateRange(createdAt: string, dateRange: string): boolean {
  if (!dateRange || dateRange === 'all') return true

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const createdDate = new Date(createdAt)

  switch (dateRange) {
    case 'today':
      return createdDate >= today
    case 'yesterday': {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return createdDate >= yesterday && createdDate < today
    }
    case 'week': {
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return createdDate >= weekAgo
    }
    case 'month': {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return createdDate >= monthAgo
    }
    case 'older': {
      const monthAgo = new Date(today)
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      return createdDate < monthAgo
    }
    default:
      return true
  }
}

/**
 * Filtra tickets para el panel de ADMIN.
 * Sin restricción de propietario — ve todos los tickets.
 */
export function filterTicketsAdmin(tickets: Ticket[], filters: TicketFilterValues): Ticket[] {
  return tickets.filter(ticket => {
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const match =
        ticket.title.toLowerCase().includes(q) ||
        (ticket.description?.toLowerCase().includes(q) ?? false) ||
        (ticket.client?.name?.toLowerCase().includes(q) ?? false) ||
        (ticket.assignee?.name?.toLowerCase().includes(q) ?? false)
      if (!match) return false
    }
    if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) return false
    if (filters.priority && filters.priority !== 'all' && ticket.priority !== filters.priority) return false
    if (filters.category && filters.category !== 'all' && ticket.category?.id !== filters.category) return false
    if (filters.assignee === 'unassigned' && ticket.assignee) return false
    if (filters.assignee && filters.assignee !== 'all' && filters.assignee !== 'unassigned' && ticket.assignee?.id !== filters.assignee) return false
    if (!matchesDateRange(ticket.createdAt, filters.dateRange ?? 'all')) return false
    return true
  })
}

/**
 * Filtra tickets para el panel de TÉCNICO.
 * Solo muestra tickets asignados al técnico dado.
 */
export function filterTicketsTechnician(tickets: Ticket[], filters: TicketFilterValues, technicianId: string): Ticket[] {
  return tickets.filter(ticket => {
    if (ticket.assignee?.id !== technicianId) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const match =
        ticket.title.toLowerCase().includes(q) ||
        (ticket.description?.toLowerCase().includes(q) ?? false) ||
        (ticket.client?.name?.toLowerCase().includes(q) ?? false)
      if (!match) return false
    }
    if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) return false
    if (filters.priority && filters.priority !== 'all' && ticket.priority !== filters.priority) return false
    if (filters.category && filters.category !== 'all' && ticket.category?.id !== filters.category) return false
    if (!matchesDateRange(ticket.createdAt, filters.dateRange ?? 'all')) return false
    return true
  })
}

/**
 * Filtra tickets para el panel de CLIENTE.
 * Solo muestra tickets del cliente dado.
 */
export function filterTicketsClient(tickets: Ticket[], filters: TicketFilterValues, clientId: string): Ticket[] {
  return tickets.filter(ticket => {
    if (ticket.client?.id !== clientId) return false
    if (filters.search) {
      const q = filters.search.toLowerCase()
      const match =
        ticket.title.toLowerCase().includes(q) ||
        (ticket.description?.toLowerCase().includes(q) ?? false) ||
        (ticket.assignee?.name?.toLowerCase().includes(q) ?? false)
      if (!match) return false
    }
    if (filters.status && filters.status !== 'all' && ticket.status !== filters.status) return false
    if (filters.priority && filters.priority !== 'all' && ticket.priority !== filters.priority) return false
    if (filters.category && filters.category !== 'all' && ticket.category?.id !== filters.category) return false
    if (!matchesDateRange(ticket.createdAt, filters.dateRange ?? 'all')) return false
    return true
  })
}
