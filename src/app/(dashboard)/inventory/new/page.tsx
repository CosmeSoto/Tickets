'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Layers, Package } from 'lucide-react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FamilySelector } from '@/components/inventory/family-selector'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { Button } from '@/components/ui/button'

type CreationMode = 'individual' | 'bulk'

export default function NewInventoryPage() {
  const router = useRouter()
  const { families, loading } = useFamilyOptions()
  const [mode, setMode] = useState<CreationMode>('individual')

  const handleFamilySelect = (familyId: string) => {
    const targetPath =
      mode === 'bulk' ? '/inventory/equipment/bulk/new' : '/inventory/equipment/new'
    router.push(`${targetPath}?familyId=${familyId}`)
  }

  return (
    <RoleDashboardLayout
      title='Nuevo Activo'
      subtitle='Selecciona modalidad y familia para continuar'
    >
      <div className='max-w-4xl mx-auto space-y-4'>
        <button
          type='button'
          onClick={() => router.push('/inventory')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Inventario
        </button>

        <Card>
          <CardHeader className='space-y-4'>
            <div>
              <CardTitle>¿Cómo deseas crear el activo?</CardTitle>
              <CardDescription>
                Elige si crearás un activo individual o un lote y luego selecciona la familia.
              </CardDescription>
            </div>

            <div className='inline-flex rounded-lg border bg-muted/30 p-1 gap-1 w-fit'>
              <Button
                type='button'
                size='sm'
                variant={mode === 'individual' ? 'default' : 'ghost'}
                className='h-8'
                onClick={() => setMode('individual')}
              >
                <Package className='h-4 w-4 mr-1.5' />
                Activo individual
              </Button>
              <Button
                type='button'
                size='sm'
                variant={mode === 'bulk' ? 'default' : 'ghost'}
                className='h-8'
                onClick={() => setMode('bulk')}
              >
                <Layers className='h-4 w-4 mr-1.5' />
                Lote de activos
              </Button>
            </div>
          </CardHeader>

          <CardContent className='space-y-4'>
            <p className='text-sm font-medium'>Selecciona una familia</p>
            {loading ? (
              <p className='text-sm text-muted-foreground'>Cargando familias...</p>
            ) : (
              <FamilySelector families={families} onSelect={handleFamilySelect} />
            )}
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
