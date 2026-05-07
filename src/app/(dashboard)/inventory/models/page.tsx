/**
 * Página: Lista de Modelos de Equipos
 * /inventory/models
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/common/use-debounce'
import { ModelStockBadge } from '@/components/inventory/models/ModelStockBadge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EquipmentModel {
  id: string
  brand: string
  model: string
  sku: string | null
  type: {
    id: string
    name: string
    code: string
    family: {
      id: string
      name: string
    } | null
  }
  standardPrice: number | null
  isActive: boolean
  createdAt: string
}

interface EquipmentType {
  id: string
  name: string
  code: string
}

interface Family {
  id: string
  name: string
}

export default function ModelsPage() {
  const router = useRouter()
  const { toast } = useToast()

  const [models, setModels] = useState<EquipmentModel[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)

  // Filtros
  const [search, setSearch] = useState('')
  const [typeId, setTypeId] = useState<string>('')
  const [familyId, setFamilyId] = useState<string>('')
  const [isActive, setIsActive] = useState<string>('true')

  // Catálogos
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [families, setFamilies] = useState<Family[]>([])

  const debouncedSearch = useDebounce(search, 500)

  // Cargar catálogos
  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [typesRes, familiesRes] = await Promise.all([
          fetch('/api/inventory/equipment-types'),
          fetch('/api/inventory/families'),
        ])

        if (typesRes.ok) {
          const typesData = await typesRes.json()
          setTypes(typesData.types || [])
        }

        if (familiesRes.ok) {
          const familiesData = await familiesRes.json()
          setFamilies(familiesData.families || [])
        }
      } catch (error) {
        console.error('Error loading catalogs:', error)
      }
    }

    loadCatalogs()
  }, [])

  // Cargar modelos
  useEffect(() => {
    loadModels()
  }, [debouncedSearch, typeId, familyId, isActive, page]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadModels = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        isActive,
      })

      if (debouncedSearch) params.append('search', debouncedSearch)
      if (typeId) params.append('typeId', typeId)
      if (familyId) params.append('familyId', familyId)

      const response = await fetch(`/api/inventory/models?${params}`)
      if (!response.ok) throw new Error('Error al cargar modelos')

      const data = await response.json()
      setModels(data.models || [])
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Error loading models:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los modelos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setSearch('')
    setTypeId('')
    setFamilyId('')
    setIsActive('true')
    setPage(1)
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Modelos de Equipos</h1>
          <p className='text-muted-foreground'>
            Catálogo maestro de modelos de equipos tecnológicos
          </p>
        </div>
        <Button onClick={() => router.push('/inventory/models/create')}>
          <Plus className='mr-2 h-4 w-4' />
          Nuevo Modelo
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Busca y filtra modelos por diferentes criterios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            {/* Búsqueda */}
            <div className='md:col-span-2'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
                <Input
                  placeholder='Buscar por marca, modelo o SKU...'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className='pl-9'
                />
              </div>
            </div>

            {/* Tipo */}
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder='Todos los tipos' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>Todos los tipos</SelectItem>
                {types.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Familia */}
            <Select value={familyId} onValueChange={setFamilyId}>
              <SelectTrigger>
                <SelectValue placeholder='Todas las familias' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>Todas las familias</SelectItem>
                {families.map(family => (
                  <SelectItem key={family.id} value={family.id}>
                    {family.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className='flex items-center justify-between mt-4'>
            <div className='flex items-center gap-2'>
              <Filter className='h-4 w-4 text-muted-foreground' />
              <Select value={isActive} onValueChange={setIsActive}>
                <SelectTrigger className='w-[180px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='true'>Activos</SelectItem>
                  <SelectItem value='false'>Inactivos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant='outline' onClick={handleReset}>
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      <Card>
        <CardHeader>
          <CardTitle>Resultados</CardTitle>
          <CardDescription>
            {loading
              ? 'Cargando...'
              : `${total} modelo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className='space-y-3'>
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className='h-16 w-full' />
              ))}
            </div>
          ) : models.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <p className='text-muted-foreground'>No se encontraron modelos</p>
              <Button
                variant='outline'
                className='mt-4'
                onClick={() => router.push('/inventory/models/create')}
              >
                <Plus className='mr-2 h-4 w-4' />
                Crear primer modelo
              </Button>
            </div>
          ) : (
            <>
              <div className='rounded-md border'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Familia</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Precio</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className='text-right'>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map(model => (
                      <TableRow
                        key={model.id}
                        className='cursor-pointer hover:bg-muted/50'
                        onClick={() => router.push(`/inventory/models/${model.id}`)}
                      >
                        <TableCell>
                          <div>
                            <div className='font-medium'>
                              {model.brand} {model.model}
                            </div>
                            <div className='text-xs text-muted-foreground'>{model.type.name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {model.sku ? (
                            <Badge variant='secondary'>{model.sku}</Badge>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant='outline'>{model.type.name}</Badge>
                        </TableCell>
                        <TableCell>
                          {model.type.family ? (
                            <span className='text-sm'>{model.type.family.name}</span>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ModelStockBadge modelId={model.id} />
                        </TableCell>
                        <TableCell>
                          {model.standardPrice ? (
                            <span className='font-medium'>${model.standardPrice.toFixed(2)}</span>
                          ) : (
                            <span className='text-muted-foreground'>—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={model.isActive ? 'success' : 'secondary'}>
                            {model.isActive ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={e => {
                              e.stopPropagation()
                              router.push(`/inventory/models/${model.id}`)
                            }}
                          >
                            Ver detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Paginación */}
              {total > limit && (
                <div className='mt-4 flex items-center justify-between'>
                  <p className='text-sm text-muted-foreground'>
                    Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de {total}
                  </p>
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
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
