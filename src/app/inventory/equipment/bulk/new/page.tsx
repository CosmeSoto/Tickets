/**
 * Página de creación por lote de equipos
 *
 * Ruta: /inventory/equipment/bulk/new
 * Requiere autenticación y permisos de gestión de inventario
 */

'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BulkEquipmentForm } from '@/components/inventory/equipment/BulkEquipmentForm'
import type { BulkCreateResult } from '@/types/equipment-grouping'

export default function BulkEquipmentNewPage() {
  const router = useRouter()

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
    <div className='container mx-auto py-8 px-4 max-w-4xl'>
      {/* Header */}
      <div className='mb-8'>
        <Button variant='ghost' size='sm' onClick={() => router.back()} className='mb-4'>
          <ArrowLeft className='mr-2 h-4 w-4' />
          Volver
        </Button>
        <h1 className='text-3xl font-bold'>Crear Equipos por Lote</h1>
        <p className='text-muted-foreground mt-2'>
          Crea múltiples equipos idénticos en una sola operación
        </p>
      </div>

      {/* Formulario */}
      <BulkEquipmentForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  )
}
