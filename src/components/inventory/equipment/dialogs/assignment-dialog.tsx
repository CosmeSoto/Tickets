'use client'

/**
 * AssignmentDialog — asigna un equipo a un usuario.
 *
 * Usa /api/inventory/assignable-users?familyId= para mostrar solo
 * los usuarios válidos para la familia del equipo, igual que el
 * formulario de creación (EquipmentAssetForm).
 * Muestra el departamento del usuario seleccionado en tiempo real.
 */

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Search, User, X, Building } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AssignmentForm } from '../utils/equipment-types'

interface AssignableUser {
  id: string
  name: string
  email: string
  department: { id: string; name: string } | null
}

interface AssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentCode: string
  /** familyId del equipo — filtra los usuarios asignables */
  familyId?: string
  form: AssignmentForm
  onFormChange: (form: AssignmentForm) => void
  onSubmit: () => void
  submitting: boolean
  accessories: string[]
}

export function AssignmentDialog({
  open,
  onOpenChange,
  equipmentCode,
  familyId,
  form,
  onFormChange,
  onSubmit,
  submitting,
}: AssignmentDialogProps) {
  const [users, setUsers] = useState<AssignableUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AssignableUser | null>(null)

  // Cargar usuarios asignables filtrados por familia
  const loadUsers = useCallback(
    async (query: string) => {
      setLoadingUsers(true)
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
        setLoadingUsers(false)
      }
    },
    [familyId]
  )

  // Cargar al abrir el dialog
  useEffect(() => {
    if (open) {
      loadUsers('')
      // Si ya hay un usuario seleccionado en el form, recuperarlo
      if (form.receiverId && !selectedUser) {
        // Buscar en la lista o hacer fetch individual
        fetch(`/api/users/${form.receiverId}`)
          .then(r => (r.ok ? r.json() : null))
          .then(u => {
            if (u)
              setSelectedUser({
                id: u.id,
                name: u.name,
                email: u.email,
                department: u.departments ?? u.department ?? null,
              })
          })
          .catch(() => {})
      }
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce búsqueda
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => loadUsers(search), 300)
    return () => clearTimeout(t)
  }, [search, open, loadUsers])

  // Limpiar al cerrar
  useEffect(() => {
    if (!open) {
      setSearch('')
      setShowDropdown(false)
      setSelectedUser(null)
    }
  }, [open])

  const handleSelectUser = (user: AssignableUser) => {
    setSelectedUser(user)
    onFormChange({ ...form, receiverId: user.id })
    setSearch('')
    setShowDropdown(false)
  }

  const handleClearUser = () => {
    setSelectedUser(null)
    onFormChange({ ...form, receiverId: '' })
    setSearch('')
  }

  const filteredUsers = search.trim()
    ? users.filter(
        u =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.department?.name ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : users

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Asignar Equipo</DialogTitle>
          <DialogDescription>
            Asigna el equipo <span className='font-semibold'>{equipmentCode}</span> a un usuario.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4 py-2'>
          {/* Selector de usuario con búsqueda */}
          <div className='space-y-2'>
            <Label>
              Usuario <span className='text-destructive'>*</span>
            </Label>

            {selectedUser ? (
              /* Usuario seleccionado — mostrar tarjeta con departamento */
              <div className='flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2.5'>
                <div className='flex items-center gap-2.5 min-w-0'>
                  <div className='h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                    <User className='h-4 w-4 text-primary' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-foreground truncate'>
                      {selectedUser.name}
                    </p>
                    <p className='text-xs text-muted-foreground truncate'>{selectedUser.email}</p>
                    {selectedUser.department && (
                      <p className='text-xs text-muted-foreground flex items-center gap-1 mt-0.5'>
                        <Building className='h-3 w-3' />
                        {selectedUser.department.name}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='h-7 w-7 shrink-0'
                  onClick={handleClearUser}
                >
                  <X className='h-4 w-4' />
                </Button>
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
                  />
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && (
                  <div className='absolute z-50 w-full mt-1 rounded-md border border-border bg-popover shadow-md max-h-56 overflow-y-auto'>
                    {loadingUsers ? (
                      <div className='flex items-center justify-center py-4 text-sm text-muted-foreground gap-2'>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        Buscando...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className='py-4 text-center text-sm text-muted-foreground'>
                        No se encontraron usuarios
                      </div>
                    ) : (
                      filteredUsers.map(user => (
                        <button
                          key={user.id}
                          type='button'
                          className='w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-accent text-left transition-colors'
                          onClick={() => handleSelectUser(user)}
                        >
                          <div className='h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0'>
                            <User className='h-3.5 w-3.5 text-primary' />
                          </div>
                          <div className='min-w-0 flex-1'>
                            <p className='text-sm font-medium text-foreground truncate'>
                              {user.name}
                            </p>
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

          {/* Tipo de asignación */}
          <div className='space-y-2'>
            <Label>
              Tipo de Asignación <span className='text-destructive'>*</span>
            </Label>
            <Select
              value={form.assignmentType}
              onValueChange={v => onFormChange({ ...form, assignmentType: v as any })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='PERMANENT'>Permanente</SelectItem>
                <SelectItem value='TEMPORARY'>Temporal</SelectItem>
                <SelectItem value='LOAN'>Préstamo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fecha de inicio */}
          <div className='space-y-2'>
            <Label>
              Fecha de Inicio <span className='text-destructive'>*</span>
            </Label>
            <Input
              type='date'
              value={form.startDate}
              onChange={e => onFormChange({ ...form, startDate: e.target.value })}
            />
          </div>

          {/* Fecha de fin — solo para temporal y préstamo */}
          {(form.assignmentType === 'TEMPORARY' || form.assignmentType === 'LOAN') && (
            <div className='space-y-2'>
              <Label>
                Fecha de Fin <span className='text-destructive'>*</span>
              </Label>
              <Input
                type='date'
                value={form.endDate}
                onChange={e => onFormChange({ ...form, endDate: e.target.value })}
              />
            </div>
          )}

          {/* Observaciones */}
          <div className='space-y-2'>
            <Label>Observaciones</Label>
            <Textarea
              value={form.observations}
              onChange={e => onFormChange({ ...form, observations: e.target.value })}
              placeholder='Observaciones adicionales...'
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={onSubmit} disabled={submitting || !form.receiverId}>
            {submitting && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
