'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Camera,
  UserCheck,
  UserX,
} from 'lucide-react'
import { UserData, formatTimeAgo } from '@/hooks/use-users'
import { 
  USER_ROLE_LABELS, 
  USER_ROLE_COLORS, 
  USER_ROLE_ICONS 
} from '@/lib/constants/user-constants'

interface UserColumnsProps {
  onUserEdit?: (user: UserData) => void
  onUserDelete?: (user: UserData) => void
  onUserDetails?: (user: UserData) => void
  onAvatarEdit?: (user: UserData) => void
  onToggleStatus?: (user: UserData) => void
  currentUserId?: string
}

export function createUserColumns({
  onUserEdit,
  onUserDelete,
  onUserDetails,
  onAvatarEdit,
  onToggleStatus,
  currentUserId
}: UserColumnsProps = {}) {
  return [
    {
      key: 'user',
      label: 'Usuario',
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        
        return (
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
                  <RoleIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              {onAvatarEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-accent"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAvatarEdit(user)
                        }}
                      >
                        <Camera className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cambiar foto de perfil</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                {!user.isActive && (
                  <Badge variant="secondary" className="text-xs">
                    Inactivo
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        )
      },
      width: '300px'
    },
    {
      key: 'role',
      label: 'Rol',
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        
        return (
          <Badge className={`${USER_ROLE_COLORS[user.role]} flex items-center space-x-1 w-fit`}>
            <RoleIcon className="h-3 w-3" />
            <span>{USER_ROLE_LABELS[user.role]}</span>
          </Badge>
        )
      },
      width: '120px'
    },
    {
      key: 'department',
      label: 'Departamento',
      render: (user: UserData) => {
        if (!user.department) {
          return <span className="text-muted-foreground text-sm">Sin asignar</span>
        }
        
        if (typeof user.department === 'string') {
          return <span className="text-sm">{user.department}</span>
        }
        
        return (
          <div className="flex items-center space-x-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: user.department.color }}
            />
            <span className="text-sm">{user.department.name}</span>
          </div>
        )
      },
      width: '150px'
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (user: UserData) => (
        <span className="text-sm">
          {user.phone || <span className="text-muted-foreground">No especificado</span>}
        </span>
      ),
      width: '120px'
    },
    {
      key: 'tickets',
      label: 'Tickets',
      render: (user: UserData) => {
        const createdCount = user._count?.tickets_tickets_createdByIdTousers || 0
        const assignedCount = user._count?.tickets_tickets_assigneeIdTousers || 0
        
        return (
          <div className="text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Creados:</span>
              <Badge variant="outline" className="text-xs">
                {createdCount}
              </Badge>
            </div>
            {user.role === 'TECHNICIAN' && (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-muted-foreground">Asignados:</span>
                <Badge variant="outline" className="text-xs">
                  {assignedCount}
                </Badge>
              </div>
            )}
          </div>
        )
      },
      width: '120px'
    },
    {
      key: 'lastLogin',
      label: 'Último Acceso',
      render: (user: UserData) => (
        <div className="text-sm">
          {user.lastLogin ? (
            <span>{formatTimeAgo(user.lastLogin)}</span>
          ) : (
            <span className="text-muted-foreground">Nunca</span>
          )}
        </div>
      ),
      width: '120px'
    },
    {
      key: 'createdAt',
      label: 'Creado',
      render: (user: UserData) => (
        <span className="text-sm text-muted-foreground">
          {formatTimeAgo(user.createdAt)}
        </span>
      ),
      width: '100px'
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (user: UserData) => (
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menú</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Acciones del usuario</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            
            {onUserDetails && (
              <DropdownMenuItem onClick={() => onUserDetails(user)}>
                <Eye className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Ver Detalles</span>
                  <span className="text-xs text-muted-foreground">Información completa del usuario</span>
                </div>
              </DropdownMenuItem>
            )}
            
            {onUserEdit && (
              <DropdownMenuItem onClick={() => onUserEdit(user)}>
                <Edit className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Editar Usuario</span>
                  <span className="text-xs text-muted-foreground">Modificar información y permisos</span>
                </div>
              </DropdownMenuItem>
            )}
            
            {onToggleStatus && (
              <DropdownMenuItem onClick={() => onToggleStatus(user)}>
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Desactivar</span>
                      <span className="text-xs text-muted-foreground">Bloquear acceso al sistema</span>
                    </div>
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Activar</span>
                      <span className="text-xs text-muted-foreground">Permitir acceso al sistema</span>
                    </div>
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            {onUserDelete && user.id !== currentUserId && (
              <DropdownMenuItem 
                onClick={() => onUserDelete(user)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Eliminar Usuario</span>
                  <span className="text-xs text-muted-foreground">Eliminar permanentemente</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: '80px'
    }
  ]
}

// Componente de tarjeta para vista de cards
export function UserCard({ 
  user, 
  onEdit, 
  onDelete, 
  onDetails, 
  onAvatarEdit,
  onToggleStatus,
  currentUserId 
}: {
  user: UserData
  onEdit?: (user: UserData) => void
  onDelete?: (user: UserData) => void
  onDetails?: (user: UserData) => void
  onAvatarEdit?: (user: UserData) => void
  onToggleStatus?: (user: UserData) => void
  currentUserId?: string
}) {
  const RoleIcon = USER_ROLE_ICONS[user.role]
  const createdCount = user._count?.tickets_tickets_createdByIdTousers || 0
  const assignedCount = user._count?.tickets_tickets_assigneeIdTousers || 0
  
  return (
    <div className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
                <RoleIcon className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            {onAvatarEdit && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-background border shadow-sm hover:bg-accent"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAvatarEdit(user)
                      }}
                    >
                      <Camera className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cambiar foto de perfil</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-medium text-foreground">{user.name}</h3>
              {!user.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactivo
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.phone && (
              <p className="text-sm text-muted-foreground">{user.phone}</p>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Acciones del usuario</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            
            {onDetails && (
              <DropdownMenuItem onClick={() => onDetails(user)}>
                <Eye className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Ver Detalles</span>
                  <span className="text-xs text-muted-foreground">Información completa del usuario</span>
                </div>
              </DropdownMenuItem>
            )}
            
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(user)}>
                <Edit className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Editar Usuario</span>
                  <span className="text-xs text-muted-foreground">Modificar información y permisos</span>
                </div>
              </DropdownMenuItem>
            )}
            
            {onToggleStatus && (
              <DropdownMenuItem onClick={() => onToggleStatus(user)}>
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Desactivar</span>
                      <span className="text-xs text-muted-foreground">Bloquear acceso al sistema</span>
                    </div>
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    <div className="flex flex-col">
                      <span>Activar</span>
                      <span className="text-xs text-muted-foreground">Permitir acceso al sistema</span>
                    </div>
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            {onDelete && user.id !== currentUserId && (
              <DropdownMenuItem 
                onClick={() => onDelete(user)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>Eliminar Usuario</span>
                  <span className="text-xs text-muted-foreground">Eliminar permanentemente</span>
                </div>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Rol:</span>
          <Badge className={`${USER_ROLE_COLORS[user.role]} flex items-center space-x-1`}>
            <RoleIcon className="h-3 w-3" />
            <span>{USER_ROLE_LABELS[user.role]}</span>
          </Badge>
        </div>
        
        {user.department && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Departamento:</span>
            <div className="flex items-center space-x-2">
              {typeof user.department !== 'string' && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: user.department.color }}
                />
              )}
              <span className="text-sm">
                {typeof user.department === 'string' ? user.department : user.department.name}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Tickets creados:</span>
          <Badge variant="outline" className="text-xs">
            {createdCount}
          </Badge>
        </div>
        
        {user.role === 'TECHNICIAN' && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Tickets asignados:</span>
            <Badge variant="outline" className="text-xs">
              {assignedCount}
            </Badge>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Último acceso:</span>
          <span className="text-sm">
            {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Nunca'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Creado:</span>
          <span className="text-sm">{formatTimeAgo(user.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}