'use client'

import { useState, useMemo } from 'react'
import { X, Search, Users, Building2, Shield, UserCheck } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administradores', icon: '🛡️' },
  { value: 'TECHNICIAN', label: 'Técnicos', icon: '🔧' },
  { value: 'CLIENT', label: 'Clientes', icon: '👤' },
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
}: VisibilitySelectorProps) {
  const [familySearch, setFamilySearch] = useState('')
  const [userSearch, setUserSearch] = useState('')

  const totalSelections =
    selectedRoles.length +
    selectedFamilyIds.length +
    selectedDepartmentIds.length +
    selectedUserIds.length

  const filteredFamilies = useMemo(() => {
    if (!familySearch) return families
    const q = familySearch.toLowerCase()
    return families.filter(
      f =>
        f.name.toLowerCase().includes(q) ||
        f.departments.some(d => d.name.toLowerCase().includes(q))
    )
  }, [families, familySearch])

  const filteredUsers = useMemo(() => {
    if (!userSearch) return users
    const q = userSearch.toLowerCase()
    return users.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
  }, [users, userSearch])

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

  const removeRole = (role: string) => onRolesChange(selectedRoles.filter(r => r !== role))
  const removeFamily = (id: string) => handleFamilyToggle(id, false)
  const removeDepartment = (id: string) => {
    const family = families.find(f => f.departments.some(d => d.id === id))
    if (family) handleDepartmentToggle(id, family.id, false)
  }
  const removeUser = (id: string) => onUserIdsChange(selectedUserIds.filter(uid => uid !== id))

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <div>
          <h4 className='text-sm font-semibold'>Visibilidad</h4>
          <p className='text-xs text-muted-foreground'>
            {totalSelections === 0
              ? 'Visible para todos los usuarios'
              : `Restringido a ${totalSelections} selección${totalSelections !== 1 ? 'es' : ''}`}
          </p>
        </div>
        {totalSelections > 0 && (
          <Badge variant='secondary' className='text-xs'>
            {totalSelections} filtro{totalSelections !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {totalSelections > 0 && (
        <div className='flex flex-wrap gap-1.5 p-2 rounded-lg border bg-muted/30'>
          {selectedRoles.map(role => (
            <Badge key={role} variant='outline' className='gap-1 pr-1'>
              <Shield className='h-3 w-3' />
              {ROLE_OPTIONS.find(r => r.value === role)?.label || role}
              <button
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
              <Badge key={id} variant='outline' className='gap-1 pr-1'>
                {family.color && (
                  <span
                    className='w-2 h-2 rounded-full'
                    style={{ backgroundColor: family.color }}
                  />
                )}
                {family.name}
                <button
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
              <Badge key={id} variant='outline' className='gap-1 pr-1'>
                <UserCheck className='h-3 w-3' />
                {user.name}
                <button
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

      <Tabs defaultValue='roles' className='w-full'>
        <TabsList className='w-full flex overflow-x-auto gap-1 p-1'>
          <TabsTrigger value='roles' className='text-xs gap-1 flex-shrink-0'>
            <Shield className='h-3.5 w-3.5' />
            Roles
            {selectedRoles.length > 0 && (
              <Badge variant='secondary' className='h-4 w-4 p-0 text-[10px] justify-center'>
                {selectedRoles.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='families' className='text-xs gap-1 flex-shrink-0'>
            <Building2 className='h-3.5 w-3.5' />
            Áreas
            {selectedFamilyIds.length + selectedDepartmentIds.length > 0 && (
              <Badge variant='secondary' className='h-4 w-4 p-0 text-[10px] justify-center'>
                {selectedFamilyIds.length +
                  selectedDepartmentIds.filter(
                    id =>
                      !families.some(
                        f =>
                          selectedFamilyIds.includes(f.id) && f.departments.some(d => d.id === id)
                      )
                  ).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value='users' className='text-xs gap-1 flex-shrink-0'>
            <Users className='h-3.5 w-3.5' />
            Usuarios
            {selectedUserIds.length > 0 && (
              <Badge variant='secondary' className='h-4 w-4 p-0 text-[10px] justify-center'>
                {selectedUserIds.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value='roles' className='mt-3'>
          <div className='space-y-2 rounded-lg border p-3'>
            {ROLE_OPTIONS.map(role => (
              <div key={role.value} className='flex items-center gap-2.5'>
                <Checkbox
                  id={`vis-role-${role.value}`}
                  checked={selectedRoles.includes(role.value)}
                  onCheckedChange={checked => {
                    if (checked) onRolesChange([...selectedRoles, role.value])
                    else onRolesChange(selectedRoles.filter(r => r !== role.value))
                  }}
                />
                <Label
                  htmlFor={`vis-role-${role.value}`}
                  className='text-sm cursor-pointer flex items-center gap-2'
                >
                  <span>{role.icon}</span>
                  {role.label}
                </Label>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value='families' className='mt-3'>
          <div className='space-y-2'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
              <Input
                placeholder='Buscar familia o departamento...'
                value={familySearch}
                onChange={e => setFamilySearch(e.target.value)}
                className='pl-8 h-8 text-xs'
              />
            </div>
            <div className='h-[200px] rounded-lg border p-2 overflow-y-auto'>
              <div className='space-y-1'>
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
                      {(isFamilySelected || isPartial) && family.departments.length > 0 && (
                        <div className='ml-7 space-y-0.5 pb-1'>
                          {family.departments.map(dept => (
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
                  <p className='text-center text-xs text-muted-foreground py-4'>Sin resultados</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value='users' className='mt-3'>
          <div className='space-y-2'>
            <div className='relative'>
              <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
              <Input
                placeholder='Buscar por nombre o email...'
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className='pl-8 h-8 text-xs'
              />
            </div>
            {usersHint && <p className='text-[10px] text-muted-foreground px-0.5'>{usersHint}</p>}
            <div className='h-[200px] rounded-lg border p-2 overflow-y-auto'>
              <div className='space-y-0.5'>
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
                  <p className='text-center text-xs text-muted-foreground py-4'>Sin resultados</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
