'use client'

import { useCallback, useEffect, useState } from 'react'
import { ticketRequestFamiliesUrl } from '@/lib/utils/ticket-family'
import type { TicketSupportAreaFamily } from '@/components/tickets/ticket-support-area-field'

/**
 * Carga familias para solicitar/crear tickets vía /api/families?asClient=true.
 * Unifica admin create/edit, create-ticket-form (client/tech).
 */
export function useTicketRequestFamilies(opts?: {
  forClientId?: string | null
  /** Si false, no fetch hasta que esté listo (p. ej. sin clientId). */
  enabled?: boolean
}) {
  const forClientId = opts?.forClientId ?? null
  const enabled = opts?.enabled !== false

  const [families, setFamilies] = useState<TicketSupportAreaFamily[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!enabled) {
      setFamilies([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(ticketRequestFamiliesUrl({ forClientId }))
      if (!res.ok) {
        setFamilies([])
        return
      }
      const json = await res.json()
      const list: TicketSupportAreaFamily[] = (json.data ?? []).map((f: any) => ({
        id: f.id,
        name: f.name,
        code: f.code,
        color: f.color,
        isOwnFamily: f.isOwnFamily ?? false,
        isUserFamily: f.isOwnFamily ?? false,
      }))
      setFamilies(list)
    } catch {
      setFamilies([])
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
