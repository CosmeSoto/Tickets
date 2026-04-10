'use client'

import { Card, CardContent } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Shield, 
  Wrench,
  UserCircle,
  Camera,
  Eye,
  EyeOff,
  AlertTriangle,
  Edit, 
  Trash2,
  Clock,
  Calendar,
  Ticket
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSession } from 'next-auth/react'
import { USER_ROLE_ICONS, type UserRole } from '@/lib/constants/user-constants'
import { RoleBadge } from '@/components/ui/role-badge'

interface UserStatsCardProps {
  user: {
    id: string
    name: string
    email: string
    phone?: string
    role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
    departmentId?: string
    department?: {
      id: string
      name: string
      color: string
      description?: string
    } | string
    isActive: boolean
    avatar?: string
    createdAt?: string
    lastLogin?: string
    _count: {
      tickets_tickets_createdByIdTousers: number
      tickets_tickets_assigneeIdTousers: number
    }
    canDelete?: boolean
  }
  onEdit: () => void
  onDelete: () => void
  onDetails: () => void
  onAvatarClick: (e: React.MouseEvent) => void
  canDelete?: boolean
  showDetailedStats?: boolean
}

export function UserStatsCard({
  user,
  onEdit,
  onDelete,
  onDetails,
  onAvatarClick,
  canDelete = true,
  showDetailedStats = true
}: UserStatsCardProps) {
  const { data: session } = useSession()
  const RoleIcon = USER_ROLE_ICONS[user.role as UserRole]
  
  // Formatear fecha de último acceso
  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return 'Nunca'
    
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 60) return `${minutes}min`
    if (hours < 24) return `${hours}h`
    if (days === 1) return 'Ayer'
    if (days < 30) return `${days}d`
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
  }

  // Formatear fecha de creación
  const formatCreatedAt = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Determinar si el usuario actual puede modificar este usuario
  const isCurrentUser = user.id === session?.user?.id
  const canModifyStatus = !isCurrentUser || !user.isActive
  const canDeleteUser = canDelete && !isCurrentUser

  // Función para manejar cambio de estado con validaciones
  const handleStatusToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (isCurrentUser && user.isActive) {
      // No permitir que el admin se desactive a sí mismo
      return
    }
    
    // Aquí iría la lógica de cambio de estado
    // Por ahora solo prevenimos la acción para el usuario actual
  }

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all duration-200 border-l-4 w-full cursor-pointer relative",
      user.isActive 
        ? "border-l-green-500 hover:border-l-green-600"
        : "border-l-gray-400 bg-muted"
    )}
    onClick={onDetails}
    >
      <CardContent className="p-3">
        {/* Indicador de clic */}
        <div className="absolute top-2 right-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          Clic
        </div>
        
        {/* Header con avatar y estado */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className="relative group/avatar flex-shrink-0">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className={cn(
                  "text-sm font-semibold",
                  user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                  user.role === 'TECHNICIAN' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                )}>
                  {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Botón de cámara para cambiar avatar */}
              <Button
                size="sm"
                variant="secondary"
                className="absolute inset-0 opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-full bg-black/50 hover:bg-black/70 text-white border-0 p-0"
                onClick={onAvatarClick}
              >
                <Camera className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={cn(
                  "font-semibold text-foreground text-sm truncate max-w-[120px]",
                  !user.isActive && "text-muted-foreground"
                )} title={user.name}>
                  {user.name}
                </h3>
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200 flex-shrink-0">
                    Tú
                  </Badge>
                )}
              </div>
              <div className="flex items-center space-x-1 flex-wrap gap-1">
                <RoleBadge role={user.role} isSuperAdmin={(user as any).isSuperAdmin} iconSize="sm" />
              </div>
            </div>
          </div>
          
          {/* Indicador de estado */}
          <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              user.isActive ? "bg-green-500" : "bg-red-500"
            )} />
            <span className={cn(
              "text-xs font-medium whitespace-nowrap",
              user.isActive ? "text-green-600" : "text-red-600"
            )}>
              {user.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground min-w-0">
            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate flex-1" title={user.email}>{user.email}</span>
          </div>
          
          {user.phone && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground min-w-0">
              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{user.phone}</span>
            </div>
          )}
          
          {user.department && (
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <Building className="h-3 w-3 flex-shrink-0" style={{ 
                color: typeof user.department === 'object' ? user.department.color : '#6B7280' 
              }} />
              <Badge 
                variant="outline" 
                className="text-xs truncate max-w-[140px]"
                style={{ 
                  borderColor: typeof user.department === 'object' ? user.department.color : '#6B7280',
                  color: typeof user.department === 'object' ? user.department.color : '#6B7280'
                }}
                title={typeof user.department === 'object' ? user.department.name : user.department}
              >
                {typeof user.department === 'object' ? user.department.name : user.department}
              </Badge>
            </div>
          )}
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Ticket className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Creados</span>
            </div>
            <div className="text-sm font-bold text-blue-700">{user._count.tickets_tickets_createdByIdTousers || 0}</div>
            <div className="text-xs text-muted-foreground">tickets</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <User className="h-3 w-3 text-green-600" />
              <span className="text-xs font-medium text-green-600">Asignados</span>
            </div>
            <div className="text-sm font-bold text-green-700">{user._count.tickets_tickets_assigneeIdTousers || 0}</div>
            <div className="text-xs text-muted-foreground">tickets</div>
          </div>
        </div>

        {/* Información de actividad */}
        <div className="space-y-1 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Último acceso:</span>
            </div>
            <span className="font-medium">{formatLastLogin(user.lastLogin)}</span>
          </div>
          
          {user.createdAt && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Registrado:</span>
              </div>
              <span className="font-medium">{formatCreatedAt(user.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Alertas y restricciones */}
        {isCurrentUser && (
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 flex-1 min-w-0">
                <div className="font-medium mb-1">Tu cuenta actual</div>
                <div className="text-xs">No puedes desactivarte o eliminarte</div>
              </div>
            </div>
          </div>
        )}

        {!canDeleteUser && !isCurrentUser && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 flex-1 min-w-0">
                <div className="font-medium mb-1">Usuario protegido</div>
                <div className="text-xs">Tiene tickets o datos relacionados</div>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="flex items-center space-x-1 flex-1 min-w-0">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-medium flex-shrink-0",
              user.isActive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            )}>
              {user.isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-xs font-medium transition-colors"
            >
              Editar
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              disabled={!canDeleteUser}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                canDeleteUser
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-muted text-muted-foreground cursor-not-allowed"
              )}
              title={
                !canDeleteUser 
                  ? isCurrentUser 
                    ? "No puedes eliminarte a ti mismo"
                    : "No se puede eliminar: tiene datos relacionados"
                  : "Eliminar usuario"
              }
            >
              Eliminar
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}