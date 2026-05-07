/**
 * Página: Crear Lote de Equipos
 * Permite crear un nuevo lote con múltiples equipos
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BatchForm } from '@/components/inventory/batches/BatchForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface BatchCreateResult {
  batchId: string
  equipmentCreated: number
  codes: string[]
}

export default function CreateBatchPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<BatchCreateResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Datos mock para suppliers y warehouses (en producción vendrían de la API)
  const suppliers = [
    { id: '1', name: 'Proveedor A' },
    { id: '2', name: 'Proveedor B' },
  ]

  const warehouses = [
    { id: '1', name: 'Bodega Principal' },
    { id: '2', name: 'Bodega Secundaria' },
  ]

  const handleSubmit = async (data: any) => {
    setIsLoading(true)
    setError(null)

    try {
      // Preparar seriales
      const serialNumbers = data.serialNumbers
        ? data.serialNumbers
            .split('\n')
            .map((s: string) => s.trim())
            .filter((s: string) => s.length > 0)
        : []

      const response = await fetch('/api/inventory/batches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          modelId: data.modelId,
          quantity: data.quantity,
          serialNumbers: serialNumbers.length > 0 ? serialNumbers : undefined,
          supplierId: data.supplierId || undefined,
          invoiceNumber: data.invoiceNumber || undefined,
          purchasePrice: data.purchasePrice || undefined,
          purchaseDate: data.purchaseDate || undefined,
          warehouseId: data.warehouseId || undefined,
          notes: data.notes || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Error creando el lote')
      }

      const resultData = await response.json()

      setResult({
        batchId: resultData.batch.id,
        equipmentCreated: resultData.equipmentCreated,
        codes: resultData.codes || [],
      })
    } catch (err: any) {
      console.error('Error creando lote:', err)
      setError(err.message || 'Error desconocido')
    } finally {
      setIsLoading(false)
    }
  }

  // Vista de resultado exitoso
  if (result) {
    return (
      <div className='container mx-auto py-8 px-4 max-w-4xl'>
        <Card>
          <CardHeader>
            <div className='flex items-center gap-3'>
              <CheckCircle2 className='h-8 w-8 text-green-500' />
              <div>
                <CardTitle>Lote Creado Exitosamente</CardTitle>
                <CardDescription>
                  Se crearon {result.equipmentCreated} equipos en el lote
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className='space-y-6'>
            <div>
              <h3 className='font-semibold mb-2'>Resumen:</h3>
              <ul className='list-disc list-inside space-y-1 text-sm text-gray-600'>
                <li>Lote ID: {result.batchId}</li>
                <li>Equipos creados: {result.equipmentCreated}</li>
                {result.codes.length > 0 && (
                  <li>
                    Códigos: {result.codes[0]} a {result.codes[result.codes.length - 1]}
                  </li>
                )}
              </ul>
            </div>

            <div className='flex gap-3'>
              <Button onClick={() => router.push(`/inventory/batches/${result.batchId}`)}>
                Ver Detalle del Lote
              </Button>
              <Button variant='outline' onClick={() => router.push('/inventory/batches')}>
                Ver Todos los Lotes
              </Button>
              <Button
                variant='outline'
                onClick={() => {
                  setResult(null)
                  setError(null)
                }}
              >
                Crear Otro Lote
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Vista del formulario
  return (
    <div className='container mx-auto py-8 px-4 max-w-4xl'>
      <div className='mb-6'>
        <Link href='/inventory/batches'>
          <Button variant='ghost' size='sm'>
            <ArrowLeft className='mr-2 h-4 w-4' />
            Volver a Lotes
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear Nuevo Lote</CardTitle>
          <CardDescription>
            Crea un lote de equipos idénticos. Los equipos se crearán automáticamente con códigos
            secuenciales.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className='mb-6 p-4 bg-red-50 border border-red-200 rounded-md'>
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          )}

          <BatchForm
            onSubmit={handleSubmit}
            onCancel={() => router.push('/inventory/batches')}
            isLoading={isLoading}
            suppliers={suppliers}
            warehouses={warehouses}
          />
        </CardContent>
      </Card>
    </div>
  )
}
