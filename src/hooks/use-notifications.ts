/**
 * Re-export del provider único de notificaciones.
 * Campana, dashboard e inbox comparten un solo fetch + SSE.
 */
export {
  useNotifications,
  useNotificationsContext,
  type NotificationData,
} from '@/contexts/notifications-context'
