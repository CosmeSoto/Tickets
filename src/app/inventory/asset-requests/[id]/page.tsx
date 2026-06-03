'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssetRequestDetail } from '@/components/inventory/asset-requests/asset-request-detail'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { AssetRequestStatus, AssetType } from '@prisma/client'
import { ModuleLayout } from '@/components/common/layout/module-layout'

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

  const loadRequest = async () => {
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
  }

  useEffect(() => {
    loadRequest()
  }, [params.id])

  if (isLoading) {
    return (
      <ModuleLayout
        title='Cargando...'
        subtitle='Obteniendo información de la solicitud'
        loading={true}
      >
        <div className='container mx-auto py-6'>
          <div className='flex items-center justify-center h-64'>
            <RefreshCw className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        </div>
      </ModuleLayout>
    )
  }

  if (!request) {
    return (
      <ModuleLayout title='Solicitud no encontrada' subtitle='La solicitud que buscas no existe'>
        <div className='container mx-auto py-6'>
          <div className='text-center'>
            <p className='text-muted-foreground'>Solicitud no encontrada</p>
            <Link href='/inventory/asset-requests'>
              <Button className='mt-4'>Volver a Solicitudes</Button>
            </Link>
          </div>
        </div>
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title='Detalle de Solicitud'
      subtitle='Información completa de la solicitud'
      headerActions={
        <Button onClick={loadRequest} variant='outline' disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      }
    >
      <div className='container mx-auto py-6 space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <Link href='/inventory/asset-requests'>
              <Button variant='ghost' size='icon'>
                <ArrowLeft className='h-4 w-4' />
              </Button>
            </Link>
          </div>
        </div>

        {/* Detalle */}
        <AssetRequestDetail request={request} />
      </div>
    </ModuleLayout>
  )
}
