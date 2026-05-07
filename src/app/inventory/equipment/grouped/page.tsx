/**
 * Página de inventario agrupado
 *
 * Ruta: /inventory/equipment/grouped
 * Requiere autenticación y permisos de gestión de inventario
 *
 * Muestra equipos agrupados por modelo con contadores de estado
 */

'use client'

import { useRouter } from 'next/navigation'
import { GroupedInventoryTable } from '@/components/inventory/equipment/GroupedInventoryTable'

export default function GroupedInventoryPage() {
  const router = useRouter()

  const handleCreateBulk = (prefillData: any) => {
    // Navegar a la página de creación por lote con datos pre-llenados
    const params = new URLSearchParams({
      brand: prefillData.brand || '',
      model: prefillData.model || '',
      typeId: prefillData.typeId || '',
    })
    router.push(`/inventory/equipment/bulk/new?${params}`)
  }

  return (
    <div className='container mx-auto py-8 px-4'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold'>Vista Agrupada de Inventario</h1>
        <p className='text-muted-foreground mt-2'>
          Equipos agrupados por modelo con contadores de estado en tiempo real
        </p>
      </div>

      {/* Tabla agrupada */}
      <GroupedInventoryTable onCreateBulk={handleCreateBulk} />
    </div>
  )
}
