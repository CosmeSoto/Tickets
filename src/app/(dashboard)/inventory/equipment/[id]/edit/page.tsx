'use client'

import { use, useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentForm } from '@/components/inventory/equipment-form'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft } from 'lucide-react'
import type { Equipment } from '@/types/inventory/equipment'

interface EditEquipmentPageProps {
  params: Promise<{ id: string }>
}

export default function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
  }, [status, session, router])

  useEffect(() => {
    if (!id) return
    loadEquipment()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadEquipment = async () => {
    try {
      const response = await fetch(`/api/inventory/equipment/${id}`)
      if (response.ok) {
        const data = await response.json()
        const eq = data.equipment || data
        if (data.currentAssignment) eq.currentAssignment = data.currentAssignment
        setEquipment(eq)
      }
    } catch (error) {
      console.error('Error cargando equipo:', error)
    } finally {
      setLoading(false)
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

  // Título igual al detalle: "Tipo · Marca Modelo"
  const equipmentTitle = [(equipment as any).type?.name, equipment.brand, equipment.model]
    .filter(Boolean)
    .join(' · ')

  return (
    <RoleDashboardLayout title={equipmentTitle || equipment.code} subtitle={equipment.code}>
      <div className='max-w-4xl mx-auto space-y-4'>
        {/* Botón regresar */}
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
            <EquipmentForm
              equipment={equipment}
              onSuccess={() => router.push(`/inventory/equipment/${id}`)}
              onCancel={() => router.push(`/inventory/equipment/${id}`)}
            />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
