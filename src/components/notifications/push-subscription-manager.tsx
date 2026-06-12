/**
 * PushSubscriptionManager — Componente invisible que gestiona la suscripción Web Push.
 *
 * Se monta en el layout principal. Automáticamente:
 * - Registra el Service Worker de push
 * - Suscribe al push si el usuario tiene pushNotifications habilitado
 * - Se desuscribe si el usuario desactiva pushNotifications
 *
 * No renderiza nada visible — solo ejecuta efectos.
 */

'use client'

import { usePushSubscription } from '@/hooks/use-push-subscription'
import { useUserSettings } from '@/hooks/use-user-settings'

export function PushSubscriptionManager() {
  const { settings } = useUserSettings()

  // El hook se encarga de todo: registrar SW, suscribir si tiene permiso, etc.
  usePushSubscription({
    enabled: settings.pushNotifications !== false, // default true
  })

  // No renderiza nada
  return null
}
