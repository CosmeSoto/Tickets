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
// Los navegadores bloquean AudioContext hasta que haya un gesto del usuario.
// Mantenemos un contexto singleton y lo desbloqueamos en el primer click/tecla.

let audioCtx: AudioContext | null = null
let audioUnlocked = false
let pendingSounds = 0 // sonidos encolados antes del primer gesto

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

function unlockAudio() {
  if (audioUnlocked) return
  const ctx = getAudioContext()
  if (!ctx) return

  // Reanudar el contexto suspendido
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      audioUnlocked = true
      // Reproducir los sonidos que estaban pendientes
      for (let i = 0; i < pendingSounds; i++) playTone()
      pendingSounds = 0
    }).catch(() => {})
  } else {
    audioUnlocked = true
  }
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

function playNotificationSound() {
  if (!audioUnlocked) {
    // Encolar — se reproducirá cuando el usuario interactúe
    pendingSounds++
    return
  }
  const ctx = getAudioContext()
  if (!ctx) return
  if (ctx.state === 'suspended') {
    ctx.resume().then(playTone).catch(() => {})
  } else {
    playTone()
  }
}

// Desbloquear en el primer gesto del usuario (una sola vez)
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudio()
    window.removeEventListener('click', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
  }
  window.addEventListener('click', unlock, { once: true })
  window.addEventListener('keydown', unlock, { once: true })
  window.addEventListener('touchstart', unlock, { once: true })
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
