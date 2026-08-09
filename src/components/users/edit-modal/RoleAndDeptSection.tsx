'use client'

import { Building, Lock } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { useSession } from 'next-auth/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface RoleAndDeptSectionProps {
  role: UserRole
  departmentId: string
  isCurrentUser: boolean
  errors: Record<string, string>
  departments: Array<{
    id: string
    name: string
    color?: string | null
    familyId?: string | null
    family?: {
      id: string
      name: string
      code: string
      color?: string | null
    } | null
  }>
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
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  // El departamento solo puede cambiarlo un Super Admin.
  // Es el vínculo nativo del usuario a su familia y no debe modificarse libremente.
  const deptLocked = !isSuperAdmin

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
        <Building className='h-4 w-4 text-muted-foreground' />
        Rol y departamento
      </h3>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div className='space-y-1'>
          <Label htmlFor='edit-role'>
            Rol del usuario <span className='text-destructive'>*</span>
          </Label>
          <Select value={role} onValueChange={r => onChange('role', r)} disabled={isCurrentUser}>
            <SelectTrigger id='edit-role' className='h-10'>
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
          {isCurrentUser && (
            <p className='text-xs text-amber-600'>No puedes cambiar tu propio rol</p>
          )}
        </div>
        <div className='space-y-1'>
          <Label className='flex items-center gap-1.5'>
            Departamento {role !== 'ADMIN' && <span className='text-destructive'>*</span>}
            {deptLocked && <Lock className='h-3 w-3 text-muted-foreground' />}
          </Label>
          <DepartmentSelector
            value={departmentId || null}
            onChange={val => !deptLocked && onChange('departmentId', val ?? '')}
            departments={departments as any}
            placeholder='Buscar departamento...'
            error={errors.departmentId}
            disabled={deptLocked}
          />
          {deptLocked && (
            <p className='text-xs text-muted-foreground'>
              El departamento define la familia nativa del usuario. Solo un Super Admin puede
              modificarlo.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
