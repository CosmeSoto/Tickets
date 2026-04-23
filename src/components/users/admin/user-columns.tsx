'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Eye, Edit, Trash2, UserCheck, UserX } from 'lucide-react'
import { UserData, formatTimeAgo } from '@/hooks/use-users'
import { USER_ROLE_COLORS, USER_ROLE_ICONS } from '@/lib/constants/user-constants'
import { RoleBadge } from '@/components/ui/role-badge'

interface UserColumnsProps {
  onUserEdit?: (user: UserData) => void
  onUserDelete?: (user: UserData) => void
  onUserDetails?: (user: UserData) => void
  onAvatarEdit?: (user: UserData) => void
  onToggleStatus?: (user: UserData) => void
  onPromoteUser?: (user: UserData) => void
  currentUserId?: string
}

function ActionBtn({
  title,
  onClick,
  children,
  className = '',
}: {
  title: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className={`h-7 w-7 p-0 ${className}`}
            onClick={e => {
              e.stopPropagation()
              onClick(e)
            }}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side='top'>
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function createUserColumns({
  onUserEdit,
  onUserDelete,
  onUserDetails,
  onAvatarEdit,
  onToggleStatus,
  currentUserId,
}: UserColumnsProps = {}) {
  return [
    {
      key: 'user',
      label: 'Usuario',
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        return (
          <div className='flex items-center gap-2 min-w-0'>
            <Avatar className='h-7 w-7 flex-shrink-0'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
                <RoleIcon className='h-3.5 w-3.5' />
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <div className='flex items-center gap-1.5'>
                <p className='text-sm font-medium truncate'>{user.name}</p>
                {!user.isActive && (
                  <Badge variant='secondary' className='text-[10px] px-1 py-0 h-4 flex-shrink-0'>
                    Inactivo
                  </Badge>
                )}
              </div>
              <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
            </div>
          </div>
        )
      },
      width: '220px',
    },
    {
      key: 'role',
      label: 'Rol',
      render: (user: UserData) => (
        <RoleBadge role={user.role} isSuperAdmin={(user as any).isSuperAdmin} iconSize='sm' />
      ),
      width: '110px',
    },
    {
      key: 'department',
      label: 'Departamento',
      render: (user: UserData) => {
        if (!user.department) return <span className='text-muted-foreground text-xs'>—</span>
        const name = typeof user.department === 'string' ? user.department : user.department.name
        const color = typeof user.department !== 'string' ? user.department.color : undefined
        return (
          <div className='flex items-center gap-1.5 min-w-0'>
            {color && (
              <div
                className='w-2 h-2 rounded-full flex-shrink-0'
                style={{ backgroundColor: color }}
              />
            )}
            <span className='text-xs truncate'>{name}</span>
          </div>
        )
      },
      width: '130px',
    },
    {
      key: 'tickets',
      label: 'Tickets',
      render: (user: UserData) => {
        const created = user._count?.tickets_tickets_createdByIdTousers ?? 0
        const assigned = user._count?.tickets_tickets_assigneeIdTousers ?? 0
        return (
          <div className='text-xs text-muted-foreground'>
            <span>{created} creados</span>
            {user.role === 'TECHNICIAN' && <span className='ml-1'>· {assigned} asig.</span>}
          </div>
        )
      },
      width: '100px',
    },
    {
      key: 'lastLogin',
      label: 'Último acceso',
      render: (user: UserData) => (
        <span className='text-xs text-muted-foreground'>
          {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Nunca'}
        </span>
      ),
      width: '100px',
    },
    {
      key: 'actions',
      label: '',
      render: (user: UserData) => (
        <div className='flex items-center justify-end gap-0.5'>
          {onUserDetails && (
            <ActionBtn title='Ver detalles' onClick={() => onUserDetails(user)}>
              <Eye className='h-3.5 w-3.5' />
            </ActionBtn>
          )}
          {onUserEdit && (
            <ActionBtn title='Editar' onClick={() => onUserEdit(user)}>
              <Edit className='h-3.5 w-3.5' />
            </ActionBtn>
          )}
          {onToggleStatus && user.id !== currentUserId && (
            <ActionBtn
              title={user.isActive ? 'Desactivar' : 'Activar'}
              onClick={() => onToggleStatus(user)}
            >
              {user.isActive ? (
                <UserX className='h-3.5 w-3.5 text-muted-foreground' />
              ) : (
                <UserCheck className='h-3.5 w-3.5 text-primary' />
              )}
            </ActionBtn>
          )}
          {onUserDelete && user.id !== currentUserId && (
            <ActionBtn
              title='Eliminar'
              onClick={() => onUserDelete(user)}
              className='hover:text-destructive'
            >
              <Trash2 className='h-3.5 w-3.5' />
            </ActionBtn>
          )}
        </div>
      ),
      width: '120px',
    },
  ]
}

// Vista de tarjeta — compacta
export function UserCard({
  user,
  onEdit,
  onDelete,
  onDetails,
  onToggleStatus,
  currentUserId,
}: {
  user: UserData
  onEdit?: (user: UserData) => void
  onDelete?: (user: UserData) => void
  onDetails?: (user: UserData) => void
  onToggleStatus?: (user: UserData) => void
  currentUserId?: string
}) {
  const RoleIcon = USER_ROLE_ICONS[user.role]
  const created = user._count?.tickets_tickets_createdByIdTousers ?? 0
  const assigned = user._count?.tickets_tickets_assigneeIdTousers ?? 0

  return (
    <div
      className='p-3 border rounded-lg hover:bg-muted/30 transition-colors bg-card cursor-pointer'
      onClick={() => onDetails?.(user)}
    >
      <div className='flex items-start gap-2.5'>
        <Avatar className='h-9 w-9 flex-shrink-0'>
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
            <RoleIcon className='h-4 w-4' />
          </AvatarFallback>
        </Avatar>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-1.5 flex-wrap'>
            <p className='text-sm font-medium truncate'>{user.name}</p>
            {!user.isActive && (
              <Badge variant='secondary' className='text-[10px] px-1 h-4'>
                Inactivo
              </Badge>
            )}
          </div>
          <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
          <div className='flex items-center gap-2 mt-1.5 flex-wrap'>
            <RoleBadge role={user.role} isSuperAdmin={(user as any).isSuperAdmin} iconSize='sm' />
            {user.department && (
              <span className='text-xs text-muted-foreground truncate'>
                {typeof user.department === 'string' ? user.department : user.department.name}
              </span>
            )}
          </div>
          <div className='flex items-center justify-between mt-2'>
            <span className='text-xs text-muted-foreground'>
              {created} tickets · {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Sin acceso'}
            </span>
            <div className='flex items-center gap-0.5' onClick={e => e.stopPropagation()}>
              {onEdit && (
                <ActionBtn title='Editar' onClick={() => onEdit(user)}>
                  <Edit className='h-3.5 w-3.5' />
                </ActionBtn>
              )}
              {onToggleStatus && user.id !== currentUserId && (
                <ActionBtn
                  title={user.isActive ? 'Desactivar' : 'Activar'}
                  onClick={() => onToggleStatus(user)}
                >
                  {user.isActive ? (
                    <UserX className='h-3.5 w-3.5' />
                  ) : (
                    <UserCheck className='h-3.5 w-3.5 text-primary' />
                  )}
                </ActionBtn>
              )}
              {onDelete && user.id !== currentUserId && (
                <ActionBtn
                  title='Eliminar'
                  onClick={() => onDelete(user)}
                  className='hover:text-destructive'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </ActionBtn>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
