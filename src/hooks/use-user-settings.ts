'use client'

/**
 * Hook singleton para configuración del usuario.
 *
 * - Una sola llamada a /api/user/settings por sesión (store global a nivel de módulo)
 * - Todos los consumidores comparten el mismo estado
 * - Actualizar con updateSettings() propaga el cambio a todos los suscriptores
 *   y persiste en la BD automáticamente
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

export interface UserSettings {
  soundEnabled: boolean
  emailNotifications: boolean
  pushNotifications: boolean
  ticketUpdates: boolean
  systemAlerts: boolean
  weeklyReport: boolean
  ticketCreated: boolean
  ticketAssigned: boolean
  statusChanged: boolean
  newComments: boolean
  ticketUpdated: boolean
  quietHours: { enabled: boolean; startTime: string; endTime: string }
  autoAssignEnabled: boolean
  maxConcurrentTickets: number
  theme: string
  language: string
  timezone: string
}

const DEFAULTS: UserSettings = {
  soundEnabled: true,
  emailNotifications: true,
  pushNotifications: true,
  ticketUpdates: true,
  systemAlerts: true,
  weeklyReport: false,
  ticketCreated: true,
  ticketAssigned: true,
  statusChanged: true,
  newComments: true,
  ticketUpdated: true,
  quietHours: { enabled: false, startTime: '22:00', endTime: '08:00' },
  autoAssignEnabled: true,
  maxConcurrentTickets: 10,
  theme: 'light',
  language: 'es',
  timezone: 'America/Guayaquil',
}

// ── Store global ──────────────────────────────────────────────────────────────
type Listener = (s: UserSettings) => void
let store: UserSettings = { ...DEFAULTS }
let fetched = false
let fetching = false
const listeners = new Set<Listener>()

function notify() {
  listeners.forEach(fn => fn({ ...store }))
}

function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

async function loadSettings() {
  if (fetched || fetching) return
  fetching = true
  try {
    const res = await fetch('/api/user/settings')
    if (!res.ok) return
    const data = await res.json()
    if (!data?.settings) return
    const s = data.settings
    store = {
      soundEnabled: s.soundEnabled ?? DEFAULTS.soundEnabled,
      emailNotifications: s.emailNotifications ?? DEFAULTS.emailNotifications,
      pushNotifications: s.pushNotifications ?? DEFAULTS.pushNotifications,
      ticketUpdates: s.ticketUpdates ?? DEFAULTS.ticketUpdates,
      systemAlerts: s.systemAlerts ?? DEFAULTS.systemAlerts,
      weeklyReport: s.weeklyReport ?? DEFAULTS.weeklyReport,
      ticketCreated: s.ticketCreated ?? DEFAULTS.ticketCreated,
      ticketAssigned: s.ticketAssigned ?? DEFAULTS.ticketAssigned,
      statusChanged: s.statusChanged ?? DEFAULTS.statusChanged,
      newComments: s.newComments ?? DEFAULTS.newComments,
      ticketUpdated: s.ticketUpdated ?? DEFAULTS.ticketUpdated,
      quietHours: s.quietHours ?? DEFAULTS.quietHours,
      autoAssignEnabled: s.autoAssignEnabled ?? DEFAULTS.autoAssignEnabled,
      maxConcurrentTickets: s.maxConcurrentTickets ?? DEFAULTS.maxConcurrentTickets,
      theme: s.theme ?? DEFAULTS.theme,
      language: s.language ?? DEFAULTS.language,
      timezone: s.timezone ?? DEFAULTS.timezone,
    }
    fetched = true
    notify()
  } catch {
    // mantener defaults
  } finally {
    fetching = false
  }
}

/** Resetea el store al hacer logout (llamar desde signOut si es necesario) */
export function resetUserSettingsStore() {
  store = { ...DEFAULTS }
  fetched = false
  fetching = false
  notify()
}
// ─────────────────────────────────────────────────────────────────────────────

export function useUserSettings() {
  const { status } = useSession()
  const [settings, setSettings] = useState<UserSettings>({ ...store })

  // Suscribirse al store global
  useEffect(() => {
    const unsub = subscribe(setSettings)

    // Disparar carga si la sesión está activa y aún no se ha cargado
    if (status === 'authenticated' && !fetched) {
      loadSettings()
    }

    return () => { unsub() }
  }, [status])

  /** Actualiza settings localmente + persiste en la BD */
  const updateSettings = useCallback(async (partial: Partial<UserSettings>): Promise<boolean> => {
    // Optimistic update inmediato
    store = { ...store, ...partial }
    notify()

    try {
      // Aplanar quietHours para la API
      const payload: Record<string, unknown> = { ...partial }
      if (partial.quietHours) {
        payload.quietHoursEnabled = partial.quietHours.enabled
        payload.quietHoursStart = partial.quietHours.startTime
        payload.quietHoursEnd = partial.quietHours.endTime
        delete payload.quietHours
      }

      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        // Revertir en caso de error
        await loadSettings()
        return false
      }
      return true
    } catch {
      await loadSettings()
      return false
    }
  }, [])

  return { settings, updateSettings }
}
