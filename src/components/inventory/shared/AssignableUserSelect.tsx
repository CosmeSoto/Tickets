'use client'

/**
 * AssignableUserSelect — selector reutilizable de usuario asignable.
 *
 * Usado en:
 *   - EquipmentAssetForm (nuevo activo con estado ASSIGNED)
 *   - AssignmentDialog (asignar desde detalle)
 *   - EquipmentForm (editar activo con estado ASSIGNED)
 *
 * Comportamiento:
 *   - Carga usuarios desde /api/inventory/assignable-users?familyId=
 *   - Búsqueda en tiempo real con debounce
 *   - Al seleccionar usuario → auto-rellena departamento (solo lectura)
 *   - Muestra nombre, email y departamento en el dropdown
 */

import { useState, useEffect, useCallback } from 'react'
import { User, Building, X, Search, Loader2 } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export interface AssignableUser {
  id: string
  name: string
  email: string
  department: { id: string; name: string } | null
}

interface AssignableUserSelectProps {
  /** familyId del equipo — filtra los usuarios por familia */
  familyId?: string
  /** ID del usuario actualmente seleccionado */
  value: string
  /** Callback cuando cambia el usuario — devuelve id y datos del usuario */
  onChange: (userId: string, user: AssignableUser | null) => void
  disabled?: boolean
  label?: string
  required?: boolean
}

export function AssignableUserSelect({
  familyId,
  value,
  onChange,
  disabled = false,
  label = 'Asignar a',
  required = false,
}: AssignableUserSelectProps) {
  const [users, setUsers] = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null)

  // Cargar usuarios desde la API
  const loadUsers = useCallback(
    async (query: string) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (familyId) params.set('familyId', familyId)
        if (query.trim()) params.set('search', query.trim())
        const res = await fetch(`/api/inventory/assignable-users?${params}`)
        if (res.ok) {
          const data = await res.json()
          setUsers(data.users ?? [])
        }
      } finally {
        setLoading(false)
      }
    },
    [familyId]
  )

  // Carga inicial
  useEffect(() => {
    loadUsers('')
  }, [loadUsers])

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => loadUsers(search), 300)
    return () => clearTimeout(t)
  }, [search, loadUsers])

  // Si hay un value inicial (edición), buscar el usuario
  useEffect(() => {
    if (value && !selectedUser) {
      // Buscar en la lista ya cargada
      const found = users.find(u => u.id === value)
      if (found) {
        setSelectedUser(found)
        return
      }
      // Si no está en la lista, fetch individual
      fetch(`/api/users/${value}`)
        .then(r => (r.ok ? r.json() : null))
        .then(u => {
          if (u) {
            const user: AssignableUser = {
              id: u.id,
              name: u.name,
              email: u.email,
              department: u.departments ?? u.department ?? null,
            }
            setSelectedUser(user)
          }
        })
        .catch(() => {})
    }
    if (!value) {
      setSelectedUser(null)
    }
  }, [value, users]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelect = (user: AssignableUser) => {
    setSelectedUser(user)
    onChange(user.id, user)
    setSearch('')
    setShowDropdown(false)
  }

  const handleClear = () => {
    setSelectedUser(null)
    onChange('', null)
    setSearch('')
  }

  const filtered = search.trim()
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.department?.name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <div className='space-y-3'>
      {/* Selector de usuario */}
      <div className='space-y-1.5'>
        <Label>
          {label} {required && <span className='text-destructive'>*</span>}
        </Label>

        {selectedUser ? (
          /* Tarjeta del usuario seleccionado */
          <div className='flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5'>
            <div className='flex items-center gap-2.5 min-w-0'>
              <div className='h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                <User className='h-4 w-4 text-primary' />
              </div>
              <div className='min-w-0'>
                <p className='text-sm font-medium text-foreground truncate'>{selectedUser.name}</p>
                <p className='text-xs text-muted-foreground truncate'>{selectedUser.email}</p>
              </div>
            </div>
            {!disabled && (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='h-7 w-7 shrink-0'
                onClick={handleClear}
              >
                <X className='h-4 w-4' />
              </Button>
            )}
          </div>
        ) : (
          /* Campo de búsqueda */
          <div className='relative'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none' />
              <Input
                value={search}
                onChange={e => {
                  setSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder='Buscar por nombre, email o departamento...'
                className='pl-9'
                disabled={disabled}
              />
            </div>

            {showDropdown && !disabled && (
              <div className='absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-60 overflow-y-auto'>
                {loading ? (
                  <div className='flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    Buscando...
                  </div>
                ) : filtered.length === 0 ? (
                  <div className='py-4 text-center text-sm text-muted-foreground'>
                    No se encontraron usuarios
                  </div>
                ) : (
                  filtered.map(user => (
                    <button
                      key={user.id}
                      type='button'
                      className='w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent text-left transition-colors'
                      onClick={() => handleSelect(user)}
                    >
                      <div className='h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                        <User className='h-3.5 w-3.5 text-primary' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='text-sm font-medium text-foreground truncate'>{user.name}</p>
                        <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
                        {user.department && (
                          <p className='text-xs text-muted-foreground flex items-center gap-1'>
                            <Building className='h-3 w-3' />
                            {user.department.name}
                          </p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Departamento — auto-rellenado, solo lectura */}
      <div className='space-y-1.5'>
        <Label className='text-xs text-muted-foreground'>Departamento (del usuario asignado)</Label>
        <div className='flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground'>
          {selectedUser?.department ? (
            <>
              <Building className='h-3.5 w-3.5 shrink-0' />
              <span>{selectedUser.department.name}</span>
            </>
          ) : (
            <span className='italic'>Se completará al seleccionar un usuario</span>
          )}
        </div>
      </div>
    </div>
  )
}
