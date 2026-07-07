/**
 * Página: Crear Modelo de Equipo
 * /inventory/models/create
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ModelForm } from '@/components/inventory/models/ModelForm'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

export default function CreateModelPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (data: any) => {
    try {
      setIsLoading(true)

      // Parsear datos
      const payload = {
        brand: data.brand,
        model: data.model,
        sku: data.sku || undefined,
        typeId: data.typeId,
        specifications: data.specifications
          ? (() => {
              try {
                return JSON.parse(data.specifications)
              } catch {
                return { description: data.specifications }
              }
            })()
          : undefined,
        defaultAccessories: data.defaultAccessories
          ? data.defaultAccessories
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => line.length > 0)
          : undefined,
        standardPrice: data.standardPrice ? parseFloat(data.standardPrice) : undefined,
        modelPhotoUrl: data.modelPhotoUrl || undefined,
        isActive: data.isActive ?? true,
      }

      const response = await fetch('/api/inventory/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear modelo')
      }

      const model = await response.json()

      toast({
        title: 'Modelo creado',
        description: `El modelo ${model.brand} ${model.model} fue creado exitosamente`,
      })

      router.push(`/inventory/models/${model.id}`)
    } catch (error: any) {
      console.error('Error creating model:', error)
      toast({
        title: 'Error',
        description: error.message || 'No se pudo crear el modelo',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-4'>
        <Button variant='ghost' size='icon' onClick={() => router.back()}>
          <ArrowLeft className='h-4 w-4' />
        </Button>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Crear Modelo</h1>
          <p className='text-muted-foreground'>Agrega un nuevo modelo al catálogo maestro</p>
        </div>
      </div>

      {/* Formulario */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Modelo</CardTitle>
          <CardDescription>
            Completa los datos del modelo. Los campos marcados con * son obligatorios.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ModelForm onSubmit={handleSubmit} onCancel={() => router.back()} isLoading={isLoading} />
        </CardContent>
      </Card>
    </div>
  )
}
