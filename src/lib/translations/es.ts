/**
 * Traducciones centralizadas al español
 * Sistema de tickets para Ecuador
 */

// Estados de tickets
export const TICKET_STATUS_ES: Record<string, string> = {
  'OPEN': 'ABIERTO',
  'IN_PROGRESS': 'EN PROGRESO',
  'PENDING': 'PENDIENTE',
  'RESOLVED': 'RESUELTO',
  'CLOSED': 'CERRADO',
  'CANCELLED': 'CANCELADO',
  'ON_HOLD': 'EN ESPERA',
}

// Prioridades
export const PRIORITY_ES: Record<string, string> = {
  'LOW': 'BAJA',
  'MEDIUM': 'MEDIA',
  'HIGH': 'ALTA',
  'URGENT': 'URGENTE',
}

// Estados de tareas
export const TASK_STATUS_ES: Record<string, string> = {
  'PENDING': 'PENDIENTE',
  'IN_PROGRESS': 'EN PROGRESO',
  'COMPLETED': 'COMPLETADA',
  'BLOCKED': 'BLOQUEADA',
  'CANCELLED': 'CANCELADA',
}

// Roles de usuario
export const USER_ROLE_ES: Record<string, string> = {
  'ADMIN': 'ADMINISTRADOR',
  'TECHNICIAN': 'TÉCNICO',
  'CLIENT': 'CLIENTE',
  'MANAGER': 'GERENTE',
}

// Estados de artículos de conocimiento
export const ARTICLE_STATUS_ES: Record<string, string> = {
  'DRAFT': 'BORRADOR',
  'PUBLISHED': 'PUBLICADO',
  'ARCHIVED': 'ARCHIVADO',
}

// Tipos de notificación
export const NOTIFICATION_TYPE_ES: Record<string, string> = {
  'INFO': 'INFORMACIÓN',
  'SUCCESS': 'ÉXITO',
  'WARNING': 'ADVERTENCIA',
  'CRITICAL': 'CRÍTICO',
  'ERROR': 'ERROR',
}

// Días de la semana
export const DAYS_ES: Record<string, string> = {
  'Monday': 'Lunes',
  'Tuesday': 'Martes',
  'Wednesday': 'Miércoles',
  'Thursday': 'Jueves',
  'Friday': 'Viernes',
  'Saturday': 'Sábado',
  'Sunday': 'Domingo',
}

// Meses
export const MONTHS_ES: Record<string, string> = {
  'January': 'Enero',
  'February': 'Febrero',
  'March': 'Marzo',
  'April': 'Abril',
  'May': 'Mayo',
  'June': 'Junio',
  'July': 'Julio',
  'August': 'Agosto',
  'September': 'Septiembre',
  'October': 'Octubre',
  'November': 'Noviembre',
  'December': 'Diciembre',
}

// Funciones de utilidad para traducción
export const translateTicketStatus = (status: string): string => {
  return TICKET_STATUS_ES[status] || status
}

export const translatePriority = (priority: string): string => {
  return PRIORITY_ES[priority] || priority
}

export const translateTaskStatus = (status: string): string => {
  return TASK_STATUS_ES[status] || status
}

export const translateUserRole = (role: string): string => {
  return USER_ROLE_ES[role] || role
}

export const translateArticleStatus = (status: string): string => {
  return ARTICLE_STATUS_ES[status] || status
}

export const translateNotificationType = (type: string): string => {
  return NOTIFICATION_TYPE_ES[type] || type
}

// Función para formatear fechas en español
export const formatDateES = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const day = d.getDate()
  const month = MONTHS_ES[d.toLocaleString('en-US', { month: 'long' })]
  const year = d.getFullYear()
  return `${day} de ${month} de ${year}`
}

// Función para formatear fecha y hora en español
export const formatDateTimeES = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const dateStr = formatDateES(d)
  const hours = d.getHours().toString().padStart(2, '0')
  const minutes = d.getMinutes().toString().padStart(2, '0')
  return `${dateStr} a las ${hours}:${minutes}`
}

// Función para tiempo relativo en español
export const formatRelativeTimeES = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)
  const months = Math.floor(days / 30)
  const years = Math.floor(days / 365)
  
  if (seconds < 60) return 'hace un momento'
  if (minutes < 60) return `hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`
  if (hours < 24) return `hace ${hours} hora${hours !== 1 ? 's' : ''}`
  if (days < 7) return `hace ${days} día${days !== 1 ? 's' : ''}`
  if (weeks < 4) return `hace ${weeks} semana${weeks !== 1 ? 's' : ''}`
  if (months < 12) return `hace ${months} mes${months !== 1 ? 'es' : ''}`
  return `hace ${years} año${years !== 1 ? 's' : ''}`
}

// Pluralización en español
export const pluralize = (count: number, singular: string, plural: string): string => {
  return count === 1 ? singular : plural
}

