'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { EquipmentFormWrapper } from '@/components/inventory/equipment-form-wrapper'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session?.user?.role === 'CLIENT') {
      router.push('/inventory')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Cargando..." subtitle="Preparando formulario">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') {
    return null
  }

  return (
    <RoleDashboardLayout
      title="Nuevo Equipo"
      subtitle="Registra un nuevo equipo en el inventario"
    >
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Información del Equipo</CardTitle>
            <CardDescription>
              Completa los datos del equipo a registrar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EquipmentFormWrapper />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}

