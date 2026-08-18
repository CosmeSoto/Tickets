'use client'

/**
 * Persistencia local de borradores de formularios extensos (sessionStorage).
 * Sobrevive a Escape, recarga o cierre accidental del modal/página en la misma pestaña.
 * No sube archivos ni secretos al servidor — solo cache local.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/hooks/common/use-debounce'

const DRAFT_VERSION = 1
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000

type StoredDraft<T> = {
  v: number
  savedAt: number
  data: T
}

function readDraft<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredDraft<T>
    if (!parsed || parsed.v !== DRAFT_VERSION || !parsed.data) {
      sessionStorage.removeItem(key)
      return null
    }
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      sessionStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* ignore */
    }
    return null
  }
}

function writeDraft<T>(key: string, data: T) {
  try {
    const blob: StoredDraft<T> = { v: DRAFT_VERSION, savedAt: Date.now(), data }
    sessionStorage.setItem(key, JSON.stringify(blob))
  } catch {
    /* quota / private mode */
  }
}

function hasMeaningfulContent(values: Record<string, unknown>): boolean {
  return Object.values(values).some(v => {
    if (v == null || v === false) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (typeof v === 'number') return true
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v as object).length > 0
    return Boolean(v)
  })
}

export function clearFormDraft(key: string) {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** Lectura sin side-effects (p.ej. decidir si cargar initial vs borrador). */
export function peekFormDraft<T>(key: string, maxAgeMs = DEFAULT_MAX_AGE_MS): T | null {
  return readDraft<T>(key, maxAgeMs)
}

export function useFormDraft<T extends Record<string, unknown>>(options: {
  /** Clave única p.ej. draft:license:new:{familyId} */
  key: string
  /** Snapshot serializable (sin File[]) */
  values: T
  enabled?: boolean
  debounceMs?: number
  maxAgeMs?: number
  /** Se llama una sola vez al montar si hay borrador válido */
  onRestore?: (data: T) => void
}) {
  const {
    key,
    values,
    enabled = true,
    debounceMs = 700,
    maxAgeMs = DEFAULT_MAX_AGE_MS,
    onRestore,
  } = options

  const [wasRestored, setWasRestored] = useState(false)
  const restoredRef = useRef(false)
  const skipSaveRef = useRef(false)
  const onRestoreRef = useRef(onRestore)
  onRestoreRef.current = onRestore

  const clearDraft = useCallback(() => {
    clearFormDraft(key)
    setWasRestored(false)
  }, [key])

  // Restaurar una sola vez por key
  useEffect(() => {
    restoredRef.current = false
    setWasRestored(false)
  }, [key])

  useEffect(() => {
    if (!enabled || restoredRef.current) return
    restoredRef.current = true
    const data = readDraft<T>(key, maxAgeMs)
    if (!data) return
    skipSaveRef.current = true
    onRestoreRef.current?.(data)
    setWasRestored(true)
  }, [key, enabled, maxAgeMs])

  const debouncedValues = useDebounce(values, debounceMs)

  useEffect(() => {
    if (!enabled) return
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    if (!hasMeaningfulContent(debouncedValues as Record<string, unknown>)) return
    writeDraft(key, debouncedValues)
  }, [debouncedValues, enabled, key])

  // Limpiar borrador tras un submit exitoso (submitting true → false sin error)
  return { clearDraft, wasRestored, dismissRestoredBanner: () => setWasRestored(false) }
}

/** Claves estándar de borrador para formularios de inventario. */
export const FormDraftKeys = {
  licenseNew: (familyId: string) => `draft:license:new:${familyId}`,
  licenseEdit: (id: string) => `draft:license:edit:${id}`,
  equipmentNew: (familyId: string) => `draft:equipment:new:${familyId}`,
  equipmentEdit: (id: string) => `draft:equipment:edit:${id}`,
  contractNew: () => `draft:contract:new`,
  contractEdit: (id: string) => `draft:contract:edit:${id}`,
  contractEmbed: (context: string, parentKey: string) =>
    `draft:contract:embed:${context}:${parentKey}`,
  supplierNew: (familyId?: string) => `draft:supplier:new:${familyId || 'global'}`,
  supplierEdit: (id: string) => `draft:supplier:edit:${id}`,
  processNew: () => `draft:process:new`,
  ticketNew: (userId?: string) => `draft:ticket:new:${userId || 'pending'}`,
  ticketComment: (ticketId: string) => `draft:ticket:comment:${ticketId}`,
  ticketPlan: (ticketId: string) => `draft:ticket:plan:${ticketId}`,
  ticketPlanTask: (ticketId: string) => `draft:ticket:plan-task:${ticketId}`,
} as const