// Mensajes comunes del sistema
export const COMMON_MESSAGES_ES = {
  loading: 'Cargando...',
  error: 'Error',
  success: 'Éxito',
  confirm: 'Confirmar',
  cancel: 'Cancelar',
  save: 'Guardar',
  delete: 'Eliminar',
  edit: 'Editar',
  create: 'Crear',
  update: 'Actualizar',
  search: 'Buscar',
  filter: 'Filtrar',
  export: 'Exportar',
  import: 'Importar',
  refresh: 'Actualizar',
  close: 'Cerrar',
  back: 'Volver',
  next: 'Siguiente',
  previous: 'Anterior',
  submit: 'Enviar',
  reset: 'Restablecer',
  clear: 'Limpiar',
  apply: 'Aplicar',
  noData: 'No hay datos disponibles',
  noResults: 'No se encontraron resultados',
  selectAll: 'Seleccionar todo',
  deselectAll: 'Deseleccionar todo',
  actions: 'Acciones',
  details: 'Detalles',
  view: 'Ver',
  download: 'Descargar',
  upload: 'Subir',
  print: 'Imprimir',
  share: 'Compartir',
  copy: 'Copiar',
  paste: 'Pegar',
  cut: 'Cortar',
  undo: 'Deshacer',
  redo: 'Rehacer',
  yes: 'Sí',
  no: 'No',
  ok: 'Aceptar',
  required: 'Requerido',
  optional: 'Opcional',
  all: 'Todos',
  none: 'Ninguno',
  other: 'Otro',
  more: 'Más',
  less: 'Menos',
  show: 'Mostrar',
  hide: 'Ocultar',
  expand: 'Expandir',
  collapse: 'Contraer',
  select: 'Seleccionar',
  selected: 'Seleccionado',
  total: 'Total',
  subtotal: 'Subtotal',
  active: 'Activo',
  inactive: 'Inactivo',
  enabled: 'Habilitado',
  disabled: 'Deshabilitado',
  online: 'En línea',
  offline: 'Fuera de línea',
  available: 'Disponible',
  unavailable: 'No disponible',
  public: 'Público',
  private: 'Privado',
  draft: 'Borrador',
  published: 'Publicado',
  archived: 'Archivado',
  new: 'Nuevo',
  old: 'Antiguo',
  recent: 'Reciente',
  popular: 'Popular',
  featured: 'Destacado',
  recommended: 'Recomendado',
  favorite: 'Favorito',
  bookmark: 'Marcador',
  tag: 'Etiqueta',
  category: 'Categoría',
  department: 'Departamento',
  user: 'Usuario',
  admin: 'Administrador',
  technician: 'Técnico',
  client: 'Cliente',
  ticket: 'Ticket',
  article: 'Artículo',
  comment: 'Comentario',
  notification: 'Notificación',
  report: 'Reporte',
  dashboard: 'Panel',
  settings: 'Configuración',
  profile: 'Perfil',
  help: 'Ayuda',
  about: 'Acerca de',
  contact: 'Contacto',
  terms: 'Términos',
  privacy: 'Privacidad',
  logout: 'Cerrar sesión',
  login: 'Iniciar sesión',
  register: 'Registrarse',
  forgotPassword: 'Olvidé mi contraseña',
  resetPassword: 'Restablecer contraseña',
  changePassword: 'Cambiar contraseña',
  email: 'Correo electrónico',
  password: 'Contraseña',
  username: 'Nombre de usuario',
  name: 'Nombre',
  firstName: 'Nombre',
  lastName: 'Apellido',
  phone: 'Teléfono',
  address: 'Dirección',
  city: 'Ciudad',
  state: 'Estado',
  country: 'País',
  zipCode: 'Código postal',
  date: 'Fecha',
  time: 'Hora',
  dateTime: 'Fecha y hora',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',
  createdAt: 'Creado el',
  updatedAt: 'Actualizado el',
  deletedAt: 'Eliminado el',
  createdBy: 'Creado por',
  updatedBy: 'Actualizado por',
  deletedBy: 'Eliminado por',
  status: 'Estado',
  priority: 'Prioridad',
  type: 'Tipo',
  description: 'Descripción',
  title: 'Título',
  content: 'Contenido',
  message: 'Mensaje',
  subject: 'Asunto',
  body: 'Cuerpo',
  attachments: 'Archivos adjuntos',
  files: 'Archivos',
  images: 'Imágenes',
  videos: 'Videos',
  documents: 'Documentos',
  links: 'Enlaces',
  notes: 'Notas',
  tags: 'Etiquetas',
  categories: 'Categorías',
  departments: 'Departamentos',
  users: 'Usuarios',
  tickets: 'Tickets',
  articles: 'Artículos',
  comments: 'Comentarios',
  notifications: 'Notificaciones',
  reports: 'Reportes',
  statistics: 'Estadísticas',
  analytics: 'Analíticas',
  metrics: 'Métricas',
  performance: 'Rendimiento',
  quality: 'Calidad',
  satisfaction: 'Satisfacción',
  rating: 'Calificación',
  feedback: 'Retroalimentación',
  review: 'Revisión',
  approval: 'Aprobación',
  rejection: 'Rechazo',
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  completed: 'Completado',
  inProgress: 'En progreso',
  notStarted: 'No iniciado',
  onHold: 'En espera',
  cancelled: 'Cancelado',
  failed: 'Fallido',
  successful: 'Exitoso',
  warning: 'Advertencia',
  info: 'Información',
  critical: 'Crítico',
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}
