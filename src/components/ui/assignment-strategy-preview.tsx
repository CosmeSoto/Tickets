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
  hierarchyPath?: any[] // Agregar jerarquía para categorías nuevas
  onSimulate?: () => void
}

export function AssignmentStrategyPreview({ 
  categoryId, 
  categoryLevel,
  hierarchyPath = [],
  onSimulate 
}: AssignmentStrategyPreviewProps) {
  const [preview, setPreview] = useState<AssignmentPreview | null>(null)
  const [stats, setStats] = useState<AssignmentStats[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Simular asignación para categorías existentes o nuevas
  const simulateAssignment = async () => {
    setLoading(true)
    setError(null)

    try {
      if (categoryId) {
        // Categoría existente - usar API normal
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
      } else if (hierarchyPath.length > 0) {
        // Categoría nueva - simular basado en jerarquía
        const parentIds = hierarchyPath.slice(0, -1).map(item => item.id).filter(id => id !== 'new')
        
        if (parentIds.length > 0) {
          // Simular usando el último padre válido
          const parentId = parentIds[parentIds.length - 1]
          const response = await fetch(`/api/technicians/simulate-assignment?categoryId=${parentId}&simulateLevel=${categoryLevel}`)
          
          if (response.ok) {
            const data = await response.json()
            setPreview({
              ...data.data,
              reason: `Simulación basada en jerarquía padre (Nivel ${categoryLevel})`
            })
          }
        } else {
          // Categoría de nivel 1 nueva
          setPreview({
            selectedTechnician: null,
            strategy: {
              categoryLevel,
              availableTechnicians: [],
              categoryPath: hierarchyPath
            },
            reason: 'Categoría de nivel 1 - Se asignarán técnicos generalistas'
          })
        }
      }

      onSimulate?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al simular asignación')
    } finally {
      setLoading(false)
    }
  }

  // Simular automáticamente cuando cambia la categoría o jerarquía
  useEffect(() => {
    if (categoryId || hierarchyPath.length > 0) {
      simulateAssignment()
    } else {
      setPreview(null)
      setStats([])
    }
  }, [categoryId, categoryLevel, hierarchyPath])

  return (
    <div className="space-y-3">
      {/* Simulación de Asignación - Compacta */}
      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-muted-foreground">Simulando...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-2 rounded text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : preview ? (
            <div className="space-y-2">
              {preview.selectedTechnician ? (
                <div className="bg-green-50 border border-green-200 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <div className="text-sm">
                        <div className="font-medium text-green-900">
                          {preview.selectedTechnician.name}
                        </div>
                        <div className="text-xs text-green-700">
                          {preview.reason}
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" className="text-xs">
                      P{preview.selectedTechnician.priority}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <div className="text-sm">
                      <div className="font-medium text-yellow-900">
                        Sin técnicos disponibles
                      </div>
                      <div className="text-xs text-yellow-700">
                        Se asignará manualmente o se usará cascada hacia niveles superiores
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-2">
              Configura técnicos para ver la simulación
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}