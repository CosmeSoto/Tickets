'use client'

/**
 * FamiliesContext — Fuente única de verdad para las familias del sistema.
 *
 * Problema que resuelve:
 *   Antes: 19+ componentes llamaban /api/families o /api/inventory/families
 *   de forma independiente al montarse, generando N peticiones simultáneas
 *   que saturaban el rate limiter (429 Too Many Requests).
 *
 * Solución:
 *   Un solo fetch al montar el layout raíz. Todos los componentes leen
 *   del contexto sin hacer peticiones adicionales.
 *
 * Uso:
 *   const { families, inventoryFamilies, loading } = useFamilies()
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface FamilyItem {
  id: string
  name: string
  code: string
  color?: string | null
  icon?: string | null
  order?: number
  isActive?: boolean
  description?: string | null
}

interface FamiliesContextValue {
  /** Familias para tickets (filtradas por ticketsEnabled y allowedFromFamilies) */
  families: FamilyItem[]
  /** Familias para inventario (filtradas por rol y asignaciones) */
  inventoryFamilies: FamilyItem[]
  loading: boolean
  /** Fuerza recarga de ambos endpoints (usar solo tras mutaciones) */
  reload: () => void
}

const FamiliesContext = createContext<FamiliesContextValue>({
  families: [],
  inventoryFamilies: [],
  loading: true,
  reload: () => {},
})

export function FamiliesProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [families, setFamilies] = useState<FamilyItem[]>([])
  const [inventoryFamilies, setInventoryFamilies] = useState<FamilyItem[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  // Usuario para el que ya se cargó — session.update() (SessionTimeoutMonitor,
  // cada 2 min) hace parpadear `status` a 'loading' y de vuelta a 'authenticated'
  // sin que el usuario cambie; sin este guard ese parpadeo recreaba `load` y el
  // efecto de abajo repetía ambas peticiones cada vez.
  const loadedForUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const load = useCallback(
    async (force = false) => {
      if (status !== 'authenticated' || !session?.user) return
      const uid = session.user.id
      if (!force && loadedForUserIdRef.current === uid) return
      loadedForUserIdRef.current = uid
      setLoading(prev => (families.length === 0 ? true : prev))
      try {
        // Ambas peticiones en paralelo — una sola vez por sesión
        const [ticketRes, inventoryRes] = await Promise.allSettled([
          fetch('/api/families?includeInactive=false'),
          fetch('/api/inventory/families'),
        ])

        if (mountedRef.current) {
          if (ticketRes.status === 'fulfilled' && ticketRes.value.ok) {
            const json = await ticketRes.value.json()
            setFamilies(json.data ?? json.families ?? [])
          }
          if (inventoryRes.status === 'fulfilled' && inventoryRes.value.ok) {
            const json = await inventoryRes.value.json()
            setInventoryFamilies(json.families ?? json.data ?? [])
          }
        }
      } catch {
        // Silencioso — los componentes muestran estado vacío
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [status, session?.user?.id] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    load()
  }, [load])

  return (
    <FamiliesContext.Provider
      value={{ families, inventoryFamilies, loading, reload: () => load(true) }}
    >
      {children}
    </FamiliesContext.Provider>
  )
}

/** Hook para consumir el contexto de familias */
export function useFamilies() {
  return useContext(FamiliesContext)
}

/**
 * Alias para inventario — devuelve las familias filtradas por rol de inventario.
 * Reemplaza: useFetch('/api/inventory/families', { transform: d => d.families ?? [] })
 */
export function useInventoryFamilies() {
  const { inventoryFamilies, loading } = useContext(FamiliesContext)
  return { families: inventoryFamilies, loading }
}
