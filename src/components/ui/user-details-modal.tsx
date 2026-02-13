'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { useToast } from '@/hooks/use-toast'
import { 
  User, 
  Ticket, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Calendar,
  TrendingUp,
  Activity,
  BarChart3,
  RefreshCw,
  Edit,
  Trash2
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canDelete?: boolean
}

interface TicketStats {
  total: number
  created: number
  assigned: number
  byStatus: {
    OPEN: number
    IN_PROGRESS: number
    RESOLVED: number
    CLOSED: number
  }
  byPriority: {
    LOW: number
    MEDIUM: number
    HIGH: number
    URGENT: number
  }
  avgResolutionTime: number
  thisMonth: number
  lastMonth: number
  trend: 'up' | 'down' | 'stable'
}

interface RecentTicket {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
  updatedAt: string
  category?: {
    name: string
    color: string
  }
}

const statusLabels = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En Progreso',
  RESOLVED: 'Resuelto',
  CLOSED: 'Cerrado'
}

const statusColors = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-muted text-foreground'
}

const priorityLabels = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente'
}

const priorityColors = {
  LOW: 'bg-muted text-foreground',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800'
}

export function UserDetailsModal({ 
  isOpen, 
  onClose, 
  userId, 
  userName, 
  onEdit, 
  onDelete, 
  canEdit = true, 
  canDelete = true 
}: UserDetailsModalProps) {
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([])
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (isOpen && userId) {
      loadUserDetails()
    }
  }, [isOpen, userId])

  const loadUserDetails = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Cargar estadísticas del usuario
      const statsResponse = await fetch(`/api/users/${userId}/stats`)
      if (!statsResponse.ok) throw new Error('Error al cargar estadísticas')
      
      const statsData = await statsResponse.json()
      setStats(statsData.data)

      // Cargar tickets recientes
      const ticketsResponse = await fetch(`/api/users/${userId}/tickets?limit=10`)
      if (!ticketsResponse.ok) throw new Error('Error al cargar tickets')
      
      const ticketsData = await ticketsResponse.json()
      setRecentTickets(ticketsData.data || [])
      
      // Eliminado el toast molesto - los datos se cargan silenciosamente
      
    } catch (error) {
      console.error('Error loading user details:', error)
      setError('Error al cargar los detalles del usuario')
      
      toast({
        title: 'Error al cargar detalles',
        description: 'No se pudieron cargar los detalles del usuario',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (hours: number) => {
    if (hours < 24) return `${hours.toFixed(1)}h`
    const days = Math.floor(hours / 24)
    return `${days}d ${(hours % 24).toFixed(0)}h`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Detalles de {userName}</span>
              </DialogTitle>
              <DialogDescription>
                Información detallada de tickets y actividad del usuario
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              {canEdit && onEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEdit()
                    onClose()
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              {canDelete && onDelete && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDelete()
                    onClose()
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-muted-foreground">Cargando detalles...</span>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadUserDetails} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* Estadísticas generales */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Ticket className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-muted-foreground">Total</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-muted-foreground">Este Mes</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{stats.thisMonth}</div>
                  <div className="flex items-center justify-center space-x-1 mt-1">
                    <TrendingUp className={cn(
                      "h-3 w-3",
                      stats.trend === 'up' ? 'text-green-500' :
                      stats.trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                    )} />
                    <span className="text-xs text-muted-foreground">
                      vs {stats.lastMonth} anterior
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    <span className="text-sm font-medium text-muted-foreground">Tiempo Prom.</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatDuration(stats.avgResolutionTime)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-medium text-muted-foreground">Resueltos</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">
                    {stats.byStatus.RESOLVED + stats.byStatus.CLOSED}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Distribución por estado y prioridad */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5" />
                    <span>Por Estado</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.byStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className={cn("text-xs", statusColors[status as keyof typeof statusColors])}>
                            {statusLabels[status as keyof typeof statusLabels]}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium">{count}</div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>Por Prioridad</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.byPriority).map(([priority, count]) => (
                      <div key={priority} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge className={cn("text-xs", priorityColors[priority as keyof typeof priorityColors])}>
                            {priorityLabels[priority as keyof typeof priorityLabels]}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium">{count}</div>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-600 h-2 rounded-full"
                              style={{ width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tickets recientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Tickets Recientes</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentTickets.length > 0 ? (
                  <div className="space-y-3">
                    {recentTickets.map(ticket => (
                      <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">
                              {ticket.title}
                            </h4>
                            {ticket.category && (
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: ticket.category.color }}
                                title={ticket.category.name}
                              />
                            )}
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <span>Creado: {formatDate(ticket.createdAt)}</span>
                            <span>•</span>
                            <span>Actualizado: {formatDate(ticket.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <Badge className={cn("text-xs", statusColors[ticket.status as keyof typeof statusColors])}>
                            {statusLabels[ticket.status as keyof typeof statusLabels]}
                          </Badge>
                          <Badge className={cn("text-xs", priorityColors[ticket.priority as keyof typeof priorityColors])}>
                            {priorityLabels[ticket.priority as keyof typeof priorityLabels]}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p>No hay tickets recientes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}