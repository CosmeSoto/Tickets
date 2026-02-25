/**
 * Servicio para resolver IDs (UUIDs) a nombres legibles
 * Usado en auditoría, reportes y exportaciones
 */

import prisma from '@/lib/prisma'

export class IdResolverService {
  /**
   * Resuelve un ID de usuario a nombre legible
   */
  static async resolveUserId(userId: string | null): Promise<string> {
    if (!userId) return 'Sin asignar'
    
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { name: true, email: true }
      })
      return user ? `${user.name} (${user.email})` : userId
    } catch {
      return userId
    }
  }

  /**
   * Resuelve un ID de departamento a nombre legible
   */
  static async resolveDepartmentId(departmentId: string | null): Promise<string> {
    if (!departmentId) return 'Sin departamento'
    
    try {
      const department = await prisma.departments.findUnique({
        where: { id: departmentId },
        select: { name: true }
      })
      return department?.name || departmentId
    } catch {
      return departmentId
    }
  }

  /**
   * Resuelve un ID de categoría a nombre legible
   */
  static async resolveCategoryId(categoryId: string | null): Promise<string> {
    if (!categoryId) return 'Sin categoría'
    
    try {
      const category = await prisma.categories.findUnique({
        where: { id: categoryId },
        select: { name: true }
      })
      return category?.name || categoryId
    } catch {
      return categoryId
    }
  }

  /**
   * Resuelve un ID de ticket a número legible
   */
  static async resolveTicketId(ticketId: string | null): Promise<string> {
    if (!ticketId) return 'Sin ticket'
    
    try {
      const ticket = await prisma.tickets.findUnique({
        where: { id: ticketId },
        select: { id: true, title: true }
      })
      return ticket ? `Ticket: ${ticket.title}` : ticketId
    } catch {
      return ticketId
    }
  }

  /**
   * Resuelve múltiples IDs de usuarios
   */
  static async resolveUserIds(userIds: string[]): Promise<Record<string, string>> {
    if (userIds.length === 0) return {}
    
    try {
      const users = await prisma.users.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true }
      })
      
      const result: Record<string, string> = {}
      users.forEach(user => {
        result[user.id] = `${user.name} (${user.email})`
      })
      return result
    } catch {
      return {}
    }
  }

  /**
   * Resuelve múltiples IDs de departamentos
   */
  static async resolveDepartmentIds(departmentIds: string[]): Promise<Record<string, string>> {
    if (departmentIds.length === 0) return {}
    
    try {
      const departments = await prisma.departments.findMany({
        where: { id: { in: departmentIds } },
        select: { id: true, name: true }
      })
      
      const result: Record<string, string> = {}
      departments.forEach(dept => {
        result[dept.id] = dept.name
      })
      return result
    } catch {
      return {}
    }
  }

  /**
   * Resuelve múltiples IDs de categorías
   */
  static async resolveCategoryIds(categoryIds: string[]): Promise<Record<string, string>> {
    if (categoryIds.length === 0) return {}
    
    try {
      const categories = await prisma.categories.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true }
      })
      
      const result: Record<string, string> = {}
      categories.forEach(cat => {
        result[cat.id] = cat.name
      })
      return result
    } catch {
      return {}
    }
  }

  /**
   * Resuelve múltiples IDs de tickets
   */
  static async resolveTicketIds(ticketIds: string[]): Promise<Record<string, string>> {
    if (ticketIds.length === 0) return {}
    
    try {
      const tickets = await prisma.tickets.findMany({
        where: { id: { in: ticketIds } },
        select: { id: true, title: true }
      })
      
      const result: Record<string, string> = {}
      tickets.forEach(ticket => {
        result[ticket.id] = `Ticket: ${ticket.title}`
      })
      return result
    } catch {
      return {}
    }
  }

  /**
   * Resuelve cualquier tipo de ID basado en el nombre del campo
   */
  static async resolveFieldValue(fieldName: string, value: any): Promise<string> {
    if (value === null || value === undefined) return 'vacío'
    
    // Si no es un string, retornar como está
    if (typeof value !== 'string') return String(value)
    
    // Si no parece un UUID, retornar como está
    if (!value.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return value
    }
    
    // Resolver según el tipo de campo
    const fieldLower = fieldName.toLowerCase()
    
    if (fieldLower.includes('user') || fieldLower.includes('createdby') || fieldLower.includes('assignee')) {
      return await this.resolveUserId(value)
    }
    
    if (fieldLower.includes('department')) {
      return await this.resolveDepartmentId(value)
    }
    
    if (fieldLower.includes('category')) {
      return await this.resolveCategoryId(value)
    }
    
    if (fieldLower.includes('ticket')) {
      return await this.resolveTicketId(value)
    }
    
    // Si no se puede resolver, retornar el UUID
    return value
  }

  /**
   * Traduce nombres de campos técnicos a nombres amigables
   */
  static getFieldDisplayName(fieldName: string): string {
    const fieldNames: Record<string, string> = {
      // Usuarios
      'name': 'Nombre',
      'email': 'Correo Electrónico',
      'role': 'Rol',
      'departmentId': 'Departamento',
      'phone': 'Teléfono',
      'isActive': 'Estado',
      'avatar': 'Avatar',
      'password': 'Contraseña',
      'createdById': 'Creado por',
      'assigneeId': 'Asignado a',
      
      // Tickets
      'ticketId': 'Ticket',
      'title': 'Título',
      'description': 'Descripción',
      'status': 'Estado',
      'priority': 'Prioridad',
      'categoryId': 'Categoría',
      'ticketNumber': 'Número de Ticket',
      
      // Departamentos
      'color': 'Color',
      
      // Categorías
      'parentId': 'Categoría Padre',
      'level': 'Nivel',
      'order': 'Orden',
      
      // Generales
      'createdAt': 'Fecha de Creación',
      'updatedAt': 'Última Actualización',
      'isEmailVerified': 'Email Verificado',
      'lastLogin': 'Último Acceso'
    }
    
    return fieldNames[fieldName] || fieldName
  }

  /**
   * Traduce valores de roles a nombres amigables
   */
  static getRoleDisplayName(role: string): string {
    const roleNames: Record<string, string> = {
      'ADMIN': 'Administrador',
      'TECHNICIAN': 'Técnico',
      'CLIENT': 'Cliente'
    }
    return roleNames[role] || role
  }

  /**
   * Traduce valores de estado a nombres amigables
   */
  static getStatusDisplayName(status: string): string {
    const statusNames: Record<string, string> = {
      'OPEN': 'Abierto',
      'IN_PROGRESS': 'En Progreso',
      'PENDING': 'Pendiente',
      'RESOLVED': 'Resuelto',
      'CLOSED': 'Cerrado',
      'CANCELLED': 'Cancelado'
    }
    return statusNames[status] || status
  }

  /**
   * Traduce valores de prioridad a nombres amigables
   */
  static getPriorityDisplayName(priority: string): string {
    const priorityNames: Record<string, string> = {
      'LOW': 'Baja',
      'MEDIUM': 'Media',
      'HIGH': 'Alta',
      'URGENT': 'Urgente'
    }
    return priorityNames[priority] || priority
  }

  /**
   * Traduce valores booleanos a nombres amigables
   */
  static getBooleanDisplayName(value: boolean): string {
    return value ? 'Activo' : 'Inactivo'
  }
}
