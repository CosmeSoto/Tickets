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
    <div className='container mx-auto py-6 px-4 max-w-5xl'>
      {/* Formulario con header integrado */}
      <BulkEquipmentForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  )
}
