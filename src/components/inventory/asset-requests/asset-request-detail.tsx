'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AssetRequestStatusBadge } from './asset-request-status-badge'
import { AssetTypeBadge } from './asset-type-badge'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { Calendar, User, Package, FileText, MessageSquare } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AssetRequestStatus, AssetType } from '@prisma/client'

interface ReviewComment {
  id: string
  userId: string
  userName: string
  userRole: string
  comment: string
  createdAt: string
}

interface AssetRequestDetail {
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

interface AssetRequestDetailProps {
  request: AssetRequestDetail
}

export function AssetRequestDetail({ request }: AssetRequestDetailProps) {
  return (
    <div className='space-y-6'>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between'>
            <div>
              <CardTitle className='text-2xl'>{request.code}</CardTitle>
              <CardDescription>
                Creada{' '}
                {format(new Date(request.createdAt), "d 'de' MMMM 'de' yyyy", { locale: es })}
              </CardDescription>
            </div>
            <AssetRequestStatusBadge status={request.status} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Tipo de Activo</p>
              <AssetTypeBadge type={request.assetType} />
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Familia</p>
              <FamilyBadge family={{ name: request.familyName }} />
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Solicitante</p>
              <div className='flex items-center gap-2'>
                <User className='h-4 w-4 text-muted-foreground' />
                <p className='font-medium'>{request.requesterName}</p>
              </div>
            </div>
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Cantidad</p>
              <div className='flex items-center gap-2'>
                <Package className='h-4 w-4 text-muted-foreground' />
                <p className='font-medium'>{request.quantity}</p>
              </div>
            </div>
          </div>

          {request.neededBy && (
            <div className='space-y-1'>
              <p className='text-sm text-muted-foreground'>Fecha Necesaria</p>
              <div className='flex items-center gap-2'>
                <Calendar className='h-4 w-4 text-muted-foreground' />
                <p className='font-medium'>
                  {format(new Date(request.neededBy), "d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Descripción y Justificación */}
      <Card>
        <CardHeader>
          <CardTitle>Detalles de la Solicitud</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-muted-foreground' />
              <p className='font-medium'>Descripción</p>
            </div>
            <p className='text-sm text-muted-foreground pl-6'>{request.description}</p>
          </div>

          <Separator />

          <div className='space-y-2'>
            <div className='flex items-center gap-2'>
              <FileText className='h-4 w-4 text-muted-foreground' />
              <p className='font-medium'>Justificación</p>
            </div>
            <p className='text-sm text-muted-foreground pl-6'>{request.justification}</p>
          </div>
        </CardContent>
      </Card>

      {/* Revisión */}
      {(request.reviewerComment || request.reviewedByName) && (
        <Card>
          <CardHeader>
            <CardTitle>Revisión</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {request.reviewedByName && (
              <div className='space-y-1'>
                <p className='text-sm text-muted-foreground'>Revisado por</p>
                <p className='font-medium'>{request.reviewedByName}</p>
              </div>
            )}

            {request.reviewedAt && (
              <div className='space-y-1'>
                <p className='text-sm text-muted-foreground'>Fecha de Revisión</p>
                <p className='font-medium'>
                  {format(new Date(request.reviewedAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            )}

            {request.reviewerComment && (
              <div className='space-y-2'>
                <p className='text-sm text-muted-foreground'>Comentario</p>
                <div className='rounded-lg bg-muted p-4'>
                  <p className='text-sm'>{request.reviewerComment}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cumplimiento */}
      {(request.fulfilledByName || request.fulfilledAt) && (
        <Card>
          <CardHeader>
            <CardTitle>Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            {request.fulfilledByName && (
              <div className='space-y-1'>
                <p className='text-sm text-muted-foreground'>Cumplido por</p>
                <p className='font-medium'>{request.fulfilledByName}</p>
              </div>
            )}

            {request.fulfilledAt && (
              <div className='space-y-1'>
                <p className='text-sm text-muted-foreground'>Fecha de Cumplimiento</p>
                <p className='font-medium'>
                  {format(new Date(request.fulfilledAt), "d 'de' MMMM 'de' yyyy 'a las' HH:mm", {
                    locale: es,
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Comentarios */}
      {request.reviewComments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2'>
              <MessageSquare className='h-5 w-5' />
              Comentarios ({request.reviewComments.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='space-y-4'>
              {request.reviewComments.map(comment => (
                <div key={comment.id} className='rounded-lg border p-4 space-y-2'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <p className='font-medium'>{comment.userName}</p>
                      <Badge variant='outline' className='text-xs'>
                        {comment.userRole}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>
                      {format(new Date(comment.createdAt), 'd MMM yyyy HH:mm', { locale: es })}
                    </p>
                  </div>
                  <p className='text-sm text-muted-foreground'>{comment.comment}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
