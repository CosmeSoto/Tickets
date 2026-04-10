'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  canManageInventory?: boolean
  isSuperAdmin?: boolean
  department?: { id: string; name: string; color: string } | null
}

export interface UseUserListOptions {
  role?: string                  // 'ADMIN' | 'TECHNICIAN' | 'CLIENT' | undefined (todos)
  departmentId?: string          // filtrar por departamento
  familyId?: string              // filtrar técnicos por familia asignada
  canManageInventory?: boolean   // filtrar por permiso de gestión
  isActive?: boolean             // default: true
  limit?: number                 // default: 200
  search?: string                // búsqueda por nombre/email
  enabled?: boolean              // si false, no hace fetch (default: true)
}

export interface UseUserListResult {
  users: UserListItem[]
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Hook centralizado para cargar listas de usuarios con filtros consistentes.
 * Reemplaza los fetch('/api/users?...') dispersos por el codebase.
 */
export function useUserList(options: UseUserListOptions = {}): UseUserListResult {
  const {
    role,
    departmentId,
    familyId,
    canManageInventory,
    isActive = true,
    limit = 200,
    search,
    enabled = true,
  } = options

  const [users, setUsers] = useState<UserListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async () => {
    if (!enabled) return

    // Cancelar request anterior si existe
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (role) params.set('role', role)
      if (departmentId) params.set('departmentId', departmentId)
      if (familyId) params.set('familyId', familyId)
      if (canManageInventory !== undefined) params.set('canManageInventory', String(canManageInventory))
      params.set('isActive', String(isActive))
      params.set('limit', String(limit))
      if (search) params.set('search', search)

      const res = await fetch(`/api/users?${params}`, {
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error(`Error ${res.status}`)

      const data = await res.json()
      setUsers(data.data ?? data.users ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios')
    } finally {
      setLoading(false)
    }
  }, [role, departmentId, familyId, canManageInventory, isActive, limit, search, enabled])

  useEffect(() => {
    fetch_()
    return () => abortRef.current?.abort()
  }, [fetch_])

  return { users, loading, error, refetch: fetch_ }
}
