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

// ── Audio ─────────────────────────────────────────────────────────────────────
//
// Política de autoplay: el AudioContext SOLO se puede crear/reanudar
// sincrónicamente dentro del call stack de un gesto del usuario.
//
// Estrategia:
//  - audioCtx se crea la primera vez que el usuario hace click/keydown/touch
//  - Si llega una notificación antes del primer gesto → pendingTones++
//  - Al primer gesto → crear ctx + reproducir pendientes
//  - Después del primer gesto → reproducir directamente

let audioCtx: AudioContext | null = null
let pendingTones = 0

function playTone(ctx: AudioContext) {
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

function flushPending(ctx: AudioContext) {
  if (pendingTones <= 0) return
  const n = pendingTones
  pendingTones = 0
  // Reproducir solo 1 aunque haya varios encolados (evitar spam de sonidos)
  if (n > 0) playTone(ctx)
}

// Handler de gesto — se ejecuta sincrónicamente en el call stack del evento
function handleGesture(e: Event) {
  // Solo gestos reales del usuario (isTrusted = false en eventos sintéticos/programáticos)
  if (!e.isTrusted) return

  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return
    }
  }

  if (audioCtx.state === 'suspended') {
    // resume() dentro del call stack del gesto — permitido por el navegador
    audioCtx.resume().then(() => flushPending(audioCtx!)).catch(() => {
      // Si falla, resetear para intentar de nuevo en el próximo gesto
      audioCtx = null
    })
  } else if (audioCtx.state === 'running') {
    flushPending(audioCtx)
  }
}

// Registrar una sola vez al cargar el módulo (solo en browser)
if (typeof window !== 'undefined') {
  const EVENTS = ['click', 'keydown', 'touchstart', 'pointerdown'] as const
  EVENTS.forEach(evt =>
    window.addEventListener(evt, handleGesture as EventListener, { passive: true, capture: true })
  )
}

// NO crear AudioContext al cargar — Chrome bloquea AudioContext sin gesto del usuario.
// El contexto se crea en handleGesture() cuando el usuario interactúa por primera vez.

export function playNotificationSound() {
  // Solo intentar si ya hay un contexto creado por un gesto previo
  if (!audioCtx) {
    // Sin gesto previo → encolar para reproducir en el próximo gesto
    pendingTones++
    return
  }

  if (audioCtx.state === 'suspended') {
    pendingTones++
    audioCtx.resume().catch(() => {})
    return
  }

  playTone(audioCtx)
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
