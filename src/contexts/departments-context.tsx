'use client'

/**
 * DepartmentsContext — Fuente única de verdad para departamentos del sistema.
 *
 * Problema que resuelve:
 *   Múltiples componentes llamaban /api/departments de forma independiente
 *   al montarse, generando peticiones redundantes.
 *
 * Solución:
 *   Un solo fetch al montar el layout raíz. Todos los componentes leen
 *   del contexto sin hacer peticiones adicionales.
 *
 * Uso:
 *   const { departments, activeDepartments, loading, reload } = useDepartments()
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface DepartmentItem {
  id: string
  name: string
  code?: string | null
  description?: string | null
  color?: string | null
  isActive: boolean
  familyId?: string | null
  createdAt?: string
  updatedAt?: string
  _count?: {
    users?: number
  }
}

interface DepartmentsContextValue {
  /** Todos los departamentos */
  departments: DepartmentItem[]
  /** Solo departamentos activos */
  activeDepartments: DepartmentItem[]
  loading: boolean
  /** Fuerza recarga (usar solo tras mutaciones) */
  reload: () => void
}

const DepartmentsContext = createContext<DepartmentsContextValue>({
  departments: [],
  activeDepartments: [],
  loading: true,
  reload: () => {},
})

export function DepartmentsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [departments, setDepartments] = useState<DepartmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) return
    setLoading(true)
    try {
      const res = await fetch('/api/departments', { cache: 'no-store' })
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setDepartments(data.departments ?? data.data ?? [])
      }
    } catch {
      // Silencioso — los componentes muestran estado vacío
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [status, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  // Filtro derivado en memoria
  const activeDepartments = departments.filter((d) => d.isActive)

  return (
    <DepartmentsContext.Provider
      value={{
        departments,
        activeDepartments,
        loading,
        reload: load,
      }}
    >
      {children}
    </DepartmentsContext.Provider>
  )
}

/** Hook para consumir el contexto de departamentos */
export function useDepartments() {
  return useContext(DepartmentsContext)
}

/**
 * Hook especializado para obtener solo departamentos activos
 */
export function useActiveDepartments() {
  const { activeDepartments, loading } = useContext(DepartmentsContext)
  return { departments: activeDepartments, loading }
}
