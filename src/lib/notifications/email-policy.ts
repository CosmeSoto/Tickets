/**
 * Política global de correos por módulo y prioridad.
 * Solo se envía lo operativo necesario; el resto es in-app o opt-in.
 *
 * Rondas / noticias / documentos / credenciales: in-app por defecto
 * (sin spam; listos para canal cuando se añadan eventos aquí).
 */

export type EmailModule =
  | 'tickets'
  | 'inventory'
  | 'system'
  | 'auth'
  | 'backups'
  | 'patrols'
  | 'content'
  | 'credentials'
  | 'processes'
  | 'access'

/** critical = seguridad/SMTP; important = operativo; optional = ruido / prefs finas */
export type EmailPriority = 'critical' | 'important' | 'optional'

export type NotificationEmailEvent =
  | 'ticketCreated'
  | 'ticketAssigned'
  | 'statusChanged'
  | 'newComments'
  | 'ticketUpdated'
  | 'inventoryAct'
  | 'inventoryAlert'
  | 'inventoryReport'
  | 'backupSuccess'
  | 'backupFailure'
  | 'digest'
  | 'security'
  | 'generic'
  | 'processReview'
  | 'processPublished'
  | 'processReviewDue'
  | 'accessPassIssued'
  | 'accessPassExpiring'

export const EMAIL_EVENT_PRIORITY: Record<NotificationEmailEvent, EmailPriority> = {
  security: 'critical',
  ticketCreated: 'important',
  ticketAssigned: 'important',
  statusChanged: 'important',
  inventoryAct: 'important',
  inventoryAlert: 'important',
  inventoryReport: 'important',
  backupFailure: 'important',
  backupSuccess: 'optional',
  newComments: 'optional',
  ticketUpdated: 'optional',
  digest: 'optional',
  generic: 'optional',
  processReview: 'important',
  processPublished: 'optional',
  processReviewDue: 'important',
  accessPassIssued: 'important',
  accessPassExpiring: 'important',
}

export function resolveEmailPriority(
  event: NotificationEmailEvent | undefined,
  explicit?: EmailPriority
): EmailPriority {
  if (explicit) return explicit
  if (event) return EMAIL_EVENT_PRIORITY[event]
  return 'optional'
}
