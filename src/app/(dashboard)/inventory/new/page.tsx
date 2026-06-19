'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Layers, Package } from 'lucide-react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FamilySelector } from '@/components/inventory/family-selector'
import { useFamilyOptions } from '@/hooks/use-family-options'
import { Button } from '@/components/ui/button'

type CreationMode = 'individual' | 'bulk'

export default function NewInventoryPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { families, loading } = useFamilyOptions()

  // Si viene ?mode=bulk o ?mode=individual en la URL, se usa directamente sin mostrar selector
  const presetMode = searchParams?.get('mode') as CreationMode | null
  const [mode, setMode] = useState<CreationMode>(presetMode === 'bulk' ? 'bulk' : 'individual')

  const handleFamilySelect = (familyId: string) => {
    const targetPath =
      mode === 'bulk' ? '/inventory/equipment/bulk/new' : '/inventory/equipment/new'
    router.push(`${targetPath}?familyId=${familyId}`)
  }

  const title = mode === 'bulk' ? 'Nuevo Lote' : 'Nuevo Activo'
  const subtitle =
    mode === 'bulk'
      ? 'Selecciona la familia para crear un lote de activos'
      : 'Selecciona la familia para crear un activo individual'

  return (
    <ModuleLayout title={title} subtitle={subtitle}>
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
              <CardTitle>
                {mode === 'bulk'
                  ? '¿A qué familia pertenece el lote?'
                  : '¿A qué familia pertenece el activo?'}
              </CardTitle>
              <CardDescription>
                {mode === 'bulk'
                  ? 'Selecciona la familia donde se registrará el lote de activos.'
                  : 'Selecciona la familia donde se registrará el activo.'}
              </CardDescription>
            </div>

            {/* Selector de modalidad — solo si no viene pre-definido en la URL */}
            {!presetMode && (
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
            )}
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
    </ModuleLayout>
  )
}
