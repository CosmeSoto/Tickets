/**
 * GroupedInventoryTable
 *
 * Tabla de inventario agrupada por modelo con contadores de estado
 * - Columnas: Marca+Modelo, Tipo, Familia, Total, Disponibles, Asignadas, etc.
 * - Ordenable por cualquier columna
 * - Búsqueda por marca, modelo, tipo
 * - Filtros por familia y tipo
 * - Expansión de fila para mostrar unidades individuales
 * - Acciones: Ver detalle, Editar, Cambiar estado
 * - Botón "Crear lote" con datos pre-llenados
 * - Exportación CSV/Excel/PDF
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Download,
  Package,
  Plus,
  Eye,
  Edit,
  RefreshCw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import type { GroupedInventoryRow } from '@/types/equipment-grouping'

export interface GroupedInventoryTableProps {
  onCreateBulk?: (prefillData: any) => void
}

type SortField = 'brand' | 'model' | 'type' | 'family' | 'total' | 'available'
type SortOrder = 'asc' | 'desc'

/**
 * Traduce el estado al español
 */
function translateStatus(status: string): string {
  const translations: Record<string, string> = {
    AVAILABLE: 'Disponible',
    ASSIGNED: 'Asignado',
    MAINTENANCE: 'Mantenimiento',
    FOR_SALE: 'En venta',
    SOLD: 'Vendido',
    RETIRED: 'Retirado',
  }
  return translations[status] || status
}

/**
 * Obtiene el color del badge según el estado
 */
function getStatusColor(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'AVAILABLE':
      return 'default'
    case 'ASSIGNED':
      return 'secondary'
    case 'MAINTENANCE':
      return 'outline'
    case 'FOR_SALE':
      return 'default'
    case 'SOLD':
      return 'destructive'
    case 'RETIRED':
      return 'destructive'
    default:
      return 'outline'
  }
}

