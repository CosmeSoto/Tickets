'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AssetRequestStatusBadge } from './asset-request-status-badge'
import { AssetTypeBadge } from './asset-type-badge'
import { FamilyBadge } from '@/components/inventory/family-badge'
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import { AssetRequestStatus, AssetType } from '@prisma/client'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

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
}

interface AssetRequestListProps {
  requests: AssetRequest[]
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading?: boolean
  baseUrl?: string
}

export function AssetRequestList({
  requests,
  total,
  page,
  totalPages,
  onPageChange,
  isLoading = false,
  baseUrl = '/inventory/asset-requests',
}: AssetRequestListProps) {
  return (
    <div className='space-y-4'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Familia</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creada</TableHead>
              <TableHead className='text-right'>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center'>
                  Cargando...
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className='text-center text-muted-foreground'>
                  No hay solicitudes
                </TableCell>
              </TableRow>
            ) : (
              requests.map(request => (
                <TableRow key={request.id}>
                  <TableCell className='font-medium'>{request.code}</TableCell>
                  <TableCell>
                    <AssetTypeBadge type={request.assetType} />
                  </TableCell>
                  <TableCell className='max-w-xs truncate'>{request.description}</TableCell>
                  <TableCell>
                    <FamilyBadge name={request.familyName} />
                  </TableCell>
                  <TableCell>{request.requesterName}</TableCell>
                  <TableCell>
                    <AssetRequestStatusBadge status={request.status} />
                  </TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(request.createdAt), {
                      addSuffix: true,
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell className='text-right'>
                    <Link href={`${baseUrl}/${request.id}`}>
                      <Button variant='ghost' size='sm'>
                        <Eye className='h-4 w-4' />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className='flex items-center justify-between'>
          <div className='text-sm text-muted-foreground'>
            Mostrando {requests.length} de {total} solicitudes
          </div>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className='h-4 w-4' />
              Anterior
            </Button>
            <div className='text-sm'>
              Página {page} de {totalPages}
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages || isLoading}
            >
              Siguiente
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
