'use client'

import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Eye, Edit, Trash2, UserCheck, UserX, LockOpen, MoreHorizontal } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  onUnlockUser?: (user: UserData) => void
  currentUserId?: string
  isSuperAdmin?: boolean
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
            className={`h-8 w-8 p-0 rounded-md ${className}`}
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
  onAvatarEdit: _onAvatarEdit,
  onToggleStatus,
  onUnlockUser,
  currentUserId,
  isSuperAdmin = false,
}: UserColumnsProps = {}) {
  return [
    {
      key: 'user',
      label: 'Usuario',
      sortable: true,
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        return (
          <div className='flex items-center gap-3 min-w-0'>
            {/* Avatar más grande y con indicador de estado */}
            <div className='relative flex-shrink-0'>
              <Avatar className='h-9 w-9'>
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
                  <RoleIcon className='h-4 w-4' />
                </AvatarFallback>
              </Avatar>
              {/* Indicador de estado activo/inactivo */}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  user.isActive ? 'bg-green-500' : 'bg-muted-foreground'
                }`}
              />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground truncate leading-tight'>
                {user.name}
              </p>
              <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
            </div>
          </div>
        )
      },
      width: '240px',
    },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      render: (user: UserData) => (
        <RoleBadge role={user.role} isSuperAdmin={(user as any).isSuperAdmin} iconSize='sm' />
      ),
      width: '120px',
    },
    {
      key: 'department',
      label: 'Departamento',
      render: (user: UserData) => {
        if (!user.department) return <span className='text-muted-foreground text-xs'>—</span>
        const name = typeof user.department === 'string' ? user.department : user.department.name
        const color = typeof user.department !== 'string' ? user.department.color : undefined
        return (
          <div className='flex items-center gap-2 min-w-0'>
            {color && (
              <div
                className='w-2.5 h-2.5 rounded-full flex-shrink-0'
                style={{ backgroundColor: color }}
              />
            )}
            <span className='text-sm truncate'>{name}</span>
          </div>
        )
      },
      width: '140px',
    },
    {
      key: 'lastLogin',
      label: 'Último acceso',
      sortable: true,
      render: (user: UserData) => (
        <span className={`text-sm ${user.lastLogin ? 'text-foreground' : 'text-muted-foreground'}`}>
          {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Nunca'}
        </span>
      ),
      width: '110px',
    },
    {
      key: 'actions',
      label: '',
      render: (user: UserData) => (
        <div className='flex items-center justify-end gap-1'>
          {onUserDetails && (
            <ActionBtn
              title='Ver detalles'
              onClick={() => onUserDetails(user)}
              className='text-muted-foreground hover:text-foreground hover:bg-muted'
            >
              <Eye className='h-4 w-4' />
            </ActionBtn>
          )}
          {onUserEdit && (
            <ActionBtn
              title='Editar usuario'
              onClick={() => onUserEdit(user)}
              className='text-muted-foreground hover:text-foreground hover:bg-muted'
            >
              <Edit className='h-4 w-4' />
            </ActionBtn>
          )}
          {onToggleStatus && user.id !== currentUserId && (
            <ActionBtn
              title={user.isActive ? 'Desactivar usuario' : 'Activar usuario'}
              onClick={() => onToggleStatus(user)}
              className={
                user.isActive
                  ? 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/30'
              }
            >
              {user.isActive ? <UserX className='h-4 w-4' /> : <UserCheck className='h-4 w-4' />}
            </ActionBtn>
          )}
          {/* Menú adicional — solo SuperAdmin */}
          {isSuperAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted'
                  onClick={e => e.stopPropagation()}
                >
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-52'>
                {onUnlockUser && (
                  <DropdownMenuItem
                    onClick={e => { e.stopPropagation(); onUnlockUser(user) }}
                    className='cursor-pointer text-blue-600 focus:text-blue-600 focus:bg-blue-50'
                  >
                    <LockOpen className='h-4 w-4 mr-2' />
                    Desbloquear cuenta
                  </DropdownMenuItem>
                )}
                {onUserDelete && user.id !== currentUserId && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={e => { e.stopPropagation(); onUserDelete(user) }}
                      className='cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10'
                    >
                      <Trash2 className='h-4 w-4 mr-2' />
                      Eliminar usuario
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* Eliminar para admin normal (sin dropdown) */}
          {!isSuperAdmin && onUserDelete && user.id !== currentUserId && (
            <ActionBtn
              title='Eliminar usuario'
              onClick={() => onUserDelete(user)}
              className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
            >
              <Trash2 className='h-4 w-4' />
            </ActionBtn>
          )}
        </div>
      ),
      width: '140px',
    },
  ]
}

// Vista de tarjeta
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

  return (
    <div
      className='p-4 border rounded-lg hover:border-primary/30 hover:shadow-sm transition-all bg-card cursor-pointer'
      onClick={() => onDetails?.(user)}
    >
      <div className='flex items-start gap-3'>
        <div className='relative flex-shrink-0'>
          <Avatar className='h-10 w-10'>
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
              <RoleIcon className='h-4 w-4' />
            </AvatarFallback>
          </Avatar>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
              user.isActive ? 'bg-green-500' : 'bg-muted-foreground'
            }`}
          />
        </div>
        <div className='flex-1 min-w-0'>
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <p className='text-sm font-semibold truncate'>{user.name}</p>
              <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
            </div>
            <div
              className='flex items-center gap-0.5 flex-shrink-0'
              onClick={e => e.stopPropagation()}
            >
              {onEdit && (
                <ActionBtn
                  title='Editar'
                  onClick={() => onEdit(user)}
                  className='text-muted-foreground hover:text-foreground hover:bg-muted'
                >
                  <Edit className='h-3.5 w-3.5' />
                </ActionBtn>
              )}
              {onToggleStatus && user.id !== currentUserId && (
                <ActionBtn
                  title={user.isActive ? 'Desactivar' : 'Activar'}
                  onClick={() => onToggleStatus(user)}
                  className={
                    user.isActive
                      ? 'text-muted-foreground hover:text-amber-600 hover:bg-amber-50'
                      : 'text-muted-foreground hover:text-green-600 hover:bg-green-50'
                  }
                >
                  {user.isActive ? (
                    <UserX className='h-3.5 w-3.5' />
                  ) : (
                    <UserCheck className='h-3.5 w-3.5' />
                  )}
                </ActionBtn>
              )}
              {onDelete && user.id !== currentUserId && (
                <ActionBtn
                  title='Eliminar'
                  onClick={() => onDelete(user)}
                  className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                >
                  <Trash2 className='h-3.5 w-3.5' />
                </ActionBtn>
              )}
            </div>
          </div>
          <div className='flex items-center gap-2 mt-2 flex-wrap'>
            <RoleBadge role={user.role} isSuperAdmin={(user as any).isSuperAdmin} iconSize='sm' />
            {user.department && (
              <span className='text-xs text-muted-foreground'>
                {typeof user.department === 'string' ? user.department : user.department.name}
              </span>
            )}
          </div>
          <div className='flex items-center justify-end mt-2 pt-2 border-t'>
            <span className='text-xs text-muted-foreground'>
              {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Sin acceso'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
