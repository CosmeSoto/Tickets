'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

interface UserModules {
  tickets: boolean
  inventory: boolean
  patrols: boolean
  news: boolean
  forms: boolean
  credentials: boolean
  canRequestAssets: boolean
  canManageInventory: boolean
  canManageNews: boolean
  canManageForms: boolean
  canManageCredentials: boolean
  families: Array<{
    id: string
    name: string
    code: string
    color?: string | null
    modules: {
      tickets: boolean
      inventory: boolean
      patrols: boolean
      news: boolean
      forms: boolean
      credentials: boolean
    }
  }>
}

const DEFAULT: UserModules = {
  tickets: false,
  inventory: false,
  patrols: false,
  news: false,
  forms: false,
  credentials: false,
  canRequestAssets: false,
  canManageInventory: false,
  canManageNews: false,
  canManageForms: false,
  canManageCredentials: false,
  families: [],
}

/** Caché en memoria: evita repetir GET /api/user/modules en cada remontaje. */
const MODULES_MEMORY_TTL_MS = 30_000 // 30 segundos (reducido de 120s para detectar cambios más rápido)

type ModulesMemoryEntry = { userId: string; data: UserModules; at: number }
let modulesMemoryCache: ModulesMemoryEntry | null = null

export function useUserModules() {
  const { data: session, status } = useSession()
  const [modules, setModules] = useState<UserModules>(DEFAULT)
  const [loading, setLoading] = useState(true)
  const userId = session?.user?.id
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(
    async (bypassCache = false) => {
      if (status === 'unauthenticated') {
        modulesMemoryCache = null
        setModules(DEFAULT)
        setLoading(false)
        return
      }
      if (status !== 'authenticated' || !userId) {
        return
      }

      const now = Date.now()

      // Si la URL tiene _refresh, forzar bypass de cache siempre
      const hasRefreshParam =
        typeof window !== 'undefined' && new URL(window.location.href).searchParams.has('_refresh')
      const shouldBypass = bypassCache || hasRefreshParam

      const memHit =
        !shouldBypass &&
        modulesMemoryCache &&
        modulesMemoryCache.userId === userId &&
        now - modulesMemoryCache.at < MODULES_MEMORY_TTL_MS

      if (memHit) {
        setModules(modulesMemoryCache!.data)
        setLoading(false)
        return
      }

      try {
        const url = shouldBypass ? `/api/user/modules?_t=${Date.now()}` : '/api/user/modules'
        const res = await fetch(url, {
          headers: shouldBypass ? { 'Cache-Control': 'no-cache' } : {},
        })
        if (res.ok) {
          const data = await res.json()
          setModules(data)
          modulesMemoryCache = { userId, data, at: Date.now() }
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

  // Polling cada 30s como fallback si el SSE no entrega el evento
  useEffect(() => {
    if (status !== 'authenticated' || !userId) return

    pollRef.current = setInterval(() => {
      // Solo recargar si el cache expiró (evita requests innecesarios)
      const now = Date.now()
      const expired =
        !modulesMemoryCache ||
        modulesMemoryCache.userId !== userId ||
        now - modulesMemoryCache.at >= MODULES_MEMORY_TTL_MS

      if (expired) {
        load(false)
      }
    }, MODULES_MEMORY_TTL_MS)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [status, userId, load])

  // Recargar con bypass de cache cuando cambian permisos/módulos
  useEffect(() => {
    const reloadFresh = () => {
      modulesMemoryCache = null
      load(true)
    }
    const reloadNormal = () => {
      modulesMemoryCache = null
      load(false)
    }

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
