'use client'

import { Card, CardContent } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { 
  User, 
  Users, 
  Star, 
  Zap, 
  Mail, 
  Phone, 
  Building, 
  Edit, 
  Trash2,
  BarChart3,
  Clock,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Ticket,
  Wrench,
  Shield,
  UserCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TechnicianStatsCardProps {
  technician: {
    id: string
    name: string
    email: string
    phone?: string
    departmentId?: string
    department?: {
      id: string
      name: string
      color: string
      description?: string
    }
    isActive: boolean
    createdAt?: string
    lastLogin?: string
    role?: string
    _count?: {
      assignedTickets: number
      technicianAssignments: number
    }
    technicianAssignments?: {
      id: string
      priority: number
      maxTickets?: number
      autoAssign: boolean
      category: {
        id: string
        name: string
        level: number
        color: string
        levelName?: string
      }
    }[]
  }
  onEdit: () => void
  onDelete: () => void
  onDemote?: () => void
  onViewAssignments?: (technician: any) => void
  canDelete?: boolean
  showDetailedStats?: boolean
}

export function TechnicianStatsCard({
  technician,
  onEdit,
  onDelete,
  onDemote,
  onViewAssignments,
  canDelete = true,
  showDetailedStats = true
}: TechnicianStatsCardProps) {
  
  // Calcular estadísticas
  const totalAssignments = technician._count?.technicianAssignments || 0
  const activeTickets = technician._count?.assignedTickets || 0
  const assignments = technician.technicianAssignments || []
  
  // Calcular utilización promedio
  const totalCapacity = assignments.reduce((sum, assignment) => sum + (assignment.maxTickets || 10), 0)
  const avgUtilization = totalCapacity > 0 ? (activeTickets / totalCapacity) * 100 : 0

  // Obtener nivel de experiencia
  const getExperienceLevel = () => {
    if (activeTickets > 50 || totalAssignments > 5) return { 
      level: 'Experto', 
      color: 'bg-purple-100 text-purple-700',
      icon: <Star className="h-6 w-6" />
    }
    if (activeTickets > 20 || totalAssignments > 2) return { 
      level: 'Avanzado', 
      color: 'bg-blue-100 text-blue-700',
      icon: <Zap className="h-6 w-6" />
    }
    return { 
      level: 'Junior', 
      color: 'bg-yellow-100 text-yellow-700',
      icon: <User className="h-6 w-6" />
    }
  }

  // Obtener estado de carga
  const getWorkloadStatus = () => {
    if (avgUtilization >= 90) return {
      status: 'Sobrecargado',
      color: 'text-red-600',
      bgColor: 'bg-red-500'
    }
    if (avgUtilization >= 70) return {
      status: 'Ocupado',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-500'
    }
    return {
      status: 'Disponible',
      color: 'text-green-600',
      bgColor: 'bg-green-500'
    }
  }

  const experience = getExperienceLevel()
  const workload = getWorkloadStatus()

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

  return (
    <Card className={cn(
      "group hover:shadow-md transition-all duration-200 border-l-4 w-full cursor-pointer relative",
      technician.isActive 
        ? "border-l-green-500 hover:border-l-green-600"
        : "border-l-gray-400 bg-muted"
    )}
    onClick={onEdit}
    >
      <CardContent className="p-3">
        {/* Indicador de clic */}
        <div className="absolute top-2 right-2 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
          Clic
        </div>
        {/* Header con avatar y estado */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0",
              "bg-green-100 text-green-800 border-green-200",
              !technician.isActive && "opacity-50"
            )}>
              <Wrench className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className={cn(
                  "font-semibold text-foreground truncate text-sm",
                  !technician.isActive && "text-muted-foreground"
                )}>
                  {technician.name}
                </h3>
              </div>
              <div className="flex items-center space-x-1 flex-wrap gap-1">
                <Badge className="text-xs flex-shrink-0 bg-green-100 text-green-800 border-green-200">
                  Técnico
                </Badge>
                <Badge className={cn("text-xs flex-shrink-0", experience.color)}>
                  {experience.level}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Indicador de estado */}
          <div className="flex flex-col items-end space-y-1 flex-shrink-0 ml-2">
            <div className={cn(
              "w-2 h-2 rounded-full",
              technician.isActive ? workload.bgColor : "bg-red-500"
            )} />
            <span className={cn(
              "text-xs font-medium whitespace-nowrap",
              technician.isActive ? workload.color : "text-red-600"
            )}>
              {technician.isActive ? workload.status : 'Inactivo'}
            </span>
          </div>
        </div>

        {/* Información de contacto */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center space-x-2 text-xs text-muted-foreground min-w-0">
            <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="truncate flex-1">{technician.email}</span>
          </div>
          
          {technician.phone && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground min-w-0">
              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{technician.phone}</span>
            </div>
          )}
          
          {technician.department && (
            <div className="flex items-center space-x-2 text-xs min-w-0">
              <Building className="h-3 w-3 flex-shrink-0" style={{ color: technician.department.color }} />
              <Badge 
                variant="outline" 
                className="text-xs truncate"
                style={{ 
                  borderColor: technician.department.color,
                  color: technician.department.color
                }}
              >
                {technician.department.name}
              </Badge>
            </div>
          )}
        </div>

        {/* Estadísticas principales */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Ticket className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-medium text-blue-600">Proceso</span>
            </div>
            <div className="text-sm font-bold text-blue-700">{activeTickets}</div>
            <div className="text-xs text-muted-foreground">tickets</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <BarChart3 className="h-3 w-3 text-purple-600" />
              <span className="text-xs font-medium text-purple-600">Áreas</span>
            </div>
            <div className="text-sm font-bold text-purple-700">{totalAssignments}</div>
            <div className="text-xs text-muted-foreground">categorías</div>
          </div>
          
          <div className="bg-orange-50 rounded-lg p-2 text-center">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <CheckCircle className="h-3 w-3 text-orange-600" />
              <span className="text-xs font-medium text-orange-600">Carga</span>
            </div>
            <div className="text-sm font-bold text-orange-700">{avgUtilization.toFixed(0)}%</div>
            <div className="text-xs text-muted-foreground">
              {activeTickets}/{totalCapacity}
            </div>
          </div>
        </div>

        {/* Botón Ver Asignaciones si hay asignaciones */}
        {(totalAssignments > 0 || onViewAssignments) && (
          <div className="mb-3">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onViewAssignments?.(technician)
              }}
              className="w-full px-2 py-1 bg-muted hover:bg-gray-200 text-foreground rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1"
            >
              <BarChart3 className="h-3 w-3" />
              <span>
                {totalAssignments > 0 
                  ? `Ver ${totalAssignments} Asignaciones` 
                  : 'Gestionar Asignaciones'
                }
              </span>
            </button>
          </div>
        )}

        {/* Información de actividad */}
        <div className="space-y-1 mb-3 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Último acceso:</span>
            </div>
            <span className="font-medium">{formatLastLogin(technician.lastLogin)}</span>
          </div>
          
          {technician.createdAt && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>Registrado:</span>
              </div>
              <span className="font-medium">{formatCreatedAt(technician.createdAt)}</span>
            </div>
          )}
        </div>

        {/* Alertas y restricciones */}
        {!canDelete && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-3 w-3 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-yellow-700 flex-1 min-w-0">
                <div className="truncate">Tiene tickets o asignaciones activas</div>
              </div>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className={cn(
              "px-2 py-1 rounded-md text-xs font-medium flex-shrink-0",
              technician.isActive
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            )}>
              {technician.isActive ? 'Activo' : 'Inactivo'}
            </span>
            
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
                disabled={!canDelete}
                className={cn(
                  "px-2 py-1 rounded-md text-xs font-medium transition-colors",
                  canDelete
                    ? "bg-red-100 text-red-700 hover:bg-red-200"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
                title={
                  !canDelete 
                    ? "No se puede eliminar: tiene tickets o asignaciones activas"
                    : "Eliminar técnico"
                }
              >
                Eliminar
              </button>
            </div>
          </div>
          
          {/* Botón Convertir a Cliente */}
          {onDemote && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDemote()
              }}
              className="w-full px-2 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md text-xs font-medium transition-colors flex items-center justify-center space-x-1"
              title="Convertir técnico a cliente (requiere resolver todos los tickets y eliminar asignaciones)"
            >
              <UserCircle className="h-3 w-3" />
              <span>Convertir a Cliente</span>
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}