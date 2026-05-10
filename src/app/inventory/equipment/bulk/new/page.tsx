/**
 * Página de creación por lote de equipos
 *
 * Ruta: /inventory/equipment/bulk/new
 * Requiere autenticación y permisos de gestión de inventario
 */

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { BulkEquipmentForm } from '@/components/inventory/equipment/BulkEquipmentForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BulkCreateResult } from '@/types/equipment-grouping'

export default function BulkEquipmentNewPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultFamilyId = searchParams.get('familyId') ?? undefined

  const handleSuccess = (_result: BulkCreateResult) => {
    // Redirigir a la vista de inventario después de 3 segundos
    setTimeout(() => {
      router.push('/inventory/equipment')
    }, 3000)
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <div className='max-w-5xl mx-auto space-y-4'>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>Nuevo Lote de Activos</h1>
        <p className='text-sm text-muted-foreground'>
          Registra varias unidades de una misma familia en un solo flujo.
        </p>
      </div>

      <button
        type='button'
        onClick={() => router.push('/inventory')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Inventario
      </button>

      <Card>
        <CardHeader>
          <CardTitle>Datos del Lote de Activos</CardTitle>
          <CardDescription>
            Selecciona la familia y completa la información para crear múltiples activos de forma
            consistente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkEquipmentForm
            defaultFamilyId={defaultFamilyId}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  )
}
