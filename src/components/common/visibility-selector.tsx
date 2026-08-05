'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Search, Building2, Shield, UserCheck, ChevronRight } from 'lucide-react'
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
  role?: string
  departmentId?: string | null
  familyId?: string | null
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
  usersHint?: string
  allowedRoles?: string[]
  requireFamilyRestriction?: boolean
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administradores', short: 'Admins' },
  { value: 'TECHNICIAN', label: 'Técnicos', short: 'Técnicos' },
  { value: 'CLIENT', label: 'Clientes', short: 'Clientes' },
]

const ROLE_SHORT: Record<string, string> = {
  ADMIN: 'Admin',
  TECHNICIAN: 'Técnico',
  CLIENT: 'Cliente',
}

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
  /** Áreas expandidas (para ver departamentos y personas) */
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())
  /** Departamentos expandidos */
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set())

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

  // Usuarios visibles según roles que el creador puede dirigir
  const scopedUsers = useMemo(() => {
    if (!allowedRoles || allowedRoles.length === 0) return users
    return users.filter(u => !u.role || allowedRoles.includes(u.role))
  }, [users, allowedRoles])

  const usersByDept = useMemo(() => {
    const map = new Map<string, UserOption[]>()
    for (const u of scopedUsers) {
      if (!u.departmentId) continue
      const list = map.get(u.departmentId) ?? []
      list.push(u)
      map.set(u.departmentId, list)
    }
    return map
  }, [scopedUsers])

  const usersByFamilyNoDept = useMemo(() => {
    const map = new Map<string, UserOption[]>()
    for (const u of scopedUsers) {
      if (u.departmentId || !u.familyId) continue
      const list = map.get(u.familyId) ?? []
      list.push(u)
      map.set(u.familyId, list)
    }
    return map
  }, [scopedUsers])

  const orphanUsers = useMemo(
    () => scopedUsers.filter(u => !u.departmentId && !u.familyId),
    [scopedUsers]
  )

  const familyMatchesSearch = (family: FamilyOption) => {
    if (!q) return true
    if (family.name.toLowerCase().includes(q)) return true
    if (family.departments.some(d => d.name.toLowerCase().includes(q))) return true
    const deptUsers = family.departments.flatMap(d => usersByDept.get(d.id) ?? [])
    const loose = usersByFamilyNoDept.get(family.id) ?? []
    return [...deptUsers, ...loose].some(
      u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    )
  }

  const filteredFamilies = useMemo(
    () => families.filter(familyMatchesSearch),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [families, q, usersByDept, usersByFamilyNoDept]
  )

  // Al buscar, expandir áreas/deptos que coinciden
  useEffect(() => {
    if (!q) return
    const nextFamilies = new Set<string>()
    const nextDepts = new Set<string>()
    for (const family of families) {
      if (!familyMatchesSearch(family)) continue
      nextFamilies.add(family.id)
      for (const dept of family.departments) {
        const deptHit = dept.name.toLowerCase().includes(q)
        const usersHit = (usersByDept.get(dept.id) ?? []).some(
          u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        )
        if (deptHit || usersHit || family.name.toLowerCase().includes(q)) {
          nextDepts.add(dept.id)
        }
      }
    }
    setExpandedFamilies(nextFamilies)
    setExpandedDepts(nextDepts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const toggleExpandedFamily = (id: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpandedDept = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFamilyToggle = (familyId: string, checked: boolean) => {
    const family = families.find(f => f.id === familyId)
    if (!family) return

    // Placeholder de UI (deptos huérfanos): solo marca departamentos reales
    const isVirtualFamily = familyId.startsWith('__')

    if (checked) {
      if (!isVirtualFamily) {
        onFamilyIdsChange([...selectedFamilyIds, familyId])
      }
      const newDeptIds = family.departments.map(d => d.id)
      onDepartmentIdsChange([...new Set([...selectedDepartmentIds, ...newDeptIds])])
      setExpandedFamilies(prev => new Set(prev).add(familyId))
    } else {
      if (!isVirtualFamily) {
        onFamilyIdsChange(selectedFamilyIds.filter(id => id !== familyId))
      }
      const familyDeptIds = new Set(family.departments.map(d => d.id))
      onDepartmentIdsChange(selectedDepartmentIds.filter(id => !familyDeptIds.has(id)))
      const removeUserIds = new Set(
        scopedUsers
          .filter(u => u.familyId === familyId || familyDeptIds.has(u.departmentId ?? ''))
          .map(u => u.id)
      )
      if (removeUserIds.size > 0) {
        onUserIdsChange(selectedUserIds.filter(id => !removeUserIds.has(id)))
      }
    }
  }

  const handleDepartmentToggle = (deptId: string, familyId: string, checked: boolean) => {
    if (checked) {
      onDepartmentIdsChange([...selectedDepartmentIds, deptId])
      setExpandedDepts(prev => new Set(prev).add(deptId))
      setExpandedFamilies(prev => new Set(prev).add(familyId))
      const family = families.find(f => f.id === familyId)
      if (family && !familyId.startsWith('__')) {
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
      if (!familyId.startsWith('__') && selectedFamilyIds.includes(familyId)) {
        onFamilyIdsChange(selectedFamilyIds.filter(id => id !== familyId))
      }
      const deptUserIds = new Set((usersByDept.get(deptId) ?? []).map(u => u.id))
      if (deptUserIds.size > 0) {
        onUserIdsChange(selectedUserIds.filter(id => !deptUserIds.has(id)))
      }
    }
  }

  const toggleUser = (userId: string, checked: boolean) => {
    if (checked) onUserIdsChange([...selectedUserIds, userId])
    else onUserIdsChange(selectedUserIds.filter(id => id !== userId))
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

  const renderUserRow = (user: UserOption, indentClass: string) => (
    <div
      key={user.id}
      className={cn(
        'flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50',
        indentClass,
        selectedUserIds.includes(user.id) && 'bg-primary/5'
      )}
    >
      <Checkbox
        id={`vis-user-${user.id}`}
        checked={selectedUserIds.includes(user.id)}
        onCheckedChange={checked => toggleUser(user.id, !!checked)}
      />
      <Label htmlFor={`vis-user-${user.id}`} className='cursor-pointer flex-1 min-w-0'>
        <span className='flex items-center gap-1.5'>
          <span className='text-xs font-medium truncate'>{user.name}</span>
          {user.role && (
            <span className='text-[10px] text-muted-foreground shrink-0'>
              {ROLE_SHORT[user.role] ?? user.role}
            </span>
          )}
        </span>
        <span className='block text-[10px] text-muted-foreground truncate'>{user.email}</span>
      </Label>
    </div>
  )

  return (
    <div className='space-y-4 rounded-xl border bg-muted/20 p-3 sm:p-4'>
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

      {roleOptions.length > 0 && (
        <div className='space-y-2'>
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
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors',
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
          {selectedFamilyIds
            .filter(id => !id.startsWith('__'))
            .map(id => {
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
            const user = scopedUsers.find(u => u.id === id) ?? users.find(u => u.id === id)
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

      <div className='space-y-1.5'>
        <div className='relative'>
          <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
          <Input
            placeholder='Buscar área, departamento o persona...'
            value={query}
            onChange={e => setQuery(e.target.value)}
            className='pl-8 h-9 text-sm bg-background'
          />
        </div>
        {usersHint && <p className='text-[10px] text-muted-foreground'>{usersHint}</p>}
      </div>

      {/* Árbol: Área → Departamento → Personas */}
      <div className='rounded-lg border bg-background'>
        <div className='flex items-center justify-between gap-2 border-b px-3 py-2.5'>
          <span className='flex items-center gap-1.5 text-xs font-semibold'>
            <Building2 className='h-3.5 w-3.5 text-muted-foreground' />
            Áreas y personas
            {(selectedFamilyIds.length > 0 ||
              orphanDeptCount > 0 ||
              selectedUserIds.length > 0) && (
              <Badge variant='secondary' className='h-4 px-1.5 text-[10px]'>
                {selectedFamilyIds.length + orphanDeptCount + selectedUserIds.length}
              </Badge>
            )}
          </span>
          <span className='text-[10px] text-muted-foreground hidden sm:inline'>
            Expande un área para ver departamentos y usuarios
          </span>
        </div>

        <div className='max-h-[320px] overflow-y-auto p-2 space-y-1'>
          {filteredFamilies.map(family => {
            const isVirtualFamily = family.id.startsWith('__')
            const allDeptsSelected =
              family.departments.length > 0 &&
              family.departments.every(d => selectedDepartmentIds.includes(d.id))
            const isFamilySelected = isVirtualFamily
              ? allDeptsSelected
              : selectedFamilyIds.includes(family.id)
            const selectedDeptCount = family.departments.filter(d =>
              selectedDepartmentIds.includes(d.id)
            ).length
            const isPartial = !isFamilySelected && selectedDeptCount > 0
            const isExpanded = expandedFamilies.has(family.id)
            const familyLooseUsers = (usersByFamilyNoDept.get(family.id) ?? []).filter(
              u =>
                !q ||
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                family.name.toLowerCase().includes(q)
            )
            const hasChildren =
              family.departments.length > 0 || (usersByFamilyNoDept.get(family.id) ?? []).length > 0

            return (
              <div key={family.id} className='rounded-md border border-transparent'>
                <div
                  className={cn(
                    'flex items-center gap-1 rounded-md px-1 py-1.5 transition-colors',
                    isFamilySelected && 'bg-primary/5'
                  )}
                >
                  <button
                    type='button'
                    disabled={!hasChildren}
                    onClick={() => toggleExpandedFamily(family.id)}
                    className={cn(
                      'h-7 w-7 shrink-0 inline-flex items-center justify-center rounded-md',
                      hasChildren ? 'hover:bg-muted' : 'opacity-30 cursor-default'
                    )}
                    aria-label={isExpanded ? 'Contraer área' : 'Expandir área'}
                  >
                    <ChevronRight
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </button>
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
                    className='text-sm font-medium cursor-pointer flex-1 py-0.5'
                  >
                    {family.name}
                  </Label>
                  <span className='text-[10px] text-muted-foreground pr-1 tabular-nums'>
                    {selectedDeptCount}/{family.departments.length}
                  </span>
                </div>

                {isExpanded && hasChildren && (
                  <div className='ml-4 mt-1 mb-2 space-y-1 border-l pl-2'>
                    {family.departments
                      .filter(
                        d =>
                          !q ||
                          d.name.toLowerCase().includes(q) ||
                          family.name.toLowerCase().includes(q) ||
                          (usersByDept.get(d.id) ?? []).some(
                            u =>
                              u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                          )
                      )
                      .map(dept => {
                        const deptUsers = (usersByDept.get(dept.id) ?? []).filter(
                          u =>
                            !q ||
                            u.name.toLowerCase().includes(q) ||
                            u.email.toLowerCase().includes(q) ||
                            dept.name.toLowerCase().includes(q) ||
                            family.name.toLowerCase().includes(q)
                        )
                        const deptExpanded = expandedDepts.has(dept.id)
                        const deptSelected = selectedDepartmentIds.includes(dept.id)

                        return (
                          <div key={dept.id} className='space-y-0.5'>
                            <div
                              className={cn(
                                'flex items-center gap-1 rounded-md px-1 py-1',
                                deptSelected && 'bg-primary/5'
                              )}
                            >
                              <button
                                type='button'
                                onClick={() => toggleExpandedDept(dept.id)}
                                className='h-6 w-6 shrink-0 inline-flex items-center justify-center rounded-md hover:bg-muted'
                                aria-label={
                                  deptExpanded ? 'Contraer departamento' : 'Expandir departamento'
                                }
                              >
                                <ChevronRight
                                  className={cn(
                                    'h-3.5 w-3.5 text-muted-foreground transition-transform',
                                    deptExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                              <Checkbox
                                id={`vis-dept-${dept.id}`}
                                checked={deptSelected}
                                onCheckedChange={checked =>
                                  handleDepartmentToggle(dept.id, family.id, !!checked)
                                }
                              />
                              <Label
                                htmlFor={`vis-dept-${dept.id}`}
                                className='text-xs cursor-pointer flex-1 text-muted-foreground'
                              >
                                {dept.name}
                              </Label>
                              <span className='text-[10px] text-muted-foreground pr-1'>
                                {(usersByDept.get(dept.id) ?? []).length}
                              </span>
                            </div>

                            {deptExpanded && (
                              <div className='ml-5 space-y-0.5 border-l pl-2'>
                                {deptUsers.length > 0 ? (
                                  deptUsers.map(u => renderUserRow(u, 'pl-1'))
                                ) : (
                                  <p className='text-[10px] text-muted-foreground px-2 py-1.5'>
                                    Sin personas en este departamento
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}

                    {familyLooseUsers.length > 0 && (
                      <div className='space-y-0.5 pt-1'>
                        <p className='text-[10px] font-medium text-muted-foreground px-2 uppercase tracking-wide'>
                          Sin departamento
                        </p>
                        {familyLooseUsers.map(u => renderUserRow(u, 'pl-2'))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {orphanUsers.length > 0 &&
            orphanUsers.some(
              u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
            ) && (
              <div className='rounded-md border border-dashed p-2 mt-2 space-y-1'>
                <p className='text-[10px] font-medium text-muted-foreground px-1 uppercase tracking-wide'>
                  Otras personas
                </p>
                {orphanUsers
                  .filter(
                    u => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
                  )
                  .map(u => renderUserRow(u, 'pl-1'))}
              </div>
            )}

          {filteredFamilies.length === 0 && orphanUsers.length === 0 && (
            <div className='text-center px-3 py-6 space-y-1'>
              <p className='text-xs text-muted-foreground'>
                {q
                  ? 'Sin resultados para la búsqueda'
                  : 'No hay áreas ni departamentos disponibles'}
              </p>
              {!q && (
                <p className='text-[10px] text-muted-foreground'>
                  El sistema funciona igual con pocos datos. Si faltan departamentos del
                  organigrama, un administrador puede sincronizarlos con{' '}
                  <code className='text-[10px] bg-muted px-1 rounded'>
                    npm run db:seed-departments
                  </code>
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
