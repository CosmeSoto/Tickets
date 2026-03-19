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
  UserCog,
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
  onPromoteUser?: (user: UserData) => void
  currentUserId?: string
}

export function createUserColumns({
  onUserEdit,
  onUserDelete,
  onUserDetails,
  onAvatarEdit,
  onToggleStatus,
  onPromoteUser,
  currentUserId
}: UserColumnsProps = {}) {
  return [
    {
      key: 'user',
      label: 'Usuario',
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        
        return (
          <div className="flex items-center space-x-2 min-w-0">
            <div className="relative flex-shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className={USER_ROLE_COLORS[user.role]}>
                  <RoleIcon className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              {onAvatarEdit && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm hover:bg-accent p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          onAvatarEdit(user)
                        }}
                      >
                        <Camera className="h-2.5 w-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Cambiar foto</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5">
                <p className="text-sm font-medium text-foreground truncate">
                  {user.name}
                </p>
                {!user.isActive && (
                  <Badge variant="secondary" className="text-xs flex-shrink-0">
                    Inactivo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        )
      },
      width: '250px'
    },
    {
      key: 'role',
      label: 'Rol',
      render: (user: UserData) => {
        const RoleIcon = USER_ROLE_ICONS[user.role]
        
        return (
          <Badge className={`${USER_ROLE_COLORS[user.role]} flex items-center space-x-1 w-fit text-xs`}>
            <RoleIcon className="h-3 w-3" />
            <span>{USER_ROLE_LABELS[user.role]}</span>
          </Badge>
        )
      },
      width: '100px'
    },
    {
      key: 'department',
      label: 'Departamento',
      render: (user: UserData) => {
        if (!user.department) {
          return <span className="text-muted-foreground text-xs">-</span>
        }
        
        if (typeof user.department === 'string') {
          return <span className="text-xs truncate">{user.department}</span>
        }
        
        return (
          <div className="flex items-center space-x-1.5 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: user.department.color }}
            />
            <span className="text-xs truncate">{user.department.name}</span>
          </div>
        )
      },
      width: '130px'
    },
    {
      key: 'phone',
      label: 'Teléfono',
      render: (user: UserData) => (
        <span className="text-xs">
          {user.phone || <span className="text-muted-foreground">-</span>}
        </span>
      ),
      width: '110px'
    },
    {
      key: 'tickets',
      label: 'Tickets',
      render: (user: UserData) => {
        const createdCount = user._count?.tickets_tickets_createdByIdTousers || 0
        const assignedCount = user._count?.tickets_tickets_assigneeIdTousers || 0
        
        return (
          <div className="text-xs space-y-0.5">
            <div className="flex items-center space-x-1.5">
              <span className="text-muted-foreground">C:</span>
              <Badge variant="outline" className="text-xs h-5 px-1.5">
                {createdCount}
              </Badge>
            </div>
            {user.role === 'TECHNICIAN' && (
              <div className="flex items-center space-x-1.5">
                <span className="text-muted-foreground">A:</span>
                <Badge variant="outline" className="text-xs h-5 px-1.5">
                  {assignedCount}
                </Badge>
              </div>
            )}
          </div>
        )
      },
      width: '80px'
    },
    {
      key: 'lastLogin',
      label: 'Último Acceso',
      render: (user: UserData) => (
        <div className="text-xs">
          {user.lastLogin ? (
            <span className="truncate">{formatTimeAgo(user.lastLogin)}</span>
          ) : (
            <span className="text-muted-foreground">Nunca</span>
          )}
        </div>
      ),
      width: '100px'
    },
    {
      key: 'createdAt',
      label: 'Creado',
      render: (user: UserData) => (
        <span className="text-xs text-muted-foreground truncate">
          {formatTimeAgo(user.createdAt)}
        </span>
      ),
      width: '90px'
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
                  <Button 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="sr-only">Abrir menú</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Acciones</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            
            {onUserDetails && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onUserDetails(user)
              }}>
                <Eye className="mr-2 h-4 w-4" />
                <span>Ver Detalles</span>
              </DropdownMenuItem>
            )}
            
            {onUserEdit && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onUserEdit(user)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Editar Usuario</span>
              </DropdownMenuItem>
            )}
            
            {onToggleStatus && user.id !== currentUserId && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onToggleStatus(user)
              }}>
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    <span>Desactivar</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    <span>Activar</span>
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            {/* Promover a Técnico - Solo para usuarios CLIENT activos */}
            {/* {onPromoteUser && user.role === 'CLIENT' && user.isActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => {
                  e.stopPropagation()
                  onPromoteUser(user)
                }} className="text-blue-600">
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Promover a Técnico</span>
                </DropdownMenuItem>
              </>
            )} en el modulo tickets ya tiene promover*/}
            
            <DropdownMenuSeparator />
            
            {onUserDelete && user.id !== currentUserId && (
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onUserDelete(user)
                }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Eliminar Usuario</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      width: '70px'
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
    <div 
      className="p-4 border rounded-lg hover:shadow-md transition-shadow bg-card cursor-pointer"
      onClick={() => onDetails && onDetails(user)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2.5">
          <div className="relative flex-shrink-0">
            <Avatar className="h-11 w-11">
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
                      className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm hover:bg-accent p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAvatarEdit(user)
                      }}
                    >
                      <Camera className="h-2.5 w-2.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Cambiar foto</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <h3 className="font-medium text-foreground text-sm">{user.name}</h3>
              {!user.isActive && (
                <Badge variant="secondary" className="text-xs">
                  Inactivo
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            {user.phone && (
              <p className="text-xs text-muted-foreground">{user.phone}</p>
            )}
          </div>
        </div>
        
        <DropdownMenu>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="h-7 w-7 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>Acciones</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            
            {onDetails && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onDetails(user)
              }}>
                <Eye className="mr-2 h-4 w-4" />
                <span>Ver Detalles</span>
              </DropdownMenuItem>
            )}
            
            {onEdit && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onEdit(user)
              }}>
                <Edit className="mr-2 h-4 w-4" />
                <span>Editar Usuario</span>
              </DropdownMenuItem>
            )}
            
            {onToggleStatus && user.id !== currentUserId && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onToggleStatus(user)
              }}>
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    <span>Desactivar</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    <span>Activar</span>
                  </>
                )}
              </DropdownMenuItem>
            )}
            
            <DropdownMenuSeparator />
            
            {onDelete && user.id !== currentUserId && (
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(user)
                }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                <span>Eliminar Usuario</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Rol:</span>
          <Badge className={`${USER_ROLE_COLORS[user.role]} flex items-center space-x-1 text-xs`}>
            <RoleIcon className="h-3 w-3" />
            <span>{USER_ROLE_LABELS[user.role]}</span>
          </Badge>
        </div>
        
        {user.department && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Departamento:</span>
            <div className="flex items-center space-x-1.5">
              {typeof user.department !== 'string' && (
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: user.department.color }}
                />
              )}
              <span className="text-xs">
                {typeof user.department === 'string' ? user.department : user.department.name}
              </span>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Tickets creados:</span>
          <Badge variant="outline" className="text-xs h-5 px-1.5">
            {createdCount}
          </Badge>
        </div>
        
        {user.role === 'TECHNICIAN' && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tickets asignados:</span>
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              {assignedCount}
            </Badge>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Último acceso:</span>
          <span className="text-xs">
            {user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Nunca'}
          </span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Creado:</span>
          <span className="text-xs">{formatTimeAgo(user.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}