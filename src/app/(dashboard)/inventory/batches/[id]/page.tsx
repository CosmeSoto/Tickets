/**
 * Página: Detalle de Lote
 * Muestra información detallada de un lote y sus equipos
 */

'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Package,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Download,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import Link from 'next/link'

interface BatchDetail {
  id: string
  batchNumber: string
  modelId: string
  model?: {
    brand: string
    model: string
    sku: string
    type: string
  }
  quantity: number
  supplierId?: string
  supplier?: {
    name: string
    email?: string
  }
  invoiceNumber?: string
  purchasePrice?: number
  purchaseDate?: string
  warehouseId?: string
  warehouse?: {
    name: string
  }
  status: string
  notes?: string
  createdAt: string
  equipment?: Array<{
    id: string
    code: string
    serialNumber: string
    status: string
  }>
}

export default function BatchDetailPage() {
  const params = useParams()
  const router = useRouter()
  const batchId = params.id as string

  const [batch, setBatch] = useState<BatchDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (batchId) {
      fetchBatchDetail()
    }
  }, [batchId])

  const fetchBatchDetail = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/inventory/batches/${batchId}`)
      if (!response.ok) {
        throw new Error('Error cargando detalle del lote')
      }

      const data = await response.json()
      setBatch(data.batch)
    } catch (err: any) {
      console.error('Error:', err)
      setError(err.message || 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const response = await fetch(`/api/inventory/batches/${batchId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Error actualizando estado')
      }

      await fetchBatchDetail()
    } catch (err: any) {
      console.error('Error:', err)
      alert(err.message || 'Error actualizando estado')
    }
  }

  const handleDownloadReceipt = () => {
    // TODO: Implementar generación de PDF
    alert('Funcionalidad de descarga de acta en desarrollo')
  }

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

  const getEquipmentStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
      AVAILABLE: 'success',
      ASSIGNED: 'default',
      MAINTENANCE: 'warning',
      FOR_SALE: 'default',
      SOLD: 'default',
      RETIRED: 'destructive',
    }

    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  if (isLoading) {
    return (
      <div className='container mx-auto py-8 px-4'>
        <div className='flex justify-center items-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin text-gray-400' />
        </div>
      </div>
    )
  }

  if (error || !batch) {
    return (
      <div className='container mx-auto py-8 px-4'>
        <Card>
          <CardContent className='py-12 text-center'>
            <XCircle className='h-12 w-12 text-red-500 mx-auto mb-4' />
            <p className='text-gray-600'>{error || 'Lote no encontrado'}</p>
            <Link href='/inventory/batches'>
              <Button className='mt-4' variant='outline'>
                Volver a Lotes
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className='container mx-auto py-8 px-4 max-w-6xl'>
      {/* Header */}
      <div className='mb-6'>
        <Link href='/inventory/batches'>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Volver a Lotes
          </Button>
        </Link>
      </div>

      <div className='flex justify-between items-start mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>Lote {batch.batchNumber}</h1>
          <p className='text-gray-600 mt-1'>
            {batch.model?.brand} {batch.model?.model}
          </p>
        </div>
        <div className='flex gap-2'>
          {getStatusBadge(batch.status)}
          <Button variant='outline' size='sm' onClick={handleDownloadReceipt}>
            <Download className='mr-2 h-4 w-4' />
            Descargar Acta
          </Button>
        </div>
      </div>

      {/* Información General */}
      <div className='grid md:grid-cols-2 gap-6 mb-6'>
        <Card>
          <CardHeader>
            <CardTitle>Información del Lote</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center gap-3'>
              <Package className='h-5 w-5 text-gray-400' />
              <div>
                <p className='text-sm text-gray-500'>Cantidad</p>
                <p className='font-semibold'>{batch.quantity} unidades</p>
              </div>
            </div>

            <div className='flex items-center gap-3'>
              <Calendar className='h-5 w-5 text-gray-400' />
              <div>
                <p className='text-sm text-gray-500'>Fecha de Creación</p>
                <p className='font-semibold'>
                  {new Date(batch.createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {batch.purchaseDate && (
              <div className='flex items-center gap-3'>
                <Calendar className='h-5 w-5 text-gray-400' />
                <div>
                  <p className='text-sm text-gray-500'>Fecha de Compra</p>
                  <p className='font-semibold'>
                    {new Date(batch.purchaseDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}

            {batch.warehouse && (
              <div>
                <p className='text-sm text-gray-500'>Bodega</p>
                <p className='font-semibold'>{batch.warehouse.name}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información Comercial</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {batch.supplier && (
              <div>
                <p className='text-sm text-gray-500'>Proveedor</p>
                <p className='font-semibold'>{batch.supplier.name}</p>
                {batch.supplier.email && (
                  <p className='text-sm text-gray-600'>{batch.supplier.email}</p>
                )}
              </div>
            )}

            {batch.invoiceNumber && (
              <div className='flex items-center gap-3'>
                <FileText className='h-5 w-5 text-gray-400' />
                <div>
                  <p className='text-sm text-gray-500'>Número de Factura</p>
                  <p className='font-semibold'>{batch.invoiceNumber}</p>
                </div>
              </div>
            )}

            {batch.purchasePrice && (
              <div className='flex items-center gap-3'>
                <DollarSign className='h-5 w-5 text-gray-400' />
                <div>
                  <p className='text-sm text-gray-500'>Precio Unitario</p>
                  <p className='font-semibold'>${batch.purchasePrice.toLocaleString()}</p>
                  <p className='text-sm text-gray-600'>
                    Total: ${(batch.purchasePrice * batch.quantity).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notas */}
      {batch.notes && (
        <Card className='mb-6'>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-gray-700 whitespace-pre-wrap'>{batch.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Lista de Equipos */}
      <Card>
        <CardHeader>
          <CardTitle>Equipos del Lote ({batch.equipment?.length || 0})</CardTitle>
          <CardDescription>Lista de todos los equipos creados en este lote</CardDescription>
        </CardHeader>
        <CardContent>
          {batch.equipment && batch.equipment.length > 0 ? (
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className='text-left py-3 px-4'>Código</th>
                    <th className='text-left py-3 px-4'>Serial</th>
                    <th className='text-left py-3 px-4'>Estado</th>
                    <th className='text-right py-3 px-4'>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.equipment.map(eq => (
                    <tr key={eq.id} className='border-b hover:bg-gray-50'>
                      <td className='py-3 px-4 font-mono text-sm'>{eq.code}</td>
                      <td className='py-3 px-4 font-mono text-sm'>{eq.serialNumber || '-'}</td>
                      <td className='py-3 px-4'>{getEquipmentStatusBadge(eq.status)}</td>
                      <td className='py-3 px-4 text-right'>
                        <Button
                          variant='ghost'
                          size='sm'
                          onClick={() => router.push(`/inventory/equipment/${eq.id}`)}
                        >
                          Ver Detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className='text-center text-gray-500 py-8'>No hay equipos en este lote</p>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      {batch.status === 'ACTIVE' && (
        <div className='mt-6 flex justify-end gap-3'>
          <Button variant='outline' onClick={() => handleUpdateStatus('COMPLETED')}>
            <CheckCircle2 className='mr-2 h-4 w-4' />
            Marcar como Completado
          </Button>
          <Button
            variant='destructive'
            onClick={() => {
              if (confirm('¿Está seguro de cancelar este lote?')) {
                handleUpdateStatus('CANCELLED')
              }
            }}
          >
            <XCircle className='mr-2 h-4 w-4' />
            Cancelar Lote
          </Button>
        </div>
      )}
    </div>
  )
}