export function GroupedInventoryTable({ onCreateBulk }: GroupedInventoryTableProps) {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupedInventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Filtros y búsqueda
  const [search, setSearch] = useState('')
  const [selectedFamilyId, setSelectedFamilyId] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState('')

  // Ordenamiento
  const [sortField, setSortField] = useState<SortField>('brand')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // Paginación
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [totalPages, setTotalPages] = useState(1)

  // Cargar datos
  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      })

      if (search) params.append('search', search)
      if (selectedFamilyId) params.append('familyId', selectedFamilyId)
      if (selectedTypeId) params.append('typeId', selectedTypeId)

      const response = await fetch(`/api/inventory/equipment/grouped?${params}`)
      const data = await response.json()

      setGroups(data.groups || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Error al cargar inventario agrupado:', error)
    } finally {
      setLoading(false)
    }
  }

  // Efecto para cargar datos
  useState(() => {
    fetchData()
  })

  // Toggle expansión de fila
  const toggleRow = (groupId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedRows(newExpanded)
  }

  // Ordenar grupos
  const sortedGroups = [...groups].sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortField) {
      case 'brand':
        aValue = a.brand
        bValue = b.brand
        break
      case 'model':
        aValue = a.model
        bValue = b.model
        break
      case 'type':
        aValue = a.type.name
        bValue = b.type.name
        break
      case 'family':
        aValue = a.family?.name || ''
        bValue = b.family?.name || ''
        break
      case 'total':
        aValue = a.total
        bValue = b.total
        break
      case 'available':
        aValue = a.available
        bValue = b.available
        break
      default:
        return 0
    }

    if (typeof aValue === 'string') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return sortOrder === 'asc' ? aValue - bValue : bValue - aValue
  })

  // Handler para cambiar ordenamiento
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Handler para crear lote
  const handleCreateBulk = (group: GroupedInventoryRow) => {
    if (onCreateBulk) {
      onCreateBulk({
        brand: group.brand,
        model: group.model,
        typeId: group.type.id,
      })
    } else {
      router.push('/inventory/equipment/bulk/new')
    }
  }

  // Limpiar filtros
  const clearFilters = () => {
    setSearch('')
    setSelectedFamilyId('')
    setSelectedTypeId('')
    setPage(1)
  }

  const hasActiveFilters = search || selectedFamilyId || selectedTypeId

  return (
    <div className='space-y-4'>
      {/* Barra de búsqueda y filtros */}
      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-col gap-4'>
            {/* Búsqueda */}
            <div className='flex gap-2'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Buscar por marca, modelo o tipo...'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className='pl-9'
                />
              </div>
              <Button onClick={fetchData}>Buscar</Button>
            </div>

            {/* Filtros */}
            <div className='flex gap-2 items-center'>
              <Filter className='h-4 w-4 text-muted-foreground' />
              <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
                <SelectTrigger className='w-[200px]'>
                  <SelectValue placeholder='Todas las familias' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=''>Todas las familias</SelectItem>
                  {/* Aquí irían las familias dinámicas */}
                </SelectContent>
              </Select>

              <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                <SelectTrigger className='w-[200px]'>
                  <SelectValue placeholder='Todos los tipos' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=''>Todos los tipos</SelectItem>
                  {/* Aquí irían los tipos dinámicos */}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant='ghost' size='sm' onClick={clearFilters}>
                  <X className='h-4 w-4 mr-1' />
                  Limpiar
                </Button>
              )}

              <div className='ml-auto flex gap-2'>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='outline' size='sm'>
                      <Download className='h-4 w-4 mr-2' />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem>Exportar CSV</DropdownMenuItem>
                    <DropdownMenuItem>Exportar Excel</DropdownMenuItem>
                    <DropdownMenuItem>Exportar PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button size='sm' onClick={() => router.push('/inventory/equipment/bulk/new')}>
                  <Plus className='h-4 w-4 mr-2' />
                  Crear lote
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[50px]'></TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('brand')}
                >
                  Marca + Modelo
                  {sortField === 'brand' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('type')}
                >
                  Tipo
                  {sortField === 'type' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('family')}
                >
                  Familia
                  {sortField === 'family' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead
                  className='text-center cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('total')}
                >
                  Total
                  {sortField === 'total' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead
                  className='text-center cursor-pointer hover:bg-muted/50'
                  onClick={() => handleSort('available')}
                >
                  Disponibles
                  {sortField === 'available' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </TableHead>
                <TableHead className='text-center'>Asignadas</TableHead>
                <TableHead className='text-center'>Mantenimiento</TableHead>
                <TableHead className='text-center'>En venta</TableHead>
                <TableHead className='text-center'>Vendidas</TableHead>
                <TableHead className='text-center'>Retiradas</TableHead>
                <TableHead className='text-right'>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={12} className='text-center py-8'>
                    Cargando...
                  </TableCell>
                </TableRow>
              ) : sortedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className='text-center py-8'>
                    <div className='flex flex-col items-center gap-2'>
                      <Package className='h-12 w-12 text-muted-foreground' />
                      <p className='text-muted-foreground'>No se encontraron equipos</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedGroups.map(group => (
                  <>
                    {/* Fila principal del grupo */}
                    <TableRow key={group.groupId} className='hover:bg-muted/50'>
                      <TableCell>
                        <Button variant='ghost' size='sm' onClick={() => toggleRow(group.groupId)}>
                          {expandedRows.has(group.groupId) ? (
                            <ChevronDown className='h-4 w-4' />
                          ) : (
                            <ChevronRight className='h-4 w-4' />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className='font-medium'>
                            {group.brand} {group.model}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{group.type.name}</TableCell>
                      <TableCell>{group.family?.name || '—'}</TableCell>
                      <TableCell className='text-center font-semibold'>{group.total}</TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='default'>{group.available}</Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='secondary'>{group.assigned}</Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='outline'>{group.maintenance}</Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='default'>{group.forSale}</Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='destructive'>{group.sold}</Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='destructive'>{group.retired}</Badge>
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button variant='outline' size='sm' onClick={() => handleCreateBulk(group)}>
                          <Plus className='h-4 w-4 mr-1' />
                          Crear lote
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Fila expandida con unidades individuales */}
                    {expandedRows.has(group.groupId) && (
                      <TableRow>
                        <TableCell colSpan={12} className='bg-muted/30 p-4'>
                          <div className='space-y-2'>
                            <h4 className='font-semibold text-sm'>
                              Unidades individuales ({group.units.length})
                            </h4>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Serial</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead>Ubicación</TableHead>
                                  <TableHead>Asignado a</TableHead>
                                  <TableHead className='text-right'>Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.units.map(unit => (
                                  <TableRow key={unit.id}>
                                    <TableCell className='font-mono text-sm'>{unit.code}</TableCell>
                                    <TableCell className='font-mono text-sm'>
                                      {unit.serialNumber || '—'}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant={getStatusColor(unit.status)}>
                                        {translateStatus(unit.status)}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>{unit.location || '—'}</TableCell>
                                    <TableCell>{unit.assignedTo?.name || '—'}</TableCell>
                                    <TableCell className='text-right'>
                                      <div className='flex gap-1 justify-end'>
                                        <Button
                                          variant='ghost'
                                          size='sm'
                                          onClick={() =>
                                            router.push(`/inventory/equipment/${unit.id}`)
                                          }
                                        >
                                          <Eye className='h-4 w-4' />
                                        </Button>
                                        <Button
                                          variant='ghost'
                                          size='sm'
                                          onClick={() =>
                                            router.push(`/inventory/equipment/${unit.id}/edit`)
                                          }
                                        >
                                          <Edit className='h-4 w-4' />
                                        </Button>
                                        <Button variant='ghost' size='sm'>
                                          <RefreshCw className='h-4 w-4' />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <p className='text-sm text-muted-foreground'>
            Página {page} de {totalPages}
          </p>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <Button
              variant='outline'
              size='sm'
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
