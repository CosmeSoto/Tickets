'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface SSENotification {
  id: string
  title: string
  message: string
  notificationType: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR'
  ticketId?: string | null
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any>
}

interface UseNotificationSSEOptions {
  onNotification?: (notification: SSENotification) => void
  sound?: boolean
}

// ── Audio singleton ────────────────────────────────────────────────────────────
// AudioContext se crea una sola vez. Si está suspendido (política autoplay del
// navegador), se intenta reanudar en cada reproducción — funciona siempre que
// el usuario haya interactuado con la página al menos una vez.

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return null
    }
  }
  return audioCtx
}

function playTone() {
  const ctx = getAudioContext()
  if (!ctx) return
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
  } catch { /* silencioso */ }
}

export function playNotificationSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().then(playTone).catch(() => {})
  } else {
    playTone()
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Conecta al stream SSE de notificaciones del usuario autenticado.
 * Llama onNotification inmediatamente cuando llega una nueva notificación.
 * Reproduce sonido si sound=true (default: true).
 * El sonido respeta la política de autoplay del navegador.
 */
export function useNotificationSSE({ onNotification, sound = true }: UseNotificationSSEOptions = {}) {
  const { data: session, status } = useSession()
  const onNotificationRef = useRef(onNotification)
  useEffect(() => { onNotificationRef.current = onNotification }, [onNotification])

  const soundEnabled = useRef(sound)
  useEffect(() => { soundEnabled.current = sound }, [sound])

  const connect = useCallback(() => {
    if (status !== 'authenticated' || !session?.user?.id) return

    let es: EventSource | null = null
    let retryTimeout: ReturnType<typeof setTimeout> | null = null
    let retries = 0

    const doConnect = () => {
      es = new EventSource('/api/notifications/stream')

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)

          // Forzar refresh de sesión cuando el admin cambia rol/permisos
          if (data.type === 'session_refresh') {
            window.location.reload()
            return
          }

          if (data.type === 'new_notification' && data.notification) {
            if (soundEnabled.current) playNotificationSound()
            onNotificationRef.current?.(data.notification)
            window.dispatchEvent(new CustomEvent('notification-received', {
              detail: data.notification,
            }))
          }
        } catch { /* ignorar mensajes malformados */ }
      }

      es.onerror = () => {
        es?.close()
        es = null
        const delay = Math.min(1000 * 2 ** retries, 30_000)
        retries++
        retryTimeout = setTimeout(doConnect, delay)
      }

      es.onopen = () => { retries = 0 }
    }

    doConnect()

    return () => {
      if (retryTimeout) clearTimeout(retryTimeout)
      es?.close()
    }
  }, [status, session?.user?.id])

  useEffect(() => {
    const cleanup = connect()
    return cleanup
  }, [connect])
}
