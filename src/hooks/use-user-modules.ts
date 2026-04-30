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

const DEFAULT: UserModules = { tickets: false, inventory: false, families: [] }

export function useUserModules() {
  const { data: session, status } = useSession()
  const [modules, setModules] = useState<UserModules>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id

  const load = useCallback(
    async (bypassCache = false) => {
      if (status !== 'authenticated' || !userId) return
      try {
        const url = bypassCache ? `/api/user/modules?_t=${Date.now()}` : '/api/user/modules'
        const res = await fetch(url, {
          headers: bypassCache ? { 'Cache-Control': 'no-cache' } : {},
        })
        if (res.ok) {
          const data = await res.json()
          setModules(data)
        }
      } catch {
        setModules(DEFAULT)
      } finally {
        setLoading(false)
      }
    },
    [status, userId]
  )

  useEffect(() => {
    load()
  }, [load])

  // Recargar con bypass de cache cuando cambian permisos/módulos
  useEffect(() => {
    const reloadFresh = () => load(true) // bypass cache
    const reloadNormal = () => load(false)

    window.addEventListener('settings-updated', reloadNormal)
    window.addEventListener('modules-updated', reloadFresh) // bypass — cambio explícito de módulos
    window.addEventListener('session_refresh', reloadFresh) // bypass — cambio de permisos
    return () => {
      window.removeEventListener('settings-updated', reloadNormal)
      window.removeEventListener('modules-updated', reloadFresh)
      window.removeEventListener('session_refresh', reloadFresh)
    }
  }, [load])

  return { ...modules, loading, reload: load }
}
