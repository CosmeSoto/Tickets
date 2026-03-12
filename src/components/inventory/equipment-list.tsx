'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EquipmentFilters } from './equipment-filters'
import { EquipmentTable } from './equipment-table'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import type { Equipment, EquipmentFilters as EquipmentFiltersType } from '@/types/inventory/equipment'

interface EquipmentListProps {
  onCreateNew?: () => void
  onEdit?: (equipment: Equipment) => void
  onDelete?: (equipment: Equipment) => void
  onViewQR?: (equipment: Equipment) => void
}

export function EquipmentList({
  onCreateNew,
  onEdit,
  onDelete,
  onViewQR,
}: EquipmentListProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(10)
  
  const [filters, setFilters] = useState<EquipmentFiltersType>({})

  // Cargar equipos
  useEffect(() => {
    loadEquipment()
  }, [filters, page])

  const loadEquipment = async () => {
    try {
      setLoading(true)
      
      // Construir query params
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.type) filters.type.forEach(t => params.append('type', t))
      if (filters.status) filters.status.forEach(s => params.append('status', s))
      if (filters.condition) filters.condition.forEach(c => params.append('condition', c))
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      const response = await fetch(`/api/inventory/equipment?${params}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar equipos')
      }

      const data = await response.json()
      setEquipment(data.equipment)
      setTotal(data.total)
    } catch (error) {
      console.error('Error cargando equipos:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los equipos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleFiltersChange = (newFilters: EquipmentFiltersType) => {
    setFilters(newFilters)
    setPage(1) // Reset a primera página
  }

  const handleReset = () => {
    setFilters({})
    setPage(1)
  }

  const canCreate = session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Equipos</h2>
          <p className="text-muted-foreground">
            Gestiona el inventario de equipos tecnológicos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          {canCreate && onCreateNew && (
            <Button onClick={onCreateNew} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Equipo
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busca y filtra equipos por diferentes criterios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EquipmentFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onReset={handleReset}
          />
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Resultados</CardTitle>
              <CardDescription>
                {loading ? (
                  'Cargando...'
                ) : (
                  `${total} equipo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <EquipmentTable
                equipment={equipment}
                userRole={session?.user?.role || 'CLIENT'}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewQR={onViewQR}
              />
              
              {/* Paginación */}
              {total > limit && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * limit >= total}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
