'use client'

import { useState, useMemo } from 'react'
import { X, Search, Users, Building2, Shield, UserCheck, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FamilyOption {
  id: string
  name: string
  color?: string | null
  departments: { id: string; name: string }[]
}

interface UserOption {
  id: string
  name: string
  email: string
}

interface VisibilitySelectorProps {
  families: FamilyOption[]
  users: UserOption[]
  selectedRoles: string[]
  selectedFamilyIds: string[]
  selectedDepartmentIds: string[]
  selectedUserIds: string[]
  onRolesChange: (roles: string[]) => void
  onFamilyIdsChange: (ids: string[]) => void
  onDepartmentIdsChange: (ids: string[]) => void
  onUserIdsChange: (ids: string[]) => void
  /** Texto descriptivo debajo del campo de búsqueda de usuarios */
  usersHint?: string
  /** Roles que el creador puede seleccionar (por defecto todos) */
  allowedRoles?: string[]
  /**
   * Si true, vacío no significa “toda la organización” sino
   * “tu alcance / tu familia” (CLIENT / gestores acotados).
   */
  requireFamilyRestriction?: boolean
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administradores', short: 'Admins' },
  { value: 'TECHNICIAN', label: 'Técnicos', short: 'Técnicos' },
  { value: 'CLIENT', label: 'Clientes', short: 'Clientes' },
]

export function VisibilitySelector({
  families,
  users,
  selectedRoles,
  selectedFamilyIds,
  selectedDepartmentIds,
  selectedUserIds,
  onRolesChange,
  onFamilyIdsChange,
  onDepartmentIdsChange,
  onUserIdsChange,
  usersHint,
  allowedRoles,
  requireFamilyRestriction = false,
}: VisibilitySelectorProps) {
  const [query, setQuery] = useState('')
  const [areasOpen, setAreasOpen] = useState(true)
  const [usersOpen, setUsersOpen] = useState(true)

  const totalSelections =
    selectedRoles.length +
    selectedFamilyIds.length +
    selectedDepartmentIds.length +
    selectedUserIds.length

  const roleOptions = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) return ROLE_OPTIONS
    return ROLE_OPTIONS.filter(r => allowedRoles.includes(r.value))
  }, [allowedRoles])

  const q = query.trim().toLowerCase()

  const filteredFamilies = useMemo(() => {
    if (!q) return families
    return families.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.departments.some(d => d.name.toLowerCase().includes(q))
    )
  }, [families, q])

  const filteredUsers = useMemo(() => {
    if (!q) return users
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, q])

  const handleFamilyToggle = (familyId: string, checked: boolean) => {
    const family = families.find(f => f.id === familyId)
    if (!family) return

    if (checked) {
      onFamilyIdsChange([...selectedFamilyIds, familyId])
      const newDeptIds = family.departments.map(d => d.id)
      const merged = [...new Set([...selectedDepartmentIds, ...newDeptIds])]
      onDepartmentIdsChange(merged)
    } else {
      onFamilyIdsChange(selectedFamilyIds.filter(id => id !== familyId))
      const familyDeptIds = new Set(family.departments.map(d => d.id))
      onDepartmentIdsChange(selectedDepartmentIds.filter(id => !familyDeptIds.has(id)))
    }
  }

  const handleDepartmentToggle = (deptId: string, familyId: string, checked: boolean) => {
    if (checked) {
      onDepartmentIdsChange([...selectedDepartmentIds, deptId])
      const family = families.find(f => f.id === familyId)
      if (family) {
        const allDeptIds = family.departments.map(d => d.id)
        const allSelected = allDeptIds.every(
          id => id === deptId || selectedDepartmentIds.includes(id)
        )
        if (allSelected && !selectedFamilyIds.includes(familyId)) {
          onFamilyIdsChange([...selectedFamilyIds, familyId])
        }
      }
    } else {
      onDepartmentIdsChange(selectedDepartmentIds.filter(id => id !== deptId))
      if (selectedFamilyIds.includes(familyId)) {
        onFamilyIdsChange(selectedFamilyIds.filter(id => id !== familyId))
      }
    }
  }

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter(r => r !== role))
    } else {
      onRolesChange([...selectedRoles, role])
    }
  }

  const removeRole = (role: string) => onRolesChange(selectedRoles.filter(r => r !== role))
  const removeFamily = (id: string) => handleFamilyToggle(id, false)
  const removeDepartment = (id: string) => {
    const family = families.find(f => f.departments.some(d => d.id === id))
    if (family) handleDepartmentToggle(id, family.id, false)
  }
  const removeUser = (id: string) => onUserIdsChange(selectedUserIds.filter(uid => uid !== id))

  const clearAll = () => {
    onRolesChange([])
    onFamilyIdsChange([])
    onDepartmentIdsChange([])
    onUserIdsChange([])
  }

  const orphanDeptCount = selectedDepartmentIds.filter(
    id =>
      !families.some(f => selectedFamilyIds.includes(f.id) && f.departments.some(d => d.id === id))
  ).length

  return (
    <div className='space-y-3 rounded-xl border bg-muted/20 p-3 sm:p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <h4 className='text-sm font-semibold'>¿Quién puede verlo?</h4>
          <p className='text-xs text-muted-foreground mt-0.5'>
            {totalSelections === 0
              ? requireFamilyRestriction
                ? 'Sin filtros extra: visible para tu área / alcance'
                : 'Sin filtros: visible para todos los usuarios con el módulo'
              : `Llegará a ${totalSelections} filtro${totalSelections !== 1 ? 's' : ''} seleccionado${totalSelections !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className='flex items-center gap-1.5 shrink-0'>
          {totalSelections > 0 && (
            <>
              <Badge variant='secondary' className='text-xs'>
                {totalSelections}
              </Badge>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 px-2 text-xs text-muted-foreground'
                onClick={clearAll}
              >
                Limpiar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Roles como chips — sin pestaña */}
      {roleOptions.length > 0 && (
        <div className='space-y-1.5'>
          <div className='flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide'>
            <Shield className='h-3 w-3' />
            Roles
          </div>
          <div className='flex flex-wrap gap-1.5'>
            {roleOptions.map(role => {
              const active = selectedRoles.includes(role.value)
              return (
                <button
                  key={role.value}
                  type='button'
                  onClick={() => toggleRole(role.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  {role.short}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Chips de selección activa */}
      {totalSelections > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {selectedRoles.map(role => (
            <Badge key={role} variant='outline' className='gap-1 pr-1 bg-background'>
              <Shield className='h-3 w-3' />
              {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
              <button
                type='button'
                onClick={() => removeRole(role)}
                className='ml-0.5 rounded-full p-0.5 hover:bg-muted'
              >
                <X className='h-3 w-3' />
              </button>
            </Badge>
          ))}
          {selectedFamilyIds.map(id => {
            const family = families.find(f => f.id === id)
            return family ? (
              <Badge key={id} variant='outline' className='gap-1 pr-1 bg-background'>
                {family.color && (
                  <span
                    className='w-2 h-2 rounded-full'
                    style={{ backgroundColor: family.color }}
                  />
                )}
                {family.name}
                <button
                  type='button'
                  onClick={() => removeFamily(id)}
                  className='ml-0.5 rounded-full p-0.5 hover:bg-muted'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            ) : null
          })}
          {selectedDepartmentIds
            .filter(
              id =>
                !families.some(
                  f => selectedFamilyIds.includes(f.id) && f.departments.some(d => d.id === id)
                )
            )
            .map(id => {
              const dept = families.flatMap(f => f.departments).find(d => d.id === id)
              return dept ? (
                <Badge key={id} variant='secondary' className='gap-1 pr-1 text-xs'>
                  <Building2 className='h-3 w-3' />
                  {dept.name}
                  <button
                    type='button'
                    onClick={() => removeDepartment(id)}
                    className='ml-0.5 rounded-full p-0.5 hover:bg-muted'
                  >
                    <X className='h-3 w-3' />
                  </button>
                </Badge>
              ) : null
            })}
          {selectedUserIds.map(id => {
            const user = users.find(u => u.id === id)
            return user ? (
              <Badge key={id} variant='outline' className='gap-1 pr-1 bg-background'>
                <UserCheck className='h-3 w-3' />
                {user.name}
                <button
                  type='button'
                  onClick={() => removeUser(id)}
                  className='ml-0.5 rounded-full p-0.5 hover:bg-muted'
                >
                  <X className='h-3 w-3' />
                </button>
              </Badge>
            ) : null
          })}
        </div>
      )}

      {/* Búsqueda unificada */}
      <div className='relative'>
        <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
        <Input
          placeholder='Buscar áreas, departamentos o personas...'
          value={query}
          onChange={e => setQuery(e.target.value)}
          className='pl-8 h-9 text-sm bg-background'
        />
      </div>
      {usersHint && <p className='text-[10px] text-muted-foreground -mt-1'>{usersHint}</p>}

      {/* Panel único con secciones colapsables */}
      <div className='rounded-lg border bg-background overflow-hidden'>
        <div className='max-h-[280px] overflow-y-auto divide-y'>
          {/* Áreas */}
          <section>
            <button
              type='button'
              onClick={() => setAreasOpen(o => !o)}
              className='sticky top-0 z-10 flex w-full items-center justify-between gap-2 bg-muted/60 px-3 py-2 text-left backdrop-blur-sm'
            >
              <span className='flex items-center gap-1.5 text-xs font-semibold'>
                <Building2 className='h-3.5 w-3.5 text-muted-foreground' />
                Áreas
                {(selectedFamilyIds.length > 0 || orphanDeptCount > 0) && (
                  <Badge variant='secondary' className='h-4 px-1.5 text-[10px]'>
                    {selectedFamilyIds.length + orphanDeptCount}
                  </Badge>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform',
                  areasOpen && 'rotate-180'
                )}
              />
            </button>
            {areasOpen && (
              <div className='space-y-0.5 p-2'>
                {filteredFamilies.map(family => {
                  const isFamilySelected = selectedFamilyIds.includes(family.id)
                  const selectedDeptCount = family.departments.filter(d =>
                    selectedDepartmentIds.includes(d.id)
                  ).length
                  const isPartial = !isFamilySelected && selectedDeptCount > 0

                  return (
                    <div key={family.id} className='space-y-0.5'>
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors',
                          isFamilySelected && 'bg-primary/5'
                        )}
                      >
                        <Checkbox
                          id={`vis-family-${family.id}`}
                          checked={isFamilySelected}
                          className={isPartial ? 'data-[state=unchecked]:bg-primary/20' : ''}
                          onCheckedChange={checked => handleFamilyToggle(family.id, !!checked)}
                        />
                        {family.color && (
                          <span
                            className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                            style={{ backgroundColor: family.color }}
                          />
                        )}
                        <Label
                          htmlFor={`vis-family-${family.id}`}
                          className='text-sm font-medium cursor-pointer flex-1'
                        >
                          {family.name}
                        </Label>
                        {family.departments.length > 0 && (
                          <span className='text-[10px] text-muted-foreground'>
                            {selectedDeptCount}/{family.departments.length}
                          </span>
                        )}
                      </div>
                      {(isFamilySelected ||
                        isPartial ||
                        (q && family.departments.some(d => d.name.toLowerCase().includes(q)))) &&
                        family.departments.length > 0 && (
                          <div className='ml-7 space-y-0.5 pb-1'>
                            {family.departments
                              .filter(
                                d =>
                                  !q ||
                                  d.name.toLowerCase().includes(q) ||
                                  family.name.toLowerCase().includes(q)
                              )
                              .map(dept => (
                                <div
                                  key={dept.id}
                                  className='flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/50'
                                >
                                  <Checkbox
                                    id={`vis-dept-${dept.id}`}
                                    checked={selectedDepartmentIds.includes(dept.id)}
                                    onCheckedChange={checked =>
                                      handleDepartmentToggle(dept.id, family.id, !!checked)
                                    }
                                  />
                                  <Label
                                    htmlFor={`vis-dept-${dept.id}`}
                                    className='text-xs cursor-pointer text-muted-foreground'
                                  >
                                    {dept.name}
                                  </Label>
                                </div>
                              ))}
                          </div>
                        )}
                    </div>
                  )
                })}
                {filteredFamilies.length === 0 && (
                  <p className='text-center text-xs text-muted-foreground py-3'>
                    Sin áreas que coincidan
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Personas */}
          <section>
            <button
              type='button'
              onClick={() => setUsersOpen(o => !o)}
              className='sticky top-0 z-10 flex w-full items-center justify-between gap-2 bg-muted/60 px-3 py-2 text-left backdrop-blur-sm'
            >
              <span className='flex items-center gap-1.5 text-xs font-semibold'>
                <Users className='h-3.5 w-3.5 text-muted-foreground' />
                Personas
                {selectedUserIds.length > 0 && (
                  <Badge variant='secondary' className='h-4 px-1.5 text-[10px]'>
                    {selectedUserIds.length}
                  </Badge>
                )}
              </span>
              <ChevronDown
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground transition-transform',
                  usersOpen && 'rotate-180'
                )}
              />
            </button>
            {usersOpen && (
              <div className='space-y-0.5 p-2'>
                {filteredUsers.map(user => (
                  <div
                    key={user.id}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors',
                      selectedUserIds.includes(user.id) && 'bg-primary/5'
                    )}
                  >
                    <Checkbox
                      id={`vis-user-${user.id}`}
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={checked => {
                        if (checked) onUserIdsChange([...selectedUserIds, user.id])
                        else onUserIdsChange(selectedUserIds.filter(id => id !== user.id))
                      }}
                    />
                    <Label
                      htmlFor={`vis-user-${user.id}`}
                      className='cursor-pointer flex-1 min-w-0'
                    >
                      <p className='text-xs font-medium truncate'>{user.name}</p>
                      <p className='text-[10px] text-muted-foreground truncate'>{user.email}</p>
                    </Label>
                  </div>
                ))}
                {filteredUsers.length === 0 && (
                  <p className='text-center text-xs text-muted-foreground py-3'>
                    Sin personas que coincidan
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
