'use client'

/**
 * Hook que carga los módulos activos del usuario según sus familias asignadas.
 * Alimenta la navegación lateral para mostrar/ocultar secciones dinámicamente.
 *
 * Uso:
 *   const { tickets, inventory, loading } = useUserModules()
 *   // tickets=true → el usuario tiene al menos una familia con tickets habilitado
 *   // inventory=true → el usuario tiene al menos una familia con inventario habilitado
 */

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface UserModules {
  tickets: boolean
  inventory: boolean
  families: Array<{
    id: string
    name: string
    code: string
    color?: string | null
    modules: { tickets: boolean; inventory: boolean }
  }>
}

const DEFAULT: UserModules = { tickets: true, inventory: true, families: [] }

export function useUserModules() {
  const { data: session, status } = useSession()
  const [modules, setModules] = useState<UserModules>(DEFAULT)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user) return
    try {
      const res = await fetch('/api/user/modules')
      if (res.ok) {
        const data = await res.json()
        setModules(data)
      }
    } catch {
      // Fallback: mostrar todo (fail-open para no bloquear al usuario)
      setModules(DEFAULT)
    } finally {
      setLoading(false)
    }
  }, [status, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  return { ...modules, loading, reload: load }
}
