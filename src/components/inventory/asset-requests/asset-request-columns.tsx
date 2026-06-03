'use client'

import { Eye, Clock, AlertCircle, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AssetRequestStatusBadge } from './asset-request-status-badge'
import { AssetTypeBadge } from './asset-type-badge'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import type { ColumnConfig } from '@/types/views'
import { AssetRequestStatus, AssetType } from '@prisma/client'

interface AssetRequest {
  id: string
  code: string
  assetType: AssetType
  description: string
  familyId: string
  familyName: string
  status: AssetRequestStatus
  requesterId: string
  requesterName: string
  createdAt: string
  updatedAt: string
  slaDeadline?: string | null
}

interface AssetRequestColumnsProps {
  onView: (request: AssetRequest) => void
}

export function createAssetRequestColumns({
  onView,
}: AssetRequestColumnsProps): ColumnConfig<AssetRequest>[] {
  return [
    {
      id: 'code',
      header: 'Código',
      accessor: item => <span className='font-medium'>{item.code}</span>,
      sortable: true,
    },
    {
      id: 'assetType',
      header: 'Tipo',
      accessor: item => <AssetTypeBadge type={item.assetType} />,
      sortable: true,
    },
    {
      id: 'description',
      header: 'Descripción',
      accessor: item => <span className='max-w-xs truncate block'>{item.description}</span>,
      sortable: true,
    },
    {
      id: 'family',
      header: 'Familia',
      accessor: item => <FamilyBadge family={{ name: item.familyName }} />,
      sortable: true,
    },
    {
      id: 'requester',
      header: 'Solicitante',
      accessor: item => (
        <div className='flex items-center gap-2'>
          <User className='h-4 w-4 text-muted-foreground shrink-0' />
          <span className='text-sm'>{item.requesterName}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: 'status',
      header: 'Estado',
      accessor: item => <AssetRequestStatusBadge status={item.status} />,
      sortable: true,
    },
    {
      id: 'sla',
      header: 'SLA',
      accessor: item => {
        if (!item.slaDeadline) {
          return <span className='text-xs text-muted-foreground'>—</span>
        }
        const isOverdue = new Date(item.slaDeadline) < new Date()
        const isPending = ['PENDING', 'UNDER_REVIEW', 'APPROVED'].includes(item.status)
        return (
          <div className='flex items-center gap-1'>
            {isOverdue && isPending ? (
              <AlertCircle className='h-3.5 w-3.5 text-red-500' />
            ) : (
              <Clock className='h-3.5 w-3.5 text-muted-foreground' />
            )}
            <span className='text-xs'>
              {formatDistanceToNow(new Date(item.slaDeadline), {
                addSuffix: true,
                locale: es,
              })}
            </span>
          </div>
        )
      },
      sortable: true,
    },
    {
      id: 'createdAt',
      header: 'Creado',
      accessor: item => (
        <div className='flex items-center gap-1 text-sm text-muted-foreground'>
          <Clock className='h-3.5 w-3.5' />
          <span>
            {formatDistanceToNow(new Date(item.createdAt), {
              addSuffix: true,
              locale: es,
            })}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      id: 'actions',
      header: '',
      accessor: item => (
        <Button
          variant='ghost'
          size='sm'
          onClick={e => {
            e.stopPropagation()
            onView(item)
          }}
        >
          <Eye className='h-4 w-4' />
        </Button>
      ),
    },
  ]
}
