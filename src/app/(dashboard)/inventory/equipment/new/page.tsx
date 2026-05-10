'use client'

import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { UnifiedAssetForm } from '@/components/inventory/unified-asset-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

// Títulos y descripciones del Card según el paso actual
const STEP_CONTENT = {
  1: {
    title: 'Selecciona una familia',
    description: 'Elige el área de la organización a la que pertenece este activo.',
  },
  2: {
    title: 'Selecciona el tipo de activo',
    description: 'Indica si es un equipo físico, una licencia/contrato o un Consumible.',
  },
  3: {
    title: 'Completa la información del activo',
    description: 'Rellena los datos del activo. Los campos marcados con * son obligatorios.',
  },
} as const

export default function NewEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultFamilyId = searchParams.get('familyId') ?? undefined

  // Paso actual del formulario — para actualizar el Card dinámicamente
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(defaultFamilyId ? 2 : 1)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Nuevo Activo Individual' subtitle='Cargando...'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  const stepContent = STEP_CONTENT[currentStep]

  return (
    <RoleDashboardLayout
      title='Nuevo Activo Individual'
      subtitle='Registra un activo individual en el inventario'
    >
      <div className='max-w-4xl mx-auto space-y-4'>
        {/* Botón volver — regresa a la pantalla de selección de modalidad/familia */}
        <button
          type='button'
          onClick={() => router.push('/inventory/new')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Cambiar modalidad o familia
        </button>

        <Card>
          {/* Título y descripción dinámicos según el paso */}
          <CardHeader className='pb-2'>
            <CardTitle className='text-lg'>{stepContent.title}</CardTitle>
            <CardDescription>{stepContent.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedAssetForm
              defaultFamilyId={defaultFamilyId}
              onStepChange={setCurrentStep}
              onSuccess={() => router.push('/inventory')}
              onCancel={() => router.push('/inventory/new')}
            />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
