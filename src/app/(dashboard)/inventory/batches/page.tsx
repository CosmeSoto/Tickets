/**
 * Página: Lista de Lotes
 * Muestra todos los lotes de equipos con filtros y búsqueda
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Package, Calendar, DollarSign, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface Batch {
  id: string
  batchNumber: string
  modelId: string
  model?: {
    brand: string
    model: string
    sku: string
  }
  quantity: number
  supplierId?: string
  supplier?: {
    name: string
  }
  invoiceNumber?: string
  purchasePrice?: number
  purchaseDate?: string
  status: string
  createdAt: string
}

export default function BatchesListPage() {
  const router = useRouter()
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/inventory/batches')
      if (!response.ok) throw new Error('Error cargando lotes')

      const data = await response.json()
      setBatches(data.batches || [])
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Filtrar lotes
  const filteredBatches = batches.filter(batch => {
    const matchesSearch =
      batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.model?.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.model?.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.invoiceNumber?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
      ACTIVE: 'success',
      COMPLETED: 'default',
      CANCELLED: 'destructive',
    }

    const labels: Record<string, string> = {
      ACTIVE: 'Activo',
      COMPLETED: 'Completado',
      CANCELLED: 'Cancelado',
    }

    return <Badge variant={variants[status] || 'default'}>{labels[status] || status}</Badge>
  }

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>Lotes de Equipos</h1>
          <p className='text-gray-600 mt-1'>Gestiona los lotes de equipos recibidos</p>
        </div>
        <Link href='/inventory/batches/create'>
          <Button>
            <Plus className='mr-2 h-4 w-4' />
            Crear Lote
          </Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className='mb-6'>
        <CardContent className='pt-6'>
          <div className='flex flex-col md:flex-row gap-4'>
            {/* Búsqueda */}
            <div className='flex-1'>
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400' />
                <Input
                  placeholder='Buscar por número de lote, modelo, factura...'
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className='pl-10'
                />
              </div>
            </div>

            {/* Filtro de Estado */}
            <div className='w-full md:w-48'>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='all'>Todos los estados</option>
                <option value='ACTIVE'>Activo</option>
                <option value='COMPLETED'>Completado</option>
                <option value='CANCELLED'>Cancelado</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Lotes */}
      {isLoading ? (
        <div className='flex justify-center items-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
        </div>
      ) : filteredBatches.length === 0 ? (
        <Card>
          <CardContent className='py-12 text-center'>
            <Package className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <p className='text-gray-600'>
              {searchQuery || statusFilter !== 'all'
                ? 'No se encontraron lotes con los filtros aplicados'
                : 'No hay lotes registrados'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Link href='/inventory/batches/create'>
                <Button className='mt-4'>
                  <Plus className='mr-2 h-4 w-4' />
                  Crear Primer Lote
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4'>
          {filteredBatches.map(batch => (
            <Card
              key={batch.id}
              className='hover:shadow-md transition-shadow cursor-pointer'
              onClick={() => router.push(`/inventory/batches/${batch.id}`)}
            >
              <CardHeader>
                <div className='flex justify-between items-start'>
                  <div>
                    <CardTitle className='text-lg'>Lote {batch.batchNumber}</CardTitle>
                    <CardDescription>
                      {batch.model?.brand} {batch.model?.model}
                      {batch.model?.sku && ` (${batch.model.sku})`}
                    </CardDescription>
                  </div>
                  {getStatusBadge(batch.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 text-sm'>
                  <div className='flex items-center gap-2'>
                    <Package className='h-4 w-4 text-gray-400' />
                    <div>
                      <p className='text-gray-500'>Cantidad</p>
                      <p className='font-semibold'>{batch.quantity} unidades</p>
                    </div>
                  </div>

                  {batch.supplier && (
                    <div>
                      <p className='text-gray-500'>Proveedor</p>
                      <p className='font-semibold'>{batch.supplier.name}</p>
                    </div>
                  )}

                  {batch.invoiceNumber && (
                    <div>
                      <p className='text-gray-500'>Factura</p>
                      <p className='font-semibold'>{batch.invoiceNumber}</p>
                    </div>
                  )}

                  {batch.purchasePrice && (
                    <div className='flex items-center gap-2'>
                      <DollarSign className='h-4 w-4 text-gray-400' />
                      <div>
                        <p className='text-gray-500'>Precio Unitario</p>
                        <p className='font-semibold'>${batch.purchasePrice.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  <div className='flex items-center gap-2'>
                    <Calendar className='h-4 w-4 text-gray-400' />
                    <div>
                      <p className='text-gray-500'>Fecha</p>
                      <p className='font-semibold'>
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Resumen */}
      {!isLoading && filteredBatches.length > 0 && (
        <div className='mt-6 text-center text-sm text-gray-600'>
          Mostrando {filteredBatches.length} de {batches.length} lotes
        </div>
      )}
    </div>
  )
}
