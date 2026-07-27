'use client'
import { DEFAULT_TIMEZONE } from '@/lib/constants'

import { MapPin, Clock, Image as ImageIcon, Ticket, WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CHECK_IN_METHOD_LABELS_ES,
  CHECK_IN_VALIDATION_LABELS_ES,
  getValidationResultColor,
} from '@/lib/utils/patrol-utils'

interface CheckInPhoto {
  id: string
  path: string
  deletedAt: string | null
}

interface CheckIn {
  id: string
  checkpointId: string
  checkpoint?: { name: string; location: string }
  validationResult: string
  method: string
  deviceTimestamp: string
  serverTimestamp: string
  gpsLat?: number | null
  gpsLng?: number | null
  distanceFromCheckpointMeters?: number | null
  isOffline: boolean
  photos?: CheckInPhoto[]
  _count?: { tickets: number }
}

interface PatrolCheckInCardProps {
  checkIn: CheckIn
  className?: string
}

export function PatrolCheckInCard({ checkIn, className }: PatrolCheckInCardProps) {
  const isValid = checkIn.validationResult === 'VALID'
  const ticketCount = checkIn._count?.tickets ?? 0
  const photo = checkIn.photos?.[0]

  return (
    <div
      className={cn(
        'flex gap-3 p-3 rounded-lg border',
        isValid
          ? 'bg-green-50/50 border-green-200 dark:bg-green-950/10 dark:border-green-900'
          : 'bg-red-50/50 border-red-200 dark:bg-red-950/10 dark:border-red-900',
        className
      )}
    >
      {/* Miniatura de foto */}
      <div className='flex-shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted border border-border'>
        {photo ? (
          photo.deletedAt ? (
            <div className='w-full h-full flex flex-col items-center justify-center text-muted-foreground/50 gap-0.5'>
              <ImageIcon className='h-4 w-4' />
              <span className='text-[9px] text-center leading-tight'>Eliminada</span>
            </div>
          ) : (
            <img
              src={`/uploads/${photo.path}`}
              alt='Foto del check-in'
              className='w-full h-full object-cover'
            />
          )
        ) : (
          <div className='w-full h-full flex items-center justify-center text-muted-foreground/30'>
            <ImageIcon className='h-5 w-5' />
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className='flex-1 min-w-0 space-y-1'>
        <div className='flex items-center gap-2 flex-wrap'>
          {checkIn.checkpoint && (
            <span className='text-sm font-medium truncate'>{checkIn.checkpoint.name}</span>
          )}
          <Badge
            className={cn(
              'text-xs border-0 py-0 h-4',
              getValidationResultColor(checkIn.validationResult)
            )}
          >
            {CHECK_IN_VALIDATION_LABELS_ES[checkIn.validationResult] ?? checkIn.validationResult}
          </Badge>
          {checkIn.isOffline && (
            <Badge variant='outline' className='text-xs py-0 h-4 flex items-center gap-1'>
              <WifiOff className='h-2.5 w-2.5' />
              Offline
            </Badge>
          )}
          {ticketCount > 0 && (
            <Badge variant='secondary' className='text-xs py-0 h-4 flex items-center gap-1'>
              <Ticket className='h-2.5 w-2.5' />
              {ticketCount} incidente{ticketCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        <div className='flex items-center gap-3 text-xs text-muted-foreground flex-wrap'>
          <span className='flex items-center gap-1'>
            <Clock className='h-3 w-3' />
            {new Date(checkIn.deviceTimestamp).toLocaleString('es-EC', {
              timeZone: DEFAULT_TIMEZONE,
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
          {checkIn.gpsLat != null && checkIn.gpsLng != null && (
            <span className='flex items-center gap-1'>
              <MapPin className='h-3 w-3' />
              {checkIn.distanceFromCheckpointMeters != null
                ? `${Math.round(checkIn.distanceFromCheckpointMeters)} m`
                : `${checkIn.gpsLat.toFixed(5)}, ${checkIn.gpsLng.toFixed(5)}`}
            </span>
          )}
          <span className='text-muted-foreground/60'>
            {CHECK_IN_METHOD_LABELS_ES[checkIn.method] ?? checkIn.method}
          </span>
        </div>
      </div>
    </div>
  )
}
