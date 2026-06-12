/**
 * Hook para gestionar la suscripción Web Push del usuario.
 *
 * Responsabilidades:
 * - Registrar el Service Worker de push (sw-push.js)
 * - Solicitar permiso de notificaciones al navegador
 * - Obtener la PushSubscription del pushManager
 * - Enviar la suscripción al backend para almacenarla
 * - Desuscribirse cuando el usuario desactiva notificaciones
 *
 * Se activa automáticamente cuando el usuario tiene pushNotifications=true
 * en sus configuraciones. No muestra prompts intrusivos.
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { useSession } from 'next-auth/react'

/**
 * Convierte la clave VAPID de base64url a Uint8Array
 * (requerido por pushManager.subscribe)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

interface UsePushSubscriptionOptions {
  /** Si push está habilitado en las preferencias del usuario */
  enabled?: boolean
}

export function usePushSubscription({ enabled = true }: UsePushSubscriptionOptions = {}) {
  const { data: session, status } = useSession()
  const [subscribed, setSubscribed] = useState(false)
  const [permissionState, setPermissionState] = useState<
    'granted' | 'denied' | 'default' | 'unsupported'
  >('default')
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)
  const subscribedRef = useRef(false)

  // Verificar soporte y estado del permiso
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPermissionState('unsupported')
      return
    }
    setPermissionState(Notification.permission as any)
  }, [])

  /**
   * Registra el Service Worker y suscribe al push.
   * Solo se ejecuta si: usuario autenticado + pushNotifications habilitado + permiso concedido.
   */
  const subscribe = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission !== 'granted') return
    if (subscribedRef.current) return

    try {
      // 1. Registrar Service Worker
      const registration = await navigator.serviceWorker.register('/sw-push.js', {
        scope: '/',
      })
      registrationRef.current = registration

      // Esperar a que esté activo
      await navigator.serviceWorker.ready

      // 2. Obtener VAPID public key del servidor
      const vapidRes = await fetch('/api/push/vapid-key')
      if (!vapidRes.ok) return
      const { publicKey } = await vapidRes.json()
      if (!publicKey) return

      // 3. Verificar si ya tiene suscripción activa
      let pushSubscription = await registration.pushManager.getSubscription()

      if (!pushSubscription) {
        // 4. Crear nueva suscripción
        pushSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true, // Obligatorio: solo push que muestre notificación
          applicationServerKey: urlBase64ToUint8Array(publicKey) as any,
        })
      }

      // 5. Enviar suscripción al backend
      const subJSON = pushSubscription.toJSON()
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: {
            endpoint: subJSON.endpoint,
            keys: {
              p256dh: subJSON.keys?.p256dh,
              auth: subJSON.keys?.auth,
            },
          },
        }),
      })

      subscribedRef.current = true
      setSubscribed(true)
    } catch (error) {
      console.error('[usePushSubscription] Error registrando push:', error)
    }
  }, [])

  /**
   * Desuscribirse del push (cuando el usuario desactiva notificaciones).
   */
  const unsubscribe = useCallback(async () => {
    if (!registrationRef.current) return

    try {
      const subscription = await registrationRef.current.pushManager.getSubscription()
      if (subscription) {
        // Eliminar del backend
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        // Eliminar del navegador
        await subscription.unsubscribe()
      }
      subscribedRef.current = false
      setSubscribed(false)
    } catch (error) {
      console.error('[usePushSubscription] Error desuscribiéndose:', error)
    }
  }, [])

  // Auto-suscribir cuando el usuario está autenticado y tiene permisos
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return
    if (!enabled) {
      // Si el usuario desactivó push, desuscribir
      if (subscribedRef.current) unsubscribe()
      return
    }
    if (permissionState !== 'granted') return

    subscribe()
  }, [status, session?.user?.id, enabled, permissionState, subscribe, unsubscribe])

  return {
    subscribed,
    permissionState,
    subscribe,
    unsubscribe,
  }
}
