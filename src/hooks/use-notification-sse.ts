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

// ── Audio — política de autoplay del navegador ────────────────────────────────
//
// Los navegadores bloquean AudioContext hasta que el usuario interactúa con la
// página (click, tecla, touch). La estrategia correcta es:
//
//  1. NO crear AudioContext al cargar el módulo.
//  2. Crearlo dentro del primer gesto del usuario (handler de click/keydown).
//  3. Si llega una notificación antes del primer gesto, encolar el sonido.
//  4. Al primer gesto, reproducir los sonidos encolados.
//
// Esto garantiza que el contexto siempre se crea en un contexto de gesto activo
// y nunca queda en estado "suspended" sin posibilidad de reanudarse.

let audioCtx: AudioContext | null = null
let gestureReceived = false
let pendingTones = 0

function createOrGetContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioCtx) return audioCtx
  try {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    return audioCtx
  } catch {
    return null
  }
}

function playToneNow(ctx: AudioContext) {
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

// Llamado en cada gesto del usuario — crea/reanuda el contexto y vacía la cola
function onUserGesture() {
  gestureReceived = true
  const ctx = createOrGetContext()
  if (!ctx) return

  const resume = () => {
    if (pendingTones > 0) {
      const count = pendingTones
      pendingTones = 0
      for (let i = 0; i < count; i++) playToneNow(ctx)
    }
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(resume).catch(() => {})
  } else {
    resume()
  }
}

// Registrar listeners de gesto una sola vez (nivel de módulo, solo en browser)
if (typeof window !== 'undefined') {
  const GESTURE_EVENTS = ['click', 'keydown', 'touchstart', 'pointerdown'] as const
  const handler = () => onUserGesture()
  GESTURE_EVENTS.forEach(evt =>
    window.addEventListener(evt, handler, { passive: true, capture: true })
  )
}

export function playNotificationSound() {
  if (!gestureReceived) {
    // Aún no hubo gesto — encolar para reproducir en el próximo
    pendingTones++
    return
  }

  const ctx = createOrGetContext()
  if (!ctx) return

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => playToneNow(ctx)).catch(() => {})
  } else {
    playToneNow(ctx)
  }
}
// ─────────────────────────────────────────────────────────────────────────────

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
