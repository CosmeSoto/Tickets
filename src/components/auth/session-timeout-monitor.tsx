'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

/**
 * Componente que monitorea el timeout de sesión y cierra automáticamente
 * cuando se excede el tiempo configurado SIN ACTIVIDAD
 */
export function SessionTimeoutMonitor() {
  const { data: session, status, update } = useSession()
  const { toast } = useToast()
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const warningTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const lastActivityRef = useRef<number>(Date.now())
  const lastJwtSyncRef = useRef<number>(0)
  const warningShownRef = useRef(false)
  const sessionTimeoutMinutes = useRef<number>(1440) // Default 24 horas
  const JWT_SYNC_THROTTLE_MS = 60_000

  // Cerrar sesión si el servidor marcó SessionExpired en el JWT
  useEffect(() => {
    if ((session as { error?: string } | null)?.error === 'SessionExpired') {
      void signOut({ redirect: false }).then(() => {
        window.location.href = '/login?reason=timeout'
      })
    }
  }, [session])

  // Obtener configuración de timeout desde el servidor
  const fetchSessionTimeout = useCallback(async () => {
    try {
      const response = await fetch('/api/config/session-timeout', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        if (data.sessionTimeout && data.sessionTimeout !== sessionTimeoutMinutes.current) {
          sessionTimeoutMinutes.current = data.sessionTimeout
          return true // Indica que cambió
        } else if (data.sessionTimeout) {
          sessionTimeoutMinutes.current = data.sessionTimeout
        }
      }
    } catch (error) {
      console.error('[SESSION] Error obteniendo timeout:', error)
    }
    return false
  }, [])

  const handleAutoLogout = useCallback(async () => {
    // Prevenir múltiples llamadas
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = undefined
    }

    toast({
      title: 'Sesión expirada',
      description: 'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
      variant: 'destructive',
      duration: 5000,
    })

    // Esperar un momento para que el usuario vea el mensaje
    setTimeout(() => {
      signOut({ redirect: false }).then(() => {
        window.location.href = '/login?reason=timeout'
      })
    }, 1000)
  }, [toast])

  // Mostrar advertencia 5 minutos antes de cerrar sesión
  const showWarning = useCallback(() => {
    if (warningShownRef.current) return

    warningShownRef.current = true

    toast({
      title: 'Sesión por expirar',
      description: `Tu sesión expirará en 5 minutos por inactividad. Realiza alguna acción para mantenerla activa.`,
      duration: 10000,
    })
  }, [toast])

  // Resetear el timer de inactividad
  const resetInactivityTimer = useCallback(() => {
    // Actualizar última actividad
    lastActivityRef.current = Date.now()

    // Sincronizar actividad con el JWT (como máximo 1× por minuto; el timer local sigue en cada actividad)
    if (status === 'authenticated') {
      const now = Date.now()
      if (now - lastJwtSyncRef.current >= JWT_SYNC_THROTTLE_MS) {
        lastJwtSyncRef.current = now
        void update({ lastActivityAt: now })
      }
    }

    // Resetear advertencia
    warningShownRef.current = false

    // Limpiar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = undefined
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = undefined
    }

    // Solo configurar timers si hay sesión activa
    if (status !== 'authenticated') return

    const timeoutMs = sessionTimeoutMinutes.current * 60 * 1000
    // Nunca programar un timeout menor a 1 minuto para evitar logouts accidentales
    if (timeoutMs < 60 * 1000) return

    const warningMs = timeoutMs - 5 * 60 * 1000 // 5 minutos antes

    // Programar advertencia (5 minutos antes del timeout)
    if (warningMs > 0) {
      warningTimeoutRef.current = setTimeout(() => {
        showWarning()
      }, warningMs)
    }

    // Programar cierre de sesión
    timeoutRef.current = setTimeout(() => {
      handleAutoLogout()
    }, timeoutMs)
  }, [status, handleAutoLogout, showWarning, update])

  // Iniciar monitoreo cuando hay sesión activa
  useEffect(() => {
    if (status === 'authenticated') {
      fetchSessionTimeout().then(() => {
        resetInactivityTimer()
      })

      // Re-verificar configuración cada 15 minutos — el caché del servidor es de 10 min
      // No tiene sentido verificar más seguido que el TTL del caché
      const configInterval = setInterval(
        async () => {
          const changed = await fetchSessionTimeout()
          if (changed) {
            resetInactivityTimer()
          }
        },
        15 * 60 * 1000
      )

      return () => {
        clearInterval(configInterval)
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current)
      }
    }

    // Limpiar al desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
    }
  }, [status, fetchSessionTimeout, resetInactivityTimer])

  // Detectar actividad del usuario y resetear timer
  useEffect(() => {
    if (status !== 'authenticated') return

    // Throttle para evitar demasiadas llamadas
    let lastResetTime = 0
    const THROTTLE_MS = 2000 // Throttle de 2 segundos (más flexible)

    const handleActivity = (e: Event) => {
      const now = Date.now()
      if (now - lastResetTime < THROTTLE_MS) return

      lastResetTime = now
      resetInactivityTimer()
    }

    // Re-leer configuración cuando el admin guarda settings
    const handleSettingsUpdated = () => {
      fetchSessionTimeout().then(changed => {
        if (changed) resetInactivityTimer()
      })
    }

    // Escuchar eventos de actividad del usuario
    window.addEventListener('click', handleActivity)
    window.addEventListener('keypress', handleActivity)
    window.addEventListener('scroll', handleActivity)
    window.addEventListener('mousemove', handleActivity)
    window.addEventListener('settings-updated', handleSettingsUpdated)

    return () => {
      window.removeEventListener('click', handleActivity)
      window.removeEventListener('keypress', handleActivity)
      window.removeEventListener('scroll', handleActivity)
      window.removeEventListener('mousemove', handleActivity)
      window.removeEventListener('settings-updated', handleSettingsUpdated)
    }
  }, [status, resetInactivityTimer, fetchSessionTimeout, update])

  // Este componente no renderiza nada
  return null
}
