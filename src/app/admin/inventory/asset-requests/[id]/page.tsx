'use client'

import { useEffect, useState } from 'react'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetRequestDetail } from '@/components/inventory/asset-requests/asset-request-detail'
import { ApproveRejectDialog } from '@/components/inventory/asset-requests/approve-reject-dialog'
import { ArrowLeft, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AssetRequestStatus, AssetType } from '@prisma/client'

interface ReviewComment {
  id: string
  userId: string
  userName: string
  userRole: string
  comment: string
  createdAt: string
}

interface AssetRequestDetailData {
  id: string
  code: string
  assetType: AssetType
  description: string
  justification: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  assetId?: string | null
  assetName?: string | null
  quantity: number
  neededBy?: string | null
  reviewerComment?: string | null
  reviewedById?: string | null
  reviewedByName?: string | null
  reviewedAt?: string | null
  fulfilledById?: string | null
  fulfilledByName?: string | null
  fulfilledAt?: string | null
  reviewComments: ReviewComment[]
  createdAt: string
  updatedAt: string
}

export default function AdminAssetRequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [request, setRequest] = useState<AssetRequestDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Diálogo unificado aprobar/rechazar (flujo con equipos y state machine)
  const [approveRejectDialog, setApproveRejectDialog] = useState<{
    open: boolean
    action: 'APPROVED' | 'REJECTED'
  }>({ open: false, action: 'APPROVED' })

  const loadRequest = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/inventory/asset-requests/${params.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Solicitud no encontrada')
          router.push('/admin/inventory/asset-requests')
          return
        }
        throw new Error('Error al cargar solicitud')
      }

      const data = await response.json()
      setRequest(data)
    } catch (error) {
      console.error('Error:', error)
      toast.error('Error al cargar solicitud')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRequest()
  }, [params.id])

  const handleReviewSuccess = () => {
    loadRequest()
  }

  const canApprove = request && (request.status === 'PENDING' || request.status === 'UNDER_REVIEW')
  const canReject = request && (request.status === 'PENDING' || request.status === 'UNDER_REVIEW')

  useSyncDashboardPageMeta({
    title: request ? `Solicitud ${request.code}` : 'Revisar solicitud',
    subtitle: request
      ? `${request.familyName} · ${request.status}`
      : isLoading
        ? 'Cargando…'
        : 'Detalle de solicitud de activo',
  })

  if (isLoading) {
    return (
      <div className='container mx-auto py-6'>
        <div className='flex items-center justify-center h-64'>
          <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className='container mx-auto py-6'>
        <div className='text-center'>
          <p className='text-muted-foreground'>Solicitud no encontrada</p>
          <Link href='/admin/inventory/asset-requests'>
            <Button className='mt-4'>Volver a Solicitudes</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className='container mx-auto py-6 space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <Link href='/admin/inventory/asset-requests'>
            <Button variant='ghost' size='icon'>
              <ArrowLeft className='h-4 w-4' />
            </Button>
          </Link>
        </div>
        <div className='flex gap-2'>
          <Button onClick={loadRequest} variant='outline' disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          {canReject && (
            <Button
              variant='destructive'
              onClick={() => setApproveRejectDialog({ open: true, action: 'REJECTED' })}
            >
              <XCircle className='mr-2 h-4 w-4' />
              Rechazar
            </Button>
          )}
          {canApprove && (
            <Button onClick={() => setApproveRejectDialog({ open: true, action: 'APPROVED' })}>
              <CheckCircle className='mr-2 h-4 w-4' />
              Aprobar
            </Button>
          )}
        </div>
      </div>

      {/* Detalle */}
      <AssetRequestDetail request={request} />

      {/* Diálogos */}
      <ApproveRejectDialog
        open={approveRejectDialog.open}
        onOpenChange={open => setApproveRejectDialog(prev => ({ ...prev, open }))}
        requestId={request.id}
        requestCode={request.code}
        action={approveRejectDialog.action}
        quantity={request.quantity}
        assetTypeId={request.assetId || undefined}
        assetType={request.assetType}
        onSuccess={handleReviewSuccess}
      />
    </div>
  )
}
