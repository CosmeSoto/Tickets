'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { AssetRequestCreateForm } from '@/components/inventory/asset-requests/asset-request-create-form'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { ArrowLeft, Plus } from 'lucide-react'

export default function CreateAssetRequestPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  // Guard de acceso: solo usuarios con canRequestAssets (o ADMIN/SuperAdmin)
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.replace('/login')
      return
    }
    const isSuperAdmin = (session.user as any)?.isSuperAdmin === true
    const isAdmin = session.user.role === 'ADMIN'
    const canReq = (session.user as any)?.canRequestAssets === true
    if (!isSuperAdmin && !isAdmin && !canReq) {
      const fallback = session.user.role === 'TECHNICIAN' ? '/technician' : '/client'
      router.replace(fallback)
    }
  }, [session, status, router])

  const handleSuccess = () => {
    router.push('/inventory/asset-requests')
  }

  const handleCancel = () => {
    router.back()
  }

  return (
    <ModuleLayout
      title='Nueva Solicitud de Activo'
      subtitle='Completa el formulario para solicitar un activo'
      headerActions={
        <Link href='/inventory/asset-requests' passHref>
          <button className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'>
            <ArrowLeft className='h-4 w-4' />
            Volver al Listado
          </button>
        </Link>
      }
    >
      <div className='max-w-4xl mx-auto'>
        <AssetRequestCreateForm onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </ModuleLayout>
  )
}
