'use client'

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
      // Fail-open: si falla, mostrar todo para no bloquear al usuario
      setModules(DEFAULT)
    } finally {
      setLoading(false)
    }
  }, [status, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load()
  }, [load])

  // Recargar cuando el admin cambia configuración de módulos o asignaciones de familias
  useEffect(() => {
    const reload = () => load()
    window.addEventListener('settings-updated', reload)
    window.addEventListener('modules-updated', reload)
    // El SSE emite session_refresh cuando cambian permisos/asignaciones
    window.addEventListener('session_refresh', reload)
    return () => {
      window.removeEventListener('settings-updated', reload)
      window.removeEventListener('modules-updated', reload)
      window.removeEventListener('session_refresh', reload)
    }
  }, [load])

  return { ...modules, loading, reload: load }
}
