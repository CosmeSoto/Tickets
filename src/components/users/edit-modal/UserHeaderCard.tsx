'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/components/ui/role-badge'
import { Camera, X, RotateCcw, Calendar, Activity, Ticket, Lock, Tag } from 'lucide-react'
import type { UserRole } from '@/lib/constants/user-constants'

interface UserHeaderCardProps {
  user: {
    id: string
    name: string
    email: string
    avatar?: string | null
    createdAt?: string
    lastLogin?: string
    _count?: {
      tickets_tickets_clientIdTousers?: number
      tickets_tickets_assigneeIdTousers?: number
      technician_assignments?: number
    }
  }
  avatarPreview: string | null
  role: UserRole
  isSuperAdmin: boolean
  isCurrentUser: boolean
  isLocked: boolean
  hasNewAvatar: boolean
  onAvatarChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDeleteAvatar: () => void
  onResetAvatar: () => void
}

const formatDate = (dateString?: string) =>
  dateString
    ? new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export function UserHeaderCard({
  user,
  avatarPreview,
  role,
  isSuperAdmin,
  isCurrentUser,
  isLocked,
  hasNewAvatar,
  onAvatarChange,
  onDeleteAvatar,
  onResetAvatar,
}: UserHeaderCardProps) {
  return (
    <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border'>
      <div className='relative group shrink-0'>
        <Avatar className='h-16 w-16 border-2 border-background shadow'>
          <AvatarImage src={avatarPreview || user.avatar || undefined} alt={user.name} />
          <AvatarFallback className='text-base font-semibold bg-primary/10 text-primary'>
            {user.name
              .split(' ')
              .slice(0, 2)
              .map(n => n[0])
              .join('')
              .toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className='absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1'>
          <button
            type='button'
            title='Cambiar foto'
            onClick={() => document.getElementById('edit-avatar-input')?.click()}
            className='p-1 rounded-full bg-white/20 hover:bg-white/40 text-white'
          >
            <Camera className='h-3.5 w-3.5' />
          </button>
          {(avatarPreview || user.avatar) && (
            <button
              type='button'
              title='Eliminar foto'
              onClick={onDeleteAvatar}
              className='p-1 rounded-full bg-white/20 hover:bg-red-500/60 text-white'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )}
          {hasNewAvatar && (
            <button
              type='button'
              title='Deshacer'
              onClick={onResetAvatar}
              className='p-1 rounded-full bg-white/20 hover:bg-amber-500/60 text-white'
            >
              <RotateCcw className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
        <input
          id='edit-avatar-input'
          type='file'
          accept='image/*'
          onChange={onAvatarChange}
          className='hidden'
        />
      </div>
      <div className='flex-1 min-w-0 w-full sm:w-auto'>
        <div className='flex items-start gap-2 flex-wrap'>
          <span className='font-semibold text-foreground truncate'>{user.name}</span>
          <RoleBadge role={role} isSuperAdmin={isSuperAdmin} />
          {isCurrentUser && (
            <Badge variant='outline' className='text-xs'>
              Tu cuenta
            </Badge>
          )}
          {isLocked && (
            <Badge variant='destructive' className='text-xs flex items-center gap-1'>
              <Lock className='h-3 w-3' />
              Bloqueado
            </Badge>
          )}
        </div>
        <p className='text-sm text-muted-foreground mt-0.5 truncate'>{user.email}</p>
        <div className='flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-1.5 text-xs text-muted-foreground'>
          <span className='flex items-center gap-1'>
            <Calendar className='h-3 w-3' />
            Registro: {formatDate(user.createdAt)}
          </span>
          <span className='flex items-center gap-1'>
            <Activity className='h-3 w-3' />
            Último acceso: {formatDate(user.lastLogin)}
          </span>
        </div>
      </div>
      <div className='flex gap-3 shrink-0 w-full sm:w-auto justify-center sm:justify-end'>
        <div className='text-center'>
          <p className='text-lg font-bold text-primary'>
            {user._count?.tickets_tickets_clientIdTousers ?? 0}
          </p>
          <p className='text-xs text-muted-foreground flex items-center gap-0.5'>
            <Ticket className='h-3 w-3' />
            Tickets
          </p>
        </div>
        <div className='text-center'>
          <p className='text-lg font-bold text-green-600 dark:text-green-400'>
            {user._count?.tickets_tickets_assigneeIdTousers ?? 0}
          </p>
          <p className='text-xs text-muted-foreground'>Asignados</p>
        </div>
        {(role === 'TECHNICIAN' || role === 'ADMIN') && (
          <div
            className='text-center'
            title='Categorías donde este usuario está configurado como resolutor (ver también Categorías → Cobertura por Técnico)'
          >
            <p className='text-lg font-bold text-amber-600 dark:text-amber-400'>
              {user._count?.technician_assignments ?? 0}
            </p>
            <p className='text-xs text-muted-foreground flex items-center gap-0.5'>
              <Tag className='h-3 w-3' />
              Categorías
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
