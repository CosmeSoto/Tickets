'use client'

import { useState, useEffect, use } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DecommissionApprovalPanel } from '@/components/inventory/decommission/DecommissionApprovalPanel'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

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
    loadRequest()
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/decommission-acts/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al eliminar')
      toast({
        title: 'Solicitud eliminada',
        description: 'La solicitud de baja fue eliminada permanentemente.',
      })
      setShowDeleteDialog(false)
      router.push('/inventory/decommission')
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
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
        <div className='flex items-center gap-2'>
          {isSuperAdmin && request && (
            <Button
              variant='outline'
              size='sm'
              className='border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400'
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className='h-4 w-4 mr-1.5' />
              Eliminar
            </Button>
          )}
          <Button
            variant='outline'
            size='sm'
            onClick={() => router.push('/inventory/decommission')}
          >
            <ArrowLeft className='h-4 w-4 mr-1.5' />
            Volver a bajas
          </Button>
        </div>
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

      {/* Dialog: Eliminar (SuperAdmin) */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar solicitud de baja</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar esta solicitud de baja permanentemente. La auditoría quedará
              registrada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className='bg-red-600 hover:bg-red-700'
            >
              {deleting ? 'Eliminando...' : 'Eliminar permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
