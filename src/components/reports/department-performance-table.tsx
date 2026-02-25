'use client'

import { useMemo, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useTablePagination } from '@/hooks/use-table-pagination'
import { cn } from '@/lib/utils'

export interface DepartmentPerformance {
  id: string
  name: string
  description?: string
  color?: string
  totalTickets: number
  openTickets: number
  inProgressTickets: number
  resolvedTickets: number
  closedTickets: number
  avgResolutionTime: string
  resolutionRate: number
  slaCompliance: number
  activeCategories: number
  activeTechnicians: number
}

interface DepartmentPerformanceTableProps {
  departments: DepartmentPerformance[]
  loading?: boolean
}

export function DepartmentPerformanceTable({ 
  departments, 
  loading = false
}: DepartmentPerformanceTableProps) {
  
  // Estado para tamaño de página
  const [pageSize, setPageSize] = useState(10)
  
  // Ordenar departamentos por total de tickets (descendente)
  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => b.totalTickets - a.totalTickets)
  }, [departments])

  // Paginación
  const pagination = useTablePagination(sortedDepartments, { pageSize })

  // Calcular totales
  const totals = useMemo(() => {
    return departments.reduce((acc, dept) => ({
      totalTickets: acc.totalTickets + dept.totalTickets,
      openTickets: acc.openTickets + dept.openTickets,
      inProgressTickets: acc.inProgressTickets + dept.inProgressTickets,
      resolvedTickets: acc.resolvedTickets + dept.resolvedTickets,
      closedTickets: acc.closedTickets + dept.closedTickets,
      avgResolutionRate: departments.length > 0 
        ? departments.reduce((sum, d) => sum + d.resolutionRate, 0) / departments.length 
        : 0,
      avgSlaCompliance: departments.length > 0
        ? departments.reduce((sum, d) => sum + d.slaCompliance, 0) / departments.length
        : 0,
    }), {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      resolvedTickets: 0,
      closedTickets: 0,
      avgResolutionRate: 0,
      avgSlaCompliance: 0,
    })
  }, [departments])

  const getResolutionRateBadge = (rate: number) => {
    if (rate >= 90) return { color: 'bg-green-100 text-green-800', icon: TrendingUp }
    if (rate >= 70) return { color: 'bg-yellow-100 text-yellow-800', icon: Minus }
    return { color: 'bg-red-100 text-red-800', icon: TrendingDown }
  }

  const getSlaComplianceBadge = (compliance: number) => {
    if (compliance >= 95) return { color: 'bg-green-100 text-green-800', label: 'Excelente' }
    if (compliance >= 85) return { color: 'bg-blue-100 text-blue-800', label: 'Bueno' }
    if (compliance >= 70) return { color: 'bg-yellow-100 text-yellow-800', label: 'Regular' }
    return { color: 'bg-red-100 text-red-800', label: 'Crítico' }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (departments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Análisis de Departamentos</CardTitle>
          <CardDescription>Rendimiento y métricas por departamento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-muted-foreground">No hay datos de departamentos disponibles</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Análisis de Departamentos</CardTitle>
        <CardDescription>
          {departments.length} departamento{departments.length !== 1 ? 's' : ''} con métricas completas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Departamento</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Abiertos</TableHead>
                <TableHead className="text-center">En Progreso</TableHead>
                <TableHead className="text-center">Resueltos</TableHead>
                <TableHead className="text-center">Cerrados</TableHead>
                <TableHead className="text-center">Tiempo Prom.</TableHead>
                <TableHead className="text-center">Tasa Resolución</TableHead>
                <TableHead className="text-center">SLA</TableHead>
                <TableHead className="text-center">Categorías</TableHead>
                <TableHead className="text-center">Técnicos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.paginatedData.map((dept) => {
                const resolutionBadge = getResolutionRateBadge(dept.resolutionRate)
                const slaBadge = getSlaComplianceBadge(dept.slaCompliance)
                const ResolutionIcon = resolutionBadge.icon

                return (
                  <TableRow key={dept.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {dept.color && (
                          <div 
                            className="w-3 h-3 rounded-full flex-shrink-0" 
                            style={{ backgroundColor: dept.color }}
                          />
                        )}
                        <div>
                          <div className="font-medium">{dept.name}</div>
                          {dept.description && (
                            <div className="text-xs text-muted-foreground">{dept.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{dept.totalTickets}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {dept.openTickets}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        {dept.inProgressTickets}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        {dept.resolvedTickets}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                        {dept.closedTickets}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{dept.avgResolutionTime}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={resolutionBadge.color}>
                        <ResolutionIcon className="h-3 w-3 mr-1" />
                        {dept.resolutionRate.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={slaBadge.color}>
                        {dept.slaCompliance.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{dept.activeCategories}</TableCell>
                    <TableCell className="text-center text-sm">{dept.activeTechnicians}</TableCell>
                  </TableRow>
                )
              })}
              
              {/* Fila de totales */}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>TOTALES / PROMEDIOS</TableCell>
                <TableCell className="text-center">{totals.totalTickets}</TableCell>
                <TableCell className="text-center">{totals.openTickets}</TableCell>
                <TableCell className="text-center">{totals.inProgressTickets}</TableCell>
                <TableCell className="text-center">{totals.resolvedTickets}</TableCell>
                <TableCell className="text-center">{totals.closedTickets}</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center">{totals.avgResolutionRate.toFixed(1)}%</TableCell>
                <TableCell className="text-center">{totals.avgSlaCompliance.toFixed(1)}%</TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        
        {/* Paginación */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {pagination.startIndex} a {pagination.endIndex} de {pagination.totalItems} elementos
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value))
                pagination.resetPage()
              }}
              className="px-3 py-1 border border-border rounded text-sm bg-background"
            >
              {[10, 20, 50, 100].map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            
            <button
              onClick={pagination.previousPage}
              disabled={!pagination.hasPreviousPage}
              className={cn(
                "px-3 py-1 border border-border rounded text-sm transition-colors",
                !pagination.hasPreviousPage
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-background hover:bg-muted"
              )}
            >
              Anterior
            </button>
            
            <span className="text-sm">
              Página {pagination.currentPage} de {pagination.totalPages}
            </span>
            
            <button
              onClick={pagination.nextPage}
              disabled={!pagination.hasNextPage}
              className={cn(
                "px-3 py-1 border border-border rounded text-sm transition-colors",
                !pagination.hasNextPage
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-background hover:bg-muted"
              )}
            >
              Siguiente
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
