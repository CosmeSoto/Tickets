/**
 * Página: Detalle de Modelo de Equipo
 * /inventory/models/[id]
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Edit, Package, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { ModelStockBadge } from '@/components/inventory/models/ModelStockBadge'

interface ModelWithStock {
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
  specifications: any
  defaultAccessories: string[]
  standardPrice: number | null
  modelPhotoUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stock: {
    total: number
    available: number
    assigned: number
    maintenance: number
    forSale: number
    sold: number
    retired: number
  }
}

export default function ModelDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { toast } = useToast()

  const [model, setModel] = useState<ModelWithStock | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadModel()
  }, [params.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadModel = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/inventory/models/${params.id}/stock`)
      if (!response.ok) throw new Error('Error al cargar modelo')

      const data = await response.json()
      setModel(data)
    } catch (error) {
      console.error('Error loading model:', error)
      toast({
        title: 'Error',
        description: 'No se pudo cargar el modelo',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className='space-y-6'>
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-64 w-full' />
      </div>
    )
  }

  if (!model) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <p className='text-muted-foreground'>Modelo no encontrado</p>
        <Button variant='outline' className='mt-4' onClick={() => router.back()}>
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' onClick={() => router.back()}>
            <ArrowLeft className='h-4 w-4' />
          </Button>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>
              {model.brand} {model.model}
            </h1>
            <p className='text-muted-foreground'>{model.type.name}</p>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Badge variant={model.isActive ? 'success' : 'secondary'}>
            {model.isActive ? 'Activo' : 'Inactivo'}
          </Badge>
          <Button onClick={() => router.push(`/inventory/models/${model.id}/edit`)}>
            <Edit className='mr-2 h-4 w-4' />
            Editar
          </Button>
        </div>
      </div>

      {/* Información General */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        {/* Datos Básicos */}
        <Card className='md:col-span-2'>
          <CardHeader>
            <CardTitle>Información General</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Marca</p>
                <p className='text-lg'>{model.brand}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Modelo</p>
                <p className='text-lg'>{model.model}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>SKU</p>
                <p className='text-lg'>
                  {model.sku ? (
                    <Badge variant='secondary'>{model.sku}</Badge>
                  ) : (
                    <span className='text-muted-foreground'>—</span>
                  )}
                </p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Tipo</p>
                <p className='text-lg'>{model.type.name}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Familia</p>
                <p className='text-lg'>{model.type.family ? model.type.family.name : '—'}</p>
              </div>
              <div>
                <p className='text-sm font-medium text-muted-foreground'>Precio Estándar</p>
                <p className='text-lg font-semibold'>
                  {model.standardPrice ? `$${model.standardPrice.toFixed(2)}` : '—'}
                </p>
              </div>
            </div>

            {/* Especificaciones */}
            {model.specifications && (
              <div>
                <p className='text-sm font-medium text-muted-foreground mb-2'>Especificaciones</p>
                <div className='rounded-md bg-muted p-3'>
                  <pre className='text-sm overflow-x-auto'>
                    {JSON.stringify(model.specifications, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Accesorios */}
            {model.defaultAccessories && model.defaultAccessories.length > 0 && (
              <div>
                <p className='text-sm font-medium text-muted-foreground mb-2'>
                  Accesorios por Defecto
                </p>
                <div className='flex flex-wrap gap-2'>
                  {model.defaultAccessories.map((accessory, index) => (
                    <Badge key={index} variant='outline'>
                      {accessory}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock */}
        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
            <CardDescription>Unidades por estado</CardDescription>
          </CardHeader>
          <CardContent className='space-y-3'>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Total</span>
              <Badge variant='default'>{model.stock.total}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Disponibles</span>
              <Badge variant='success'>{model.stock.available}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Asignados</span>
              <Badge variant='secondary'>{model.stock.assigned}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Mantenimiento</span>
              <Badge variant='warning'>{model.stock.maintenance}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>En Venta</span>
              <Badge variant='secondary'>{model.stock.forSale}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Vendidos</span>
              <Badge variant='outline'>{model.stock.sold}</Badge>
            </div>
            <div className='flex items-center justify-between'>
              <span className='text-sm'>Retirados</span>
              <Badge variant='outline'>{model.stock.retired}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue='instances' className='space-y-4'>
        <TabsList>
          <TabsTrigger value='instances'>
            <Package className='mr-2 h-4 w-4' />
            Instancias
          </TabsTrigger>
          <TabsTrigger value='batches'>
            <History className='mr-2 h-4 w-4' />
            Lotes
          </TabsTrigger>
        </TabsList>

        <TabsContent value='instances'>
          <Card>
            <CardHeader>
              <CardTitle>Instancias de Equipos</CardTitle>
              <CardDescription>Equipos individuales de este modelo</CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>Lista de equipos próximamente...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value='batches'>
          <Card>
            <CardHeader>
              <CardTitle>Lotes de Compra</CardTitle>
              <CardDescription>Historial de lotes de este modelo</CardDescription>
            </CardHeader>
            <CardContent>
              <p className='text-sm text-muted-foreground'>Lista de lotes próximamente...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
