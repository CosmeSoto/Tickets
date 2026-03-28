'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { UnifiedAssetForm } from '@/components/inventory/unified-asset-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export default function NewEquipmentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    else if (session?.user?.role === 'CLIENT') router.push('/inventory')
  }, [status, session, router])

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title="Nuevo Activo" subtitle="Cargando...">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session?.user || session.user.role === 'CLIENT') return null

  return (
    <RoleDashboardLayout
      title="Nuevo Activo"
      subtitle="Registra un nuevo activo en el inventario"
    >
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Información del Activo</CardTitle>
            <CardDescription>
              Selecciona la familia del activo para ver los campos correspondientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UnifiedAssetForm
              onSuccess={() => router.push('/inventory')}
              onCancel={() => router.push('/inventory')}
            />
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
