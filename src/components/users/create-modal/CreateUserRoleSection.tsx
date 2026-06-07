'use client'

import { Label } from '@/components/ui/label'
import { Building, Crown } from 'lucide-react'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { DepartmentSelector } from '@/components/ui/department-selector'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CreateUserRoleSectionProps {
  role: UserRole
  departmentId: string
  isSuperAdmin: boolean
  isSuperAdminSession: boolean
  departments: Array<{ id: string; name: string; color: string }>
  errors: Record<string, string>
  onRoleChange: (role: UserRole) => void
  onDepartmentChange: (departmentId: string) => void
  onSuperAdminChange: (isSuperAdmin: boolean) => void
}

export function CreateUserRoleSection({
  role,
  departmentId,
  isSuperAdmin,
  isSuperAdminSession,
  departments,
  errors,
  onRoleChange,
  onDepartmentChange,
  onSuperAdminChange,
}: CreateUserRoleSectionProps) {
  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <Building className='h-4 w-4 text-muted-foreground' />
        Rol y departamento
      </h3>
      <div className='grid grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label htmlFor='create-role'>
            Rol del usuario <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={role}
            onValueChange={onRoleChange}
          >
            <SelectTrigger id='create-role' className='h-9'>
              <SelectValue placeholder='Seleccionar rol' />
            </SelectTrigger>
            <SelectContent>
              {USER_ROLE_FORM_OPTIONS.map(r => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='space-y-1'>
          <Label>
            Departamento {role !== 'ADMIN' && <span className='text-destructive'>*</span>}
          </Label>
          <DepartmentSelector
            value={departmentId || null}
            onChange={val => onDepartmentChange(val ?? '')}
            departments={departments as any}
            placeholder='Buscar departamento...'
            error={errors.departmentId}
          />
        </div>
      </div>

      {isSuperAdminSession && role === 'ADMIN' && (
        <div className='flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5'>
          <div>
            <p className='text-sm font-medium flex items-center gap-1.5'>
              <Crown className='h-3.5 w-3.5 text-amber-600' />
              Administrador Principal (Super Admin)
            </p>
            <p className='text-xs text-muted-foreground'>
              Acceso total a todas las familias y configuraciones del sistema.
            </p>
          </div>
          <input
            type='checkbox'
            checked={isSuperAdmin}
            onChange={e => onSuperAdminChange(e.target.checked)}
            className='h-4 w-4 rounded border-border'
          />
        </div>
      )}
    </div>
  )
}
