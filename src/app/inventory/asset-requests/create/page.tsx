'use client'

import { useRouter } from 'next/navigation'
import { AssetRequestCreateForm } from '@/components/inventory/asset-requests/asset-request-create-form'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { ArrowLeft } from 'lucide-react'

export default function CreateAssetRequestPage() {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/inventory/asset-requests')
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <RoleDashboardLayout
      title='Nueva Solicitud de Activo'
      subtitle='Completa el formulario para solicitar un activo'
    >
      <div className='max-w-4xl mx-auto space-y-4'>
        <button
          type='button'
          onClick={() => router.push('/inventory/asset-requests')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Solicitudes de Activos
        </button>
        <AssetRequestCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </RoleDashboardLayout>
  )
}
