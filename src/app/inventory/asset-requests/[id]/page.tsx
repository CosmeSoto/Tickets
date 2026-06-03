'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetRequestDetail } from '@/components/inventory/asset-requests/asset-request-detail'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AssetRequestStatus, AssetType } from '@prisma/client'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'

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

export default function AssetRequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [request, setRequest] = useState<AssetRequestDetailData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadRequest = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/inventory/asset-requests/${params.id}`)
      if (!response.ok) {
        if (response.status === 404) {
          toast.error('Solicitud no encontrada')
          router.push('/inventory/asset-requests')
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
  }, [params.id, router])

  useEffect(() => {
    loadRequest()
  }, [loadRequest])

  return (
    <RoleDashboardLayout
      title='Detalle de Solicitud'
      subtitle='Información completa de la solicitud'
      headerActions={
        <Button onClick={loadRequest} variant='outline' disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      }
    >
      <div className='space-y-6'>
        {/* Botón de regreso */}
        <button
          type='button'
          onClick={() => router.push('/inventory/asset-requests')}
          className='flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors'
        >
          <ArrowLeft className='h-4 w-4' />
          Volver al Listado
        </button>

        {isLoading ? (
          <div className='flex items-center justify-center h-64'>
            <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : request ? (
          <AssetRequestDetail request={request} />
        ) : (
          <div className='text-center'>
            <p className='text-muted-foreground'>Solicitud no encontrada</p>
            <Button asChild className='mt-4'>
              <Link href='/inventory/asset-requests'>Volver a Solicitudes</Link>
            </Button>
          </div>
        )}
      </div>
    </RoleDashboardLayout>
  )
}
