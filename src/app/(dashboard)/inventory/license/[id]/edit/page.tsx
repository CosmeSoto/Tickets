'use client'

import { use, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { LicenseAssetForm } from '@/components/inventory/asset-forms/LicenseAssetForm'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { toast } from 'sonner'

interface EditLicensePageProps {
  params: Promise<{ id: string }>
}

export default function EditLicensePage({ params }: EditLicensePageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [license, setLicense] = useState<Record<string, unknown> | null>(null)
  const [familyConfig, setFamilyConfig] = useState<FamilyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const canManageInventory = (session?.user as any)?.canManageInventory === true
  const canEdit =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'TECHNICIAN' ||
    canManageInventory

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated' && !canEdit) {
      router.push(`/inventory/license/${id}`)
    }
  }, [status, canEdit, router, id])

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const licenseRes = await fetch(`/api/inventory/licenses/${id}`)
      if (!licenseRes.ok) throw new Error('Error cargando licencia')
      const licenseData = await licenseRes.json()
      setLicense(licenseData)

      const familyId = licenseData.licenseType?.familyId
      if (familyId) {
        const configRes = await fetch(`/api/inventory/family-config/${familyId}`)
        if (configRes.ok) {
          const configData = await configRes.json()
          setFamilyConfig(configData.data ?? configData)
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo cargar la licencia'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (payload: Record<string, unknown>) => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      const response = await fetch(`/api/inventory/licenses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al actualizar la licencia')
      }
      toast.success('Licencia actualizada exitosamente')
      setTimeout(() => router.push(`/inventory/license/${id}`), 1500)
    } catch (error) {
      console.error('Error actualizando licencia:', error)
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      setSubmitError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información de la licencia'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user || !canEdit) return null

  if (!license) {
    return (
      <ModuleLayout title='Error' subtitle='Licencia no encontrada'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>No se encontró la licencia solicitada</p>
        </div>
      </ModuleLayout>
    )
  }

  const familyId = (license.licenseType as { familyId?: string })?.familyId

  if (!familyId || !familyConfig) {
    return (
      <ModuleLayout title='Error' subtitle='Configuración de familia no encontrada'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>
            No se encontró la configuración de la familia de la licencia
          </p>
        </div>
      </ModuleLayout>
    )
  }

  const licenseName = typeof license.name === 'string' ? license.name : 'Licencia'

  return (
    <ModuleLayout title={licenseName} subtitle='Editar licencia'>
      <div className='max-w-4xl mx-auto space-y-4'>
        <button
          type='button'
          onClick={() => router.push(`/inventory/license/${id}`)}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Regresar al detalle
        </button>

        <Card>
          <CardContent className='pt-6'>
            <LicenseAssetForm
              familyId={familyId}
              familyConfig={familyConfig}
              onSubmit={handleSubmit}
              onBack={() => router.push(`/inventory/license/${id}`)}
              submitting={submitting}
              submitError={submitError}
              isEditMode
              initialLicense={license}
              licenseId={id}
            />
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
