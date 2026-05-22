'use client'

import { use, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentAssetForm } from '@/components/inventory/asset-forms/EquipmentAssetForm'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Equipment } from '@/types/inventory/equipment'
import type { FamilyConfig } from '@/lib/inventory/family-config-types'
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
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
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
      console.error('Error cargando datos:', error)
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

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Cargando...' subtitle='Obteniendo información del equipo'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  if (!equipment) {
    return (
      <RoleDashboardLayout title='Error' subtitle='Equipo no encontrado'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>No se encontró el equipo solicitado</p>
        </div>
      </RoleDashboardLayout>
    )
  }

  const familyId = equipment.type?.familyId
  const familyCode = equipment.type?.family?.code

  if (!familyId || !familyConfig) {
    return (
      <RoleDashboardLayout title='Error' subtitle='Configuración de familia no encontrada'>
        <div className='flex items-center justify-center h-64'>
          <p className='text-muted-foreground'>
            No se encontró la configuración de la familia del equipo
          </p>
        </div>
      </RoleDashboardLayout>
    )
  }

  const getEquipmentBrand = () => {
    if (equipment.model?.brand?.name) return equipment.model.brand.name
    if (equipment.brand) return equipment.brand
    return ''
  }
  const getEquipmentModel = () => {
    if (equipment.model?.model) return equipment.model.model
    if (equipment.modelDeprecated) return equipment.modelDeprecated
    return ''
  }
  const equipmentTitle = [equipment.type?.name, getEquipmentBrand(), getEquipmentModel()]
    .filter(Boolean)
    .join(' · ')

  return (
    <RoleDashboardLayout title={equipmentTitle || equipment.code} subtitle={equipment.code}>
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
            />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
