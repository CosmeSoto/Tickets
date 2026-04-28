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
import { AuditDetailsResolver } from './audit-details-resolver'

interface AuditDetailsDialogProps {
  log: AuditLog | null
  isOpen: boolean
  onClose: () => void
}

export function AuditDetailsDialog({ log, isOpen, onClose }: AuditDetailsDialogProps) {
  if (!log) return null

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
          {/* Información básica */}
          <div className='bg-muted/30 p-4 rounded-lg space-y-3'>
            <div className='flex items-center gap-2'>
              <span className='font-semibold'>Acción:</span>
              <Badge className='bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'>
                {getActionLabel(log.action)}
              </Badge>
            </div>
            <div>
              <span className='font-semibold'>Módulo:</span>{' '}
              <span className='text-muted-foreground'>{getEntityLabel(log.entityType)}</span>
            </div>
            {log.entityId && (
              <div>
                <span className='font-semibold'>
                  {log.entityType === 'user'
                    ? 'Usuario Afectado:'
                    : log.entityType === 'ticket'
                      ? 'Ticket:'
                      : log.entityType === 'category'
                        ? 'Categoría:'
                        : log.entityType === 'department'
                          ? 'Departamento:'
                          : log.entityType === 'System'
                            ? 'Elemento:'
                            : 'Elemento Afectado:'}
                </span>{' '}
                {/* PRIORIDAD 1: Usar entityName si está disponible (ya resuelto) */}
                {log.details?.entityName ? (
                  <span className='text-muted-foreground font-medium text-blue-600 dark:text-blue-400'>
                    {log.details.entityName}
                  </span>
                ) : /* PRIORIDAD 2: Usar nombres específicos del details */
                log.entityType === 'user' && log.details?.userName ? (
                  <span className='text-muted-foreground'>
                    {log.details.userName}
                    {log.details.userEmail && (
                      <span className='text-xs ml-2'>({log.details.userEmail})</span>
                    )}
                  </span>
                ) : log.entityType === 'ticket' && log.details?.ticketTitle ? (
                  <span className='text-muted-foreground'>{log.details.ticketTitle}</span>
                ) : log.entityType === 'category' && log.details?.categoryName ? (
                  <span className='text-muted-foreground'>{log.details.categoryName}</span>
                ) : log.entityType === 'department' && log.details?.departmentName ? (
                  <span className='text-muted-foreground'>{log.details.departmentName}</span>
                ) : (
                  /* FALLBACK: Mostrar UUID solo si no hay nada más */
                  <code className='text-xs bg-muted px-2 py-1 rounded font-mono'>
                    {log.entityId}
                  </code>
                )}
              </div>
            )}
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
            {log.ipAddress && (
              <div>
                <span className='font-semibold'>IP:</span>{' '}
                <code className='text-xs bg-muted px-2 py-1 rounded font-mono'>
                  {log.ipAddress}
                </code>
              </div>
            )}
          </div>

          {/* Detalles formateados */}
          {log.details && (
            <div className='border-t pt-4'>
              <AuditDetailsResolver details={log.details} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
