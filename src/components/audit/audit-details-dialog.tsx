/**
 * Audit Details Dialog Component
 * Displays detailed information about an audit log entry
 */

import { Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AuditLog } from './utils/audit-types'
import { getActionLabel, getEntityLabel } from './utils/audit-formatters'
import {
  getAffectedObjectFieldLabel,
  getAffectedObjectLabel,
  getEventCode,
} from './utils/audit-affected-object'
import { AuditDetailsResolver } from './audit-details-resolver'

interface AuditDetailsDialogProps {
  log: AuditLog | null
  isOpen: boolean
  onClose: () => void
}

export function AuditDetailsDialog({ log, isOpen, onClose }: AuditDetailsDialogProps) {
  if (!log) return null

  const affectedLabel = getAffectedObjectLabel(log)
  const eventCode = getEventCode(log.id)
  const device = log.details?.context?.deviceType
  const browser = log.details?.context?.browser
  const browserVersion = log.details?.context?.browserVersion

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='max-w-3xl max-h-[80vh] overflow-y-auto'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Shield className='h-5 w-5 text-blue-600 dark:text-blue-400' />
            Detalles del Registro de Auditoría
          </DialogTitle>
          <DialogDescription>Información completa del evento registrado</DialogDescription>
        </DialogHeader>

        <div className='space-y-4 mt-4'>
          <div className='bg-muted/30 p-4 rounded-lg space-y-3'>
            <div className='flex items-center gap-2 flex-wrap'>
              <span className='font-semibold'>Acción:</span>
              <Badge className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                {getActionLabel(log.action)}
              </Badge>
            </div>
            <div>
              <span className='font-semibold'>Módulo:</span>{' '}
              <span className='text-muted-foreground'>{getEntityLabel(log.entityType)}</span>
            </div>
            <div>
              <span className='font-semibold'>{getAffectedObjectFieldLabel(log.entityType)}:</span>{' '}
              <span className='text-muted-foreground font-medium text-blue-600 dark:text-blue-400'>
                {affectedLabel}
              </span>
            </div>
            {eventCode ? (
              <div>
                <span className='font-semibold'>Código del evento:</span>{' '}
                <span className='text-muted-foreground'>{eventCode}</span>
              </div>
            ) : null}
            <div>
              <span className='font-semibold'>Fecha:</span>{' '}
              <span className='text-muted-foreground'>
                {new Date(log.createdAt).toLocaleString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
            {log.users && (
              <div>
                <span className='font-semibold'>Usuario:</span>{' '}
                <span className='text-muted-foreground'>
                  {log.users.name} ({log.users.email})
                </span>
              </div>
            )}
            {(device || browser) && (
              <div>
                <span className='font-semibold'>Dispositivo:</span>{' '}
                <span className='text-muted-foreground'>
                  {[
                    device === 'Desktop'
                      ? 'Escritorio'
                      : device === 'Mobile'
                        ? 'Móvil'
                        : device === 'Tablet'
                          ? 'Tablet'
                          : device,
                    browser ? `${browser}${browserVersion ? ` ${browserVersion}` : ''}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </div>
            )}
            {log.ipAddress && (
              <div>
                <span className='font-semibold'>IP:</span>{' '}
                <code className='text-xs bg-muted px-2 py-1 rounded font-mono'>
                  {log.ipAddress}
                </code>
              </div>
            )}
          </div>

          {log.details && (
            <div className='border-t pt-4'>
              <AuditDetailsResolver details={log.details} action={log.action} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
