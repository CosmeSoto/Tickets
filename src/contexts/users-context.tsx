'use client'

/**
 * UsersContext — Fuente única de verdad para usuarios del sistema.
 *
 * Problema que resuelve:
 *   Múltiples componentes llamaban /api/users con diferentes filtros
 *   (role, isActive, canManageInventory) de forma independiente,
 *   generando peticiones redundantes.
 *
 * Solución:
 *   Un solo fetch al montar el layout raíz. Todos los componentes leen
 *   del contexto y filtran en memoria según necesiten.
 *
 * Uso:
 *   const { users, technicians, admins, managers, loading, reload } = useUsers()
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'

export interface UserItem {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
  isActive: boolean
  isSuperAdmin?: boolean
  canManageInventory?: boolean
  department?: string | null
  departmentId?: string | null
  phone?: string | null
  avatar?: string | null
  createdAt?: string
  updatedAt?: string
}

interface UsersContextValue {
  /** Todos los usuarios activos */
  users: UserItem[]
  /** Solo técnicos activos */
  technicians: UserItem[]
  /** Solo administradores activos (excluyendo super admins) */
  admins: UserItem[]
  /** Solo usuarios con canManageInventory=true */
  managers: UserItem[]
  /** Solo clientes activos */
  clients: UserItem[]
  loading: boolean
  /** Fuerza recarga (usar solo tras mutaciones) */
  reload: () => void
}

const UsersContext = createContext<UsersContextValue>({
  users: [],
  technicians: [],
  admins: [],
  managers: [],
  clients: [],
  loading: true,
  reload: () => {},
})

export function UsersProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [users, setUsers] = useState<UserItem[]>([])
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
      // Cargar todos los usuarios activos de una vez
      const res = await fetch('/api/users?isActive=true&limit=1000', { cache: 'no-store' })
      if (res.ok && mountedRef.current) {
        const data = await res.json()
        setUsers(data.data ?? [])
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

  // Filtros derivados en memoria (sin peticiones adicionales)
  const technicians = users.filter((u) => u.role === 'TECHNICIAN')
  const admins = users.filter((u) => u.role === 'ADMIN' && !u.isSuperAdmin)
  const managers = users.filter((u) => u.canManageInventory === true)
  const clients = users.filter((u) => u.role === 'CLIENT')

  return (
    <UsersContext.Provider
      value={{
        users,
        technicians,
        admins,
        managers,
        clients,
        loading,
        reload: load,
      }}
    >
      {children}
    </UsersContext.Provider>
  )
}

/** Hook para consumir el contexto de usuarios */
export function useUsers() {
  return useContext(UsersContext)
}

/**
 * Hooks especializados para casos comunes
 */

export function useTechnicians() {
  const { technicians, loading } = useContext(UsersContext)
  return { technicians, loading }
}

export function useAdmins() {
  const { admins, loading } = useContext(UsersContext)
  return { admins, loading }
}

export function useManagers() {
  const { managers, loading } = useContext(UsersContext)
  return { managers, loading }
}

export function useClients() {
  const { clients, loading } = useContext(UsersContext)
  return { clients, loading }
}
