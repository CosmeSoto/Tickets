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
import { 
  User, 
  Layers, 
  Target, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  RefreshCw,
  Users,
  Ticket,
  TrendingUp,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TechnicianAssignmentsModalProps {
  isOpen: boolean
  onClose: () => void
  technicianId: string
  technicianName: string
}

interface CategoryAssignment {
  id: string
  priority: number
  maxTickets: number
  autoAssign: boolean
  isActive: boolean
  createdAt: string
  category: {
    id: string
    name: string
    level: number
    color: string
    levelName: string
    description?: string
  }
  currentTickets?: number
  utilization?: number
}

interface AssignmentStats {
  totalAssignments: number
  activeAssignments: number
  totalMaxTickets: number
  currentTickets: number
  avgUtilization: number
  byLevel: {
    [key: number]: {
      count: number
      maxTickets: number
      currentTickets: number
    }
  }
  performance?: {
    resolvedThisMonth: number
    avgResolutionHours: number
    totalResolved: number
    totalClosed: number
    efficiency: number
  }
}

export function TechnicianAssignmentsModal({
  isOpen,
  onClose,
  technicianId,
  technicianName
}: TechnicianAssignmentsModalProps) {
  const [assignments, setAssignments] = useState<CategoryAssignment[]>([])
  const [stats, setStats] = useState<AssignmentStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && technicianId) {
      loadAssignments()
    }
  }, [isOpen, technicianId])

  const loadAssignments = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/users/${technicianId}/assignments`)
      
      if (!response.ok) {
        throw new Error('Error al cargar asignaciones')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setAssignments(data.assignments || [])
        setStats(data.stats || null)
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      console.error('Error loading assignments:', err)
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
      setAssignments([])
      setStats(null)
    } finally {
      setLoading(false)
    }
  }

  const getPriorityColor = (priority: number) => {
    if (priority <= 3) return 'bg-red-100 text-red-800 border-red-200'
    if (priority <= 6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-green-100 text-green-800 border-green-200'
  }

  const getPriorityLabel = (priority: number) => {
    if (priority <= 3) return 'Alta'
    if (priority <= 6) return 'Media'
    return 'Baja'
  }

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'text-red-600 bg-red-50'
    if (utilization >= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <Layers className="h-4 w-4" />
      case 2: return <Target className="h-4 w-4" />
      case 3: return <BarChart3 className="h-4 w-4" />
      case 4: return <Activity className="h-4 w-4" />
      default: return <Layers className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col sm:max-w-[95vw]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Asignaciones de {technicianName}</span>
          </DialogTitle>
          <DialogDescription>
            Categorías asignadas y estadísticas de carga de trabajo
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-muted-foreground">Cargando asignaciones...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Error al cargar datos</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadAssignments} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Estadísticas generales */}
            {stats && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-5 w-5 text-blue-600" />
                        <div>
                          <div className="text-2xl font-bold text-blue-600">{stats.activeAssignments}</div>
                          <div className="text-xs text-muted-foreground">Especialidades Activas</div>
                          <div className="text-xs text-muted-foreground">Categorías asignadas</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Ticket className="h-5 w-5 text-green-600" />
                        <div>
                          <div className="text-2xl font-bold text-green-600">{stats.currentTickets}</div>
                          <div className="text-xs text-muted-foreground">Tickets en Proceso</div>
                          <div className="text-xs text-muted-foreground">Abiertos + En progreso</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Target className="h-5 w-5 text-purple-600" />
                        <div>
                          <div className="text-2xl font-bold text-purple-600">{stats.totalMaxTickets}</div>
                          <div className="text-xs text-muted-foreground">Límite Máximo</div>
                          <div className="text-xs text-muted-foreground">Tickets concurrentes</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-5 w-5 text-orange-600" />
                        <div>
                          <div className="text-2xl font-bold text-orange-600">{stats.avgUtilization.toFixed(0)}%</div>
                          <div className="text-xs text-muted-foreground">Carga de Trabajo</div>
                          <div className="text-xs text-muted-foreground">
                            {stats.currentTickets}/{stats.totalMaxTickets} tickets
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Estadísticas de rendimiento */}
                {stats.performance && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
                      <BarChart3 className="h-5 w-5" />
                      <span>Rendimiento y Productividad</span>
                    </h3>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <div className="text-2xl font-bold text-green-600">{stats.performance.resolvedThisMonth}</div>
                              <div className="text-xs text-muted-foreground">Resueltos Este Mes</div>
                              <div className="text-xs text-muted-foreground">Tickets completados</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            <div>
                              <div className="text-2xl font-bold text-blue-600">
                                {stats.performance.avgResolutionHours > 0 
                                  ? `${stats.performance.avgResolutionHours}h` 
                                  : '-'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">Tiempo Promedio</div>
                              <div className="text-xs text-muted-foreground">Resolución (30 días)</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <Activity className="h-5 w-5 text-purple-600" />
                            <div>
                              <div className="text-2xl font-bold text-purple-600">{stats.performance.totalResolved}</div>
                              <div className="text-xs text-muted-foreground">Total Resueltos</div>
                              <div className="text-xs text-muted-foreground">Histórico completo</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-2">
                            <TrendingUp className="h-5 w-5 text-orange-600" />
                            <div>
                              <div className="text-2xl font-bold text-orange-600">{stats.performance.efficiency}%</div>
                              <div className="text-xs text-muted-foreground">Eficiencia Mensual</div>
                              <div className="text-xs text-muted-foreground">Resueltos vs capacidad</div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Lista de asignaciones */}
            {assignments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium text-foreground mb-2">Sin asignaciones</h3>
                <p className="text-muted-foreground">
                  Este técnico no tiene categorías asignadas actualmente
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Asignaciones por Categoría ({assignments.length})</span>
                </h3>
                
                <div className="grid gap-4">
                  {assignments.map(assignment => {
                    const utilization = assignment.utilization || 0
                    return (
                      <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: assignment.category.color }}
                              />
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <h4 className="font-semibold text-foreground truncate">
                                    {assignment.category.name}
                                  </h4>
                                  <Badge variant="outline" className="text-xs">
                                    {getLevelIcon(assignment.category.level)}
                                    <span className="ml-1">Nivel {assignment.category.level}</span>
                                  </Badge>
                                  <Badge className={cn("text-xs", getPriorityColor(assignment.priority))}>
                                    Prioridad {getPriorityLabel(assignment.priority)}
                                  </Badge>
                                </div>
                                
                                {assignment.category.description && (
                                  <p className="text-sm text-muted-foreground mb-3 truncate">
                                    {assignment.category.description}
                                  </p>
                                )}
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <div className="text-muted-foreground">Capacidad</div>
                                    <div className="font-medium">{assignment.maxTickets} tickets</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Actuales</div>
                                    <div className="font-medium">{assignment.currentTickets || 0} tickets</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Utilización</div>
                                    <div className={cn("font-medium", getUtilizationColor(utilization))}>
                                      {utilization.toFixed(0)}%
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Auto-asignación</div>
                                    <div className="flex items-center space-x-1">
                                      {assignment.autoAssign ? (
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      <span className="font-medium">
                                        {assignment.autoAssign ? 'Activa' : 'Manual'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            <div className={cn(
                              "flex items-center space-x-2 p-2 rounded-lg flex-shrink-0 ml-4",
                              getUtilizationColor(utilization)
                            )}>
                              {utilization >= 90 ? (
                                <AlertCircle className="h-4 w-4" />
                              ) : utilization >= 70 ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              <span className="text-sm font-medium">
                                {utilization >= 90 ? 'Sobrecargado' : 
                                 utilization >= 70 ? 'Ocupado' : 'Disponible'}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}