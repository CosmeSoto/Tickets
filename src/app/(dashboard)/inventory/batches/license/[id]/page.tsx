'use client'

import { use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthReady } from '@/hooks/auth/use-auth-ready'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { LicenseBatchDetail } from '@/components/inventory/license-batch-detail'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function LicenseBatchDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: session, status } = useAuthReady()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') {
    return (
      <ModuleLayout title='Cargando...' subtitle='Obteniendo información del lote'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary' />
        </div>
      </ModuleLayout>
    )
  }

  if (!session?.user) return null

  // Misma regla que la ficha de licencia individual (ver LicenseDetail) —
  // quien puede editar una licencia puede renovar el lote completo.
  const isSuperAdmin = (session.user as { isSuperAdmin?: boolean }).isSuperAdmin === true
  const canManageInventory =
    (session.user as { canManageInventory?: boolean }).canManageInventory === true
  const isAdmin = session.user.role === 'ADMIN' || isSuperAdmin
  const canEdit = isAdmin || session.user.role === 'TECHNICIAN' || canManageInventory

  return (
    <ModuleLayout
      title='Lote de Licencias'
      subtitle='Información completa del lote y sus licencias'
    >
      <LicenseBatchDetail batchId={id} canEdit={canEdit} />
    </ModuleLayout>
  )
}
