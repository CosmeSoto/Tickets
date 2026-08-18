'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useFamilies } from '@/contexts/families-context'
import { ticketRequestFamiliesUrl } from '@/lib/utils/ticket-family'
import type { TicketSupportAreaFamily } from '@/components/tickets/ticket-support-area-field'

const CACHE_TTL_MS = 10 * 60 * 1000

function cacheStorageKey(forClientId?: string | null) {
  return `cache:ticket-request-families:${forClientId || 'self'}`
}

function mapApiFamilies(raw: unknown): TicketSupportAreaFamily[] {
  if (!Array.isArray(raw)) return []
  return raw.map((f: any) => ({
    id: f.id,
    name: f.name,
    code: f.code,
    color: f.color,
    isOwnFamily: f.isOwnFamily ?? false,
    isUserFamily: f.isOwnFamily ?? f.isUserFamily ?? false,
  }))
}

function readCachedFamilies(forClientId?: string | null): TicketSupportAreaFamily[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(cacheStorageKey(forClientId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { savedAt?: number; data?: TicketSupportAreaFamily[] }
    if (!parsed?.data?.length || typeof parsed.savedAt !== 'number') return []
    if (Date.now() - parsed.savedAt > CACHE_TTL_MS) {
      sessionStorage.removeItem(cacheStorageKey(forClientId))
      return []
    }
    return parsed.data
  } catch {
    return []
  }
}

function writeCachedFamilies(
  forClientId: string | null | undefined,
  data: TicketSupportAreaFamily[]
) {
  if (typeof window === 'undefined' || data.length === 0) return
  try {
    sessionStorage.setItem(
      cacheStorageKey(forClientId),
      JSON.stringify({ savedAt: Date.now(), data })
    )
  } catch {
    /* quota / private mode */
  }
}

/**
 * Carga familias para solicitar/crear tickets vía /api/families?asClient=true.
 * Usa sessionStorage + FamiliesProvider para no vaciar el selector al recargar o revalidar sesión.
 */
export function useTicketRequestFamilies(opts?: {
  forClientId?: string | null
  /** Si false, no fetch hasta que esté listo (p. ej. sin clientId). */
  enabled?: boolean
}) {
  const forClientId = opts?.forClientId ?? null
  const enabled = opts?.enabled !== false
  const { families: contextFamilies } = useFamilies()
  const contextRef = useRef(contextFamilies)
  contextRef.current = contextFamilies

  const [families, setFamilies] = useState<TicketSupportAreaFamily[]>(() =>
    enabled ? readCachedFamilies(forClientId) : []
  )
  const [loading, setLoading] = useState(
    () => enabled && readCachedFamilies(forClientId).length === 0
  )

  const load = useCallback(async () => {
    if (!enabled) {
      setFamilies([])
      setLoading(false)
      return
    }

    const cached = readCachedFamilies(forClientId)
    const preview = contextRef.current
    if (cached.length > 0) {
      setFamilies(cached)
      setLoading(false)
    } else if (!forClientId && preview.length > 0) {
      setFamilies(
        preview.map(f => ({
          id: f.id,
          name: f.name,
          code: f.code,
          color: f.color,
          isOwnFamily: false,
          isUserFamily: false,
        }))
      )
    } else {
      setLoading(true)
    }

    try {
      const res = await fetch(ticketRequestFamiliesUrl({ forClientId }))
      if (!res.ok) {
        if (cached.length === 0 && !forClientId && preview.length === 0) {
          setFamilies([])
        }
        return
      }
      const json = await res.json()
      const list = mapApiFamilies(json.data ?? json.families ?? [])
      setFamilies(list)
      writeCachedFamilies(forClientId, list)
    } catch {
      /* keep cache / preview */
    } finally {
      setLoading(false)
    }
  }, [enabled, forClientId])

  useEffect(() => {
    void load()
  }, [load])

  return { families, loading, reload: load }
}

/** Prefiere familia nativa; si no, la única disponible. */
export function pickDefaultTicketFamilyId(families: TicketSupportAreaFamily[]): string {
  if (families.length === 1) return families[0].id
  const native = families.find(f => f.isOwnFamily || f.isUserFamily)
  return native?.id ?? ''
}
