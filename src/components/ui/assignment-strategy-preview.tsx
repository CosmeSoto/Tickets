'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'
import { Button } from './button'
import { 
  Users, 
  Target, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  BarChart3
} from 'lucide-react'

interface AssignmentPreview {
  selectedTechnician: {
    id: string
    name: string
    email: string
    priority: number
    maxTickets: number
    currentTickets: number
    categoryLevel: number
    categoryName: string
  } | null
  strategy: {
    categoryId: string
    categoryLevel: number
    categoryPath: string[]
    availableTechnicians: any[]
  }
  reason: string
}

interface AssignmentStats {
  technicianId: string
  technicianName: string
  priority: number
  maxTickets: number
  currentTickets: number
  utilization: number
  autoAssign: boolean
}

interface AssignmentStrategyPreviewProps {
  categoryId: string | null
  categoryLevel: number
  onSimulate?: () => void
}

export function AssignmentStrategyPreview({ 
  categoryId, 
  categoryLevel,
  onSimulate 
}: AssignmentStrategyPreviewProps) {
  const [preview, setPreview] = useState<AssignmentPreview | null>(null)
  const [stats, setStats] = useState<AssignmentStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simular asignación
  const simulateAssignment = async () => {
    if (!categoryId) return

    setLoading(true)
    setError(null)

    try {
      const [previewResponse, statsResponse] = await Promise.all([
        fetch(`/api/technicians/simulate-assignment?categoryId=${categoryId}`),
        fetch(`/api/technicians/assignment-stats?categoryId=${categoryId}`)
      ])

      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        setPreview(previewData.data)
      }

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.data || [])
      }

      onSimulate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al simular asignación')
    } finally {
      setLoading(false)
    }
  }

  // Simular automáticamente cuando cambia la categoría
  useEffect(() => {
    if (categoryId) {
      simulateAssignment()
    } else {
      setPreview(null)
      setStats([])
    }
  }, [categoryId])

  if (!categoryId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4 text-muted-foreground">
            <Target className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p>Selecciona una categoría para ver la estrategia de asignación</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Simulación de Asignación */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <span>Simulación de Asignación Automática</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={simulateAssignment}
              disabled={loading}
            >
              {loading ? 'Simulando...' : 'Actualizar'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-muted-foreground">Simulando asignación...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {preview.selectedTechnician ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                      <div>
                        <div className="font-medium text-green-900">
                          {preview.selectedTechnician.name}
                        </div>
                        <div className="text-sm text-green-700">
                          {preview.selectedTechnician.email}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {preview.reason}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant="default" className="mb-1">
                        Prioridad {preview.selectedTechnician.priority}
                      </Badge>
                      <div className="text-xs text-green-600">
                        Nivel {preview.selectedTechnician.categoryLevel}
                      </div>
                      <div className="text-xs text-green-600">
                        {preview.selectedTechnician.currentTickets}/{preview.selectedTechnician.maxTickets} tickets
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <div>
                      <div className="font-medium text-yellow-900">
                        No hay técnicos disponibles
                      </div>
                      <div className="text-sm text-yellow-700">
                        {preview.reason}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Información de la estrategia */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm">
                  <div className="font-medium text-blue-900 mb-2">
                    Estrategia de Cascada Jerárquica:
                  </div>
                  <div className="space-y-1 text-blue-700">
                    <div>• Categoría objetivo: Nivel {preview.strategy.categoryLevel}</div>
                    <div>• Técnicos evaluados: {preview.strategy.availableTechnicians.length}</div>
                    <div>• Niveles en cascada: {preview.strategy.categoryPath.length}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Estadísticas de Asignación */}
      {stats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <span>Estadísticas de Técnicos Asignados</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.map(stat => (
                <div key={stat.technicianId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <Badge variant={stat.priority <= 2 ? 'default' : 'secondary'}>
                        P{stat.priority}
                      </Badge>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">
                        {stat.technicianName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {stat.currentTickets}/{stat.maxTickets} tickets asignados
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {stat.utilization.toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Utilización
                      </div>
                    </div>
                    
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          stat.utilization >= 90 ? 'bg-red-500' :
                          stat.utilization >= 70 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(stat.utilization, 100)}%` }}
                      />
                    </div>
                    
                    <Badge variant={stat.autoAssign ? 'default' : 'outline'}>
                      {stat.autoAssign ? 'Auto' : 'Manual'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Resumen */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {stats.length}
                  </div>
                  <div className="text-xs text-muted-foreground">Técnicos</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {(stats.reduce((sum, s) => sum + s.utilization, 0) / stats.length).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground">Utilización Promedio</div>
                </div>
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {stats.filter(s => s.autoAssign).length}
                  </div>
                  <div className="text-xs text-muted-foreground">Auto-asignación</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}