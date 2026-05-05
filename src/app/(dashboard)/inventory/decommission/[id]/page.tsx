'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DecommissionApprovalPanel } from '@/components/inventory/decommission/DecommissionApprovalPanel'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function DecommissionDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const { data: session, status } = useSession()
  const router = useRouter()

  const [request, setRequest] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const role = session?.user?.role ?? ''
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const canManageInventory = (session?.user as any)?.canManageInventory === true

  const userContext = {
    id: session?.user?.id ?? '',
    role,
    isSuperAdmin,
    canManageInventory,
  }

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    loadRequest()
  }, [status, session, id]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRequest = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/inventory/decommission-acts/${id}`)
      if (!res.ok) {
        if (res.status === 404) setError('Solicitud no encontrada')
        else if (res.status === 403) setError('No tienes permiso para ver esta solicitud')
        else setError('Error al cargar la solicitud')
        return
      }
      const data = await res.json()
      setRequest(data)
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const handleActionComplete = () => {
    // Recargar para reflejar el nuevo estado
    loadRequest()
  }

  const assetName = request
    ? request.assetType === 'EQUIPMENT'
      ? `${request.equipment?.code ?? ''} — ${request.equipment?.brand ?? ''} ${request.equipment?.model ?? ''}`
      : (request.license?.name ?? 'Licencia')
    : ''

  return (
    <ModuleLayout
      title='Solicitud de Baja'
      subtitle={assetName || 'Detalle de la solicitud'}
      loading={loading}
      headerActions={
        <Button variant='outline' size='sm' onClick={() => router.push('/inventory/decommission')}>
          <ArrowLeft className='h-4 w-4 mr-1.5' />
          Volver a bajas
        </Button>
      }
    >
      {loading ? (
        <div className='flex items-center justify-center py-20'>
          <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      ) : error ? (
        <div className='flex flex-col items-center justify-center py-20 gap-4'>
          <p className='text-muted-foreground'>{error}</p>
          <Button variant='outline' onClick={() => router.push('/inventory/decommission')}>
            <ArrowLeft className='h-4 w-4 mr-1.5' />
            Volver a bajas
          </Button>
        </div>
      ) : request ? (
        <div className='max-w-2xl'>
          <DecommissionApprovalPanel
            request={request}
            userContext={userContext}
            onActionComplete={handleActionComplete}
          />
        </div>
      ) : null}
    </ModuleLayout>
  )
}
