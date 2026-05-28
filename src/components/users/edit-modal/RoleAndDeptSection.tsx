'use client'

import { Building } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'

interface RoleAndDeptSectionProps {
  role: UserRole
  departmentId: string
  isCurrentUser: boolean
  errors: Record<string, string>
  departments: Array<{ id: string; name: string; color: string }>
  onChange: (field: 'role' | 'departmentId', value: string) => void
}

export function RoleAndDeptSection({
  role,
  departmentId,
  isCurrentUser,
  errors,
  departments,
  onChange,
}: RoleAndDeptSectionProps) {
  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <Building className='h-4 w-4 text-muted-foreground' />
        Rol y departamento
      </h3>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label htmlFor='edit-role'>
            Rol del usuario <span className='text-destructive'>*</span>
          </Label>
          <select
            id='edit-role'
            value={role}
            disabled={isCurrentUser}
            onChange={e => {
              const r = e.target.value as UserRole
              onChange('role', r)
            }}
            className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {USER_ROLE_FORM_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {isCurrentUser && (
            <p className='text-xs text-amber-600'>No puedes cambiar tu propio rol</p>
          )}
        </div>
        <div className='space-y-1'>
          <Label>
            Departamento {role !== 'ADMIN' && <span className='text-destructive'>*</span>}
          </Label>
          <DepartmentSelector
            value={departmentId || null}
            onChange={val => onChange('departmentId', val ?? '')}
            departments={departments as any}
            placeholder='Buscar departamento...'
            error={errors.departmentId}
          />
        </div>
      </div>
    </div>
  )
}
