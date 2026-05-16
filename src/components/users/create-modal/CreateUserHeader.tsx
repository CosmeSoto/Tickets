'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Camera, X, Building } from 'lucide-react'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { getUserInitials } from '../user-utils'

interface CreateUserHeaderProps {
  name: string
  email: string
  role: UserRole
  isSuperAdmin: boolean
  avatarPreview: string | null
  selectedDepartment: { id: string; name: string; color: string } | undefined
  onAvatarClick: () => void
  onRemoveAvatar: () => void
  hasAvatar: boolean
}

export function CreateUserHeader({
  name,
  email,
  role,
  isSuperAdmin,
  avatarPreview,
  selectedDepartment,
  onAvatarClick,
  onRemoveAvatar,
  hasAvatar,
}: CreateUserHeaderProps) {
  const initials = getUserInitials(name || 'Nombre del usuario')
  const roleOption = USER_ROLE_FORM_OPTIONS.find(r => r.value === role)

  return (
    <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border'>
      <div className='relative group shrink-0'>
        <Avatar className='h-16 w-16 border-2 border-background shadow'>
          <AvatarImage src={avatarPreview || undefined} alt='Preview' />
          <AvatarFallback className='text-base font-semibold bg-primary/10 text-primary'>
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className='absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1'>
          <button
            type='button'
            title='Seleccionar foto'
            onClick={onAvatarClick}
            className='p-1 rounded-full bg-white/20 hover:bg-white/40 text-white'
          >
            <Camera className='h-3.5 w-3.5' />
          </button>
          {hasAvatar && (
            <button
              type='button'
              title='Quitar foto'
              onClick={onRemoveAvatar}
              className='p-1 rounded-full bg-white/20 hover:bg-red-500/60 text-white'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
      </div>

      <div className='flex-1 min-w-0'>
        <p className='font-semibold text-foreground truncate'>{name || 'Nombre del usuario'}</p>
        <p className='text-sm text-muted-foreground truncate'>{email || 'email@empresa.com'}</p>
        <div className='flex items-center gap-2 mt-1.5 flex-wrap'>
          {roleOption && (
            <Badge className={roleOption.color}>
              <roleOption.icon className='h-3 w-3 mr-1' />
              {role === 'ADMIN' && isSuperAdmin ? 'Super Admin' : roleOption.label}
            </Badge>
          )}
          {selectedDepartment && (
            <Badge
              variant='outline'
              style={{
                borderColor: selectedDepartment.color,
                color: selectedDepartment.color,
              }}
            >
              <Building className='h-3 w-3 mr-1' />
              {selectedDepartment.name}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}
