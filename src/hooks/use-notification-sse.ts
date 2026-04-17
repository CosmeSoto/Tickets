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
  if (n > 0) playTone(ctx)
}

// Handler de gesto — se ejecuta sincrónicamente en el call stack del evento
function handleGesture(e: Event) {
  if (!e.isTrusted) return

  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch {
      return
    }
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => flushPending(audioCtx!)).catch(() => {
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

export function playNotificationSound() {
  if (!audioCtx) {
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

// ── Vibración (móvil) ─────────────────────────────────────────────────────────
// Patrón: vibrar 100ms, pausa 50ms, vibrar 100ms — discreto y reconocible
function vibrateDevice() {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([100, 50, 100])
    }
  } catch { /* silencioso — algunos navegadores bloquean vibrate */ }
}

// ── Notificación nativa del navegador ────────────────────────────────────────
// Funciona cuando la app está en segundo plano o la pantalla bloqueada.
// Requiere permiso del usuario (se solicita de forma no intrusiva).
function showBrowserNotification(notification: SSENotification) {
  if (typeof window === 'undefined') return
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    const n = new Notification(notification.title, {
      body: notification.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: notification.id,          // evita duplicados si llega dos veces
      renotify: false,
      silent: true,                  // el sonido lo maneja AudioContext, no el SO
    })

    // Al hacer clic en la notificación nativa → enfocar la pestaña
    n.onclick = () => {
      window.focus()
      n.close()
    }

    // Auto-cerrar después de 8 segundos
    setTimeout(() => n.close(), 8000)
  } catch { /* silencioso */ }
}

/**
 * Solicita permiso de notificaciones del navegador de forma no intrusiva.
 * Solo se llama después de una interacción del usuario (no al cargar la página).
 * Retorna true si el permiso fue concedido.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false

  try {
    const result = await Notification.requestPermission()
    return result === 'granted'
  } catch {
    return false
  }
}

/** Estado actual del permiso de notificaciones */
export function getNotificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported'
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
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
            // 1. Sonido (si está habilitado en configuración)
            if (soundEnabled.current) playNotificationSound()

            // 2. Vibración en móvil (siempre, independiente del sonido)
            vibrateDevice()

            // 3. Notificación nativa del navegador (cuando app en segundo plano)
            showBrowserNotification(data.notification)

            // 4. Callback para actualizar la UI
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
