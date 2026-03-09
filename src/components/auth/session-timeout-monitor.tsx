'use client'

import { useEffect, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'

/**
 * Componente que monitorea el timeout de sesión y cierra automáticamente
 * cuando se excede el tiempo configurado
 */
export function SessionTimeoutMonitor() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const warningShownRef = useRef(false)
  const sessionTimeoutMinutes = useRef<number>(1440) // Default 24 horas

  // Obtener configuración de timeout desde el servidor
  const fetchSessionTimeout = useCallback(async () => {
    try {
      const response = await fetch('/api/config/session-timeout')
      if (response.ok) {
        const data = await response.json()
        if (data.sessionTimeout) {
          sessionTimeoutMinutes.current = data.sessionTimeout
        }
      }
    } catch (error) {
      console.error('[SESSION] Error obteniendo timeout:', error)
    }
  }, [])

  const handleAutoLogout = useCallback(async () => {
    toast({
      title: 'Sesión expirada',
      description: 'Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.',
      variant: 'destructive',
      duration: 5000,
    })

    // Esperar un momento para que el usuario vea el mensaje
    setTimeout(() => {
      signOut({ callbackUrl: '/login?reason=timeout' })
    }, 1000)
  }, [toast])

  // Mostrar advertencia antes de cerrar sesión
  const showWarning = useCallback(() => {
    if (warningShownRef.current) return
    
    warningShownRef.current = true
    
    toast({
      title: 'Sesión por expirar',
      description: `Tu sesión expirará en 10 minutos por inactividad. Realiza alguna acción para mantenerla activa.`,
      duration: 10000,
    })
  }, [toast])

  // Verificar si la sesión ha expirado
  const checkSessionTimeout = useCallback(() => {
    if (!session?.user) return

    const loginTime = (session as any).loginTime
    
    if (!loginTime) {
      // Si no hay loginTime, no hacer nada (sesión válida)
      return
    }

    const now = Date.now()
    const sessionDurationMs = now - loginTime
    const sessionDurationMinutes = sessionDurationMs / (1000 * 60)
    const timeoutMinutes = sessionTimeoutMinutes.current

    // Solo actuar si realmente ha pasado el tiempo de timeout
    if (sessionDurationMinutes >= timeoutMinutes) {
      handleAutoLogout()
      return
    }

    // Si faltan 10 minutos o menos, mostrar advertencia (cambiado de 5 a 10)
    const remainingMinutes = timeoutMinutes - sessionDurationMinutes
    if (remainingMinutes <= 10 && remainingMinutes > 0 && !warningShownRef.current) {
      showWarning()
    }

    // Programar siguiente verificación (cada 2 minutos en lugar de cada minuto)
    const checkInterval = 2 * 60 * 1000 // Verificar cada 2 minutos
    timeoutRef.current = setTimeout(checkSessionTimeout, checkInterval)
  }, [session, handleAutoLogout, showWarning])

  // Iniciar monitoreo cuando hay sesión activa
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Obtener configuración de timeout
      fetchSessionTimeout()

      // Iniciar verificación
      checkSessionTimeout()
    }

    // Limpiar al desmontar
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [status, session, fetchSessionTimeout, checkSessionTimeout])

  // Resetear advertencia cuando hay actividad
  useEffect(() => {
    const resetWarning = () => {
      warningShownRef.current = false
    }

    // Escuchar eventos de actividad del usuario
    window.addEventListener('click', resetWarning)
    window.addEventListener('keypress', resetWarning)
    window.addEventListener('scroll', resetWarning)
    window.addEventListener('mousemove', resetWarning)

    return () => {
      window.removeEventListener('click', resetWarning)
      window.removeEventListener('keypress', resetWarning)
      window.removeEventListener('scroll', resetWarning)
      window.removeEventListener('mousemove', resetWarning)
    }
  }, [])

  // Este componente no renderiza nada
  return null
}
