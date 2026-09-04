'use client'

import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BulkEquipmentForm } from '@/components/inventory/equipment/BulkEquipmentForm'
import { BulkLicenseForm } from '@/components/inventory/license/BulkLicenseForm'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'

/**
 * Alta de lote masivo — vive bajo `app/inventory` para alinear rutas con el layout
 * de inventario y con la generación de tipos de Next.js.
 *
 * El lote de EQUIPOS crea unidades idénticas (BulkEquipmentForm). Para una familia
 * que solo permite LICENCIAS, eso no aplica — se usa BulkLicenseForm en su lugar,
 * pensado para unidades que varían entre sí (tipo/plan y colaborador asignado).
 * Se decide leyendo el config de la familia elegida, igual que hace el alta
 * individual (UnifiedAssetForm) para elegir el formulario correcto.
 */
export default function NewBulkEquipmentPage() {
  const { data: session, status } = useAuthReady()
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultFamilyId = searchParams.get('familyId') ?? undefined
  const cloneFrom = searchParams.get('cloneFrom') ?? undefined

  const [subtypeMode, setSubtypeMode] = useState<'loading' | 'license' | 'equipment'>('loading')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated' && session?.user?.role === 'CLIENT') {
      router.push('/inventory')
    }
  }, [status, session, router])

  useEffect(() => {
    if (!defaultFamilyId) {
      setSubtypeMode('equipment')
      return
    }
    setSubtypeMode('loading')
    fetch(`/api/inventory/family-config/${defaultFamilyId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        const config = json?.data ?? json
        const allowed: string[] = config?.allowedSubtypes ?? []
        setSubtypeMode(
          allowed.length > 0 && allowed.every(s => s === 'LICENSE') ? 'license' : 'equipment'
        )
      })
      .catch(() => setSubtypeMode('equipment'))
  }, [defaultFamilyId])

  if (status === 'loading' || subtypeMode === 'loading') {
    return (
      <div className='max-w-5xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[40vh] gap-3'>
        <Loader2 className='h-10 w-10 animate-spin text-primary' />
        <p className='text-sm text-muted-foreground'>Cargando...</p>
      </div>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  const isLicenseBulk = subtypeMode === 'license'

  const subtitle = cloneFrom
    ? 'Recompra basada en un lote existente — revisa y ajusta los datos'
    : isLicenseBulk
      ? 'Cada licencia puede tener su propio plan y colaborador asignado'
      : defaultFamilyId
        ? 'Selecciona el tipo de activo y completa los datos del lote'
        : 'Selecciona la familia y completa los datos del lote'

  return (
    <div className='max-w-5xl mx-auto px-4 py-6 space-y-4'>
      <div>
        <h1 className='text-2xl sm:text-3xl font-bold tracking-tight'>
          {isLicenseBulk ? 'Nuevo lote de licencias' : 'Nuevo lote de activos'}
        </h1>
        <p className='text-muted-foreground text-sm sm:text-base mt-1'>{subtitle}</p>
      </div>

      <button
        type='button'
        onClick={() => router.push('/inventory/new')}
        className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
      >
        <ArrowLeft className='h-4 w-4' />
        Cambiar modalidad o familia
      </button>

      <Card>
        <CardContent className='pt-6'>
          {isLicenseBulk && defaultFamilyId ? (
            <BulkLicenseForm
              familyId={defaultFamilyId}
              onSuccess={() => {
                setTimeout(() => router.push('/inventory'), 1500)
              }}
              onCancel={() => router.push('/inventory/new')}
            />
          ) : (
            <BulkEquipmentForm
              defaultFamilyId={defaultFamilyId}
              cloneBatchId={cloneFrom}
              onSuccess={() => {
                setTimeout(() => router.push('/inventory?tab=batches'), 3000)
              }}
              onCancel={() => router.push('/inventory/new')}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
