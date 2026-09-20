/**
 * No existe una ruta genérica `/tickets/[id]` — cada rol tiene su propia
 * ficha de ticket (`/admin/tickets/[id]`, `/technician/tickets/[id]`,
 * `/client/tickets/[id]`). Usado por el módulo de Tareas (tablero/calendario)
 * para enlazar al ticket de origen de una tarea.
 */
export function ticketUrlForRole(role: string | undefined, ticketId: string): string {
  if (role === 'ADMIN') return `/admin/tickets/${ticketId}`
  if (role === 'TECHNICIAN') return `/technician/tickets/${ticketId}`
  return `/client/tickets/${ticketId}`
}
