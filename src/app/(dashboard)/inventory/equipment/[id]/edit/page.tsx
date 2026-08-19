'use client'

import { use, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { EquipmentAssetForm } from '@/components/inventory/asset-forms/EquipmentAssetForm'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Equipment } from '@/types/inventory/equipment'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
import { getEquipmentDisplayName } from '@/lib/utils/equipment-display'
import { toast } from 'sonner'

interface EditEquipmentPageProps {
  params: Promise<{ id: string }>
}

export default function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [familyConfig, setFamilyConfig] = useState<FamilyConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (status === 'authenticated' && session?.user?.role === 'CLIENT') {
      router.push('/inventory')
    }
  }, [status, session, router])

  useEffect(() => {
    if (!id) return
    loadData()
  }, [id])

  const loadData = async () => {
    try {
      setLoading(true)
      const equipmentRes = await fetch(`/api/inventory/equipment/${id}`)
      if (!equipmentRes.ok) throw new Error('Error cargando equipo')
      const equipmentData = await equipmentRes.json()
      const eq = equipmentData.equipment || equipmentData
      if (equipmentData.currentAssignment) eq.currentAssignment = equipmentData.currentAssignment
      setEquipment(eq)

      const familyId = eq.type?.familyId
      if (familyId) {
        const configRes = await fetch(`/api/inventory/family-config/${familyId}`)
        if (configRes.ok) {
          const configData = await configRes.json()
          setFamilyConfig(configData.data ?? configData)
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo cargar el equipo'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (payload: Record<string, unknown>) => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      const response = await fetch(`/api/inventory/equipment/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Error al actualizar el equipo')
      }
      toast.success('Equipo actualizado exitosamente')
      setTimeout(() => router.push(`/inventory/equipment/${id}`), 1500)
    } catch (error) {
      console.error('Error actualizando equipo:', error)
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      setSubmitError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  // Estado de carga inicial
  if (status === 'loading' || loading) {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del equipo'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  if (!equipment) {
    return (
      <ModuleLayout title='Error' subtitle='Equipo no encontrado'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>No se encontró el equipo solicitado</p>
        </div>
      </ModuleLayout>
    )
  }

  const familyId = equipment.type?.familyId
  const familyCode = equipment.type?.family?.code

  if (!familyId || !familyConfig) {
    return (
      <ModuleLayout title='Error' subtitle='Configuración de familia no encontrada'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>
            No se encontró la configuración de la familia del equipo
          </p>
        </div>
      </ModuleLayout>
    )
  }

  const eqModel = typeof equipment.model === 'object' ? equipment.model : null
  const equipmentTitle = getEquipmentDisplayName({
    equipmentCode: equipment.code,
    equipmentTypeName: equipment.type?.name,
    equipmentBrandName: eqModel?.brand?.name || equipment.brand,
    equipmentModelName: eqModel?.model || (equipment as any).modelDeprecated,
  })

  return (
    <ModuleLayout title={equipmentTitle} subtitle={equipment.code}>
      <div className='max-w-4xl mx-auto space-y-4'>
        <button
          type='button'
          onClick={() => router.push(`/inventory/equipment/${id}`)}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Regresar al detalle
        </button>

        <Card>
          <CardContent className='pt-6'>
            <EquipmentAssetForm
              familyId={familyId}
              familyCode={familyCode}
              familyConfig={familyConfig}
              onSubmit={handleSubmit}
              onBack={() => router.push(`/inventory/equipment/${id}`)}
              submitting={submitting}
              submitError={submitError}
              isEditMode={true}
              initialEquipment={equipment}
              equipmentId={id}
            />
          </CardContent>
        </Card>
      </div>
    </ModuleLayout>
  )
}
