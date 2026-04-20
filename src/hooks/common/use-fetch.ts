/**
 * Hook ligero para cargar datos desde una URL con loading, error y recarga.
 *
 * Cubre el patrón repetido en 20+ páginas:
 *   const [data, setData] = useState([])
 *   const [loading, setLoading] = useState(true)
 *   useEffect(() => { fetch(url).then(...) }, [deps])
 *
 * Para CRUD completo (create/update/delete) usa useModuleData.
 * Este hook es para lectura simple con filtros opcionales.
 *
 * @example — Básico
 *   const { data: suppliers, loading, reload } = useFetch('/api/inventory/suppliers')
 *
 * @example — Con parámetros reactivos
 *   const { data, loading } = useFetch('/api/inventory/maintenance', {
 *     params: { status: statusFilter, familyId },
 *     transform: (d) => d.records ?? d,
 *   })
 *
 * @example — Desactivado hasta que haya un ID
 *   const { data } = useFetch(`/api/tickets/${id}`, { enabled: !!id })
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type React from 'react'
import { useToast } from '@/hooks/use-toast'

export interface UseFetchOptions<T> {
  /** Parámetros de query string. Se serializan automáticamente. */
  params?: Record<string, string | number | boolean | undefined | null>
  /** Transforma la respuesta JSON antes de guardarla en state */
  transform?: (raw: any) => T[]
  /** Si false, no hace fetch. Útil para esperar un ID. Default: true */
  enabled?: boolean
  /** Muestra toast de error. Default: true */
  showErrorToast?: boolean
  /** Valor inicial mientras carga */
  initialData?: T[]
}

export interface UseFetchReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  reload: () => void
  setData: React.Dispatch<React.SetStateAction<T[]>>
}

export function useFetch<T = any>(
  url: string,
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const {
    params,
    transform,
    enabled = true,
    showErrorToast = true,
    initialData = [],
  } = options

  const { toast } = useToast()
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  // Serializar params a query string estable
  const queryString = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : ''

  const fullUrl = queryString ? `${url}?${queryString}` : url

  // Ref para evitar setState en componente desmontado
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const fetchData = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(fullUrl, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Error ${res.status}`)

      const raw = await res.json()

      // Extraer array de distintas estructuras de respuesta
      let items: T[]
      if (transform) {
        items = transform(raw)
      } else if (Array.isArray(raw)) {
        items = raw
      } else if (raw.data && Array.isArray(raw.data)) {
        items = raw.data
      } else if (raw.items && Array.isArray(raw.items)) {
        items = raw.items
      } else if (raw.records && Array.isArray(raw.records)) {
        items = raw.records
      } else {
        // Buscar el primer array en la respuesta
        const firstArray = Object.values(raw).find(Array.isArray) as T[] | undefined
        items = firstArray ?? []
      }

      if (mountedRef.current) setData(items)
    } catch (err: any) {
      const msg = err.message || 'Error al cargar datos'
      if (mountedRef.current) setError(msg)
      if (showErrorToast) {
        toast({ title: 'Error', description: msg, variant: 'destructive' })
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [fullUrl, enabled, showErrorToast, toast, transform])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, reload: fetchData, setData }
}
