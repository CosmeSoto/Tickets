/**
 * Audit Table Columns Component
 * Defines column structure for audit logs table
 */

import { Eye, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AuditLog } from './utils/audit-types'
import {
  translateAction,
  translateEntityType,
  getActionColor,
  getActionLabel,
  getRoleColor,
  getRoleLabel,
  formatRelativeTime,
} from './utils/audit-formatters'
import {
  getConfigModuleName,
  getConfigAuditSummary,
  isConfigAuditAction,
} from '@/lib/services/config-audit-labels'

export function getAuditColumns(onViewDetails: (log: AuditLog) => void) {
  return [
    {
      key: 'createdAt',
      label: 'Fecha y Hora',
      sortable: true,
      render: (log: AuditLog) => {
        const date = new Date(log.createdAt)
        const timeAgo = formatRelativeTime(log.createdAt)

        return (
          <div className='text-sm'>
            <div className='font-medium'>
              {date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
            <div className='text-muted-foreground text-xs'>
              {date.toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className='text-muted-foreground text-xs italic'>{timeAgo}</div>
          </div>
        )
      },
    },
    {
      key: 'action',
      label: 'Acción',
      sortable: true,
      render: (log: AuditLog) => {
        const action = log.action
        const entityType = log.entityType

        // Intentar etiqueta exacta primero; si no existe, usar traducción parcial
        const rawLabel = getActionLabel(action)
        const translatedAction = rawLabel !== action ? rawLabel : translateAction(action)

        return (
          <div className='space-y-1'>
            <Badge className={getActionColor(action)}>{translatedAction}</Badge>
            <div className='text-xs text-muted-foreground'>{translateEntityType(entityType)}</div>
          </div>
        )
      },
    },
    {
      key: 'users',
      label: 'Usuario',
      render: (log: AuditLog) => {
        const user = log.users
        if (!user)
          return (
            <div className='flex items-center gap-2'>
              <div className='w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center'>
                <Shield className='h-4 w-4 text-gray-500' />
              </div>
              <div>
                <div className='text-sm font-medium'>Sistema</div>
                <div className='text-xs text-muted-foreground'>Acción automática</div>
              </div>
            </div>
          )

        return (
          <div className='flex items-center gap-2'>
            <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-primary'>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className='text-sm font-medium'>{user.name}</div>
              <div className='text-xs text-muted-foreground'>{user.email}</div>
              <Badge variant='outline' className={`text-xs mt-0.5 ${getRoleColor(user.role)}`}>
                {getRoleLabel(user.role)}
              </Badge>
            </div>
          </div>
        )
      },
    },
    {
      key: 'entityId',
      label: 'Qué Pasó',
      render: (log: AuditLog) => {
        const details = log.details
        const action = log.action
        const entityType = log.entityType

        // Construir descripción natural y legible
        let mainDescription = ''
        let subDescription = ''
        let icon = '📝'

        if (entityType === 'comment') {
          icon = '💬'
          mainDescription = 'Agregó un comentario'

          // Extraer el contenido del comentario
          if (details?.content) {
            const preview = String(details.content).slice(0, 80)
            subDescription = `"${preview}${details.content.length > 80 ? '...' : ''}"`
          } else if (details?.comment) {
            const preview = String(details.comment).slice(0, 80)
            subDescription = `"${preview}${details.comment.length > 80 ? '...' : ''}"`
          } else if (details?.message) {
            const preview = String(details.message).slice(0, 80)
            subDescription = `"${preview}${details.message.length > 80 ? '...' : ''}"`
          }

          // Indicar si es interno o público
          if (details?.metadata?.isInternal === true) {
            mainDescription += ' (nota interna)'
          } else if (details?.metadata?.isInternal === false) {
            mainDescription += ' (visible para cliente)'
          }
        } else if (entityType === 'ticket') {
          icon = '🎫'
          if (action.includes('created')) {
            mainDescription = 'Creó un ticket'
            if (details?.title) {
              subDescription = details.title
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó un ticket'
            if (details?.oldValues && details?.newValues) {
              const changes = Object.keys(details.newValues).filter(
                key => details.oldValues[key] !== details.newValues[key]
              )
              if (changes.length > 0) {
                subDescription = `Modificó: ${changes.slice(0, 2).join(', ')}${changes.length > 2 ? '...' : ''}`
              }
            }
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó un ticket'
            icon = '🗑️'
          } else if (action.includes('assigned')) {
            mainDescription = 'Asignó el ticket'
            icon = '👤'
          } else if (action.includes('resolved')) {
            mainDescription = 'Resolvió el ticket'
            icon = '✅'
          } else if (action.includes('closed')) {
            mainDescription = 'Cerró el ticket'
            icon = '🔒'
          }
        } else if (entityType === 'user') {
          icon = '👤'
          if (action.includes('created')) {
            mainDescription = 'Creó un usuario'
            if (details?.name) {
              subDescription = details.name
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó un usuario'
          } else if (action.includes('role_changed')) {
            mainDescription = 'Cambió el rol de un usuario'
            icon = '🔑'
          }
        } else if (entityType === 'category') {
          icon = '📂'
          mainDescription = action.includes('created')
            ? 'Creó una categoría'
            : action.includes('updated')
              ? 'Actualizó una categoría'
              : 'Modificó una categoría'
        } else if (entityType === 'department') {
          icon = '🏢'
          mainDescription = action.includes('created')
            ? 'Creó un departamento'
            : action.includes('updated')
              ? 'Actualizó un departamento'
              : 'Modificó un departamento'
        } else if (entityType.toLowerCase() === 'patrol_checkpoint') {
          icon = '📍'
          if (action.includes('created')) {
            mainDescription = 'Creó un checkpoint'
            if (details?.entityName) {
              subDescription = details.entityName
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó un checkpoint'
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó un checkpoint'
            icon = '🗑️'
          } else if (action.includes('deactivated')) {
            mainDescription = 'Desactivó un checkpoint'
            icon = '🔴'
          } else if (action.includes('reactivated')) {
            mainDescription = 'Reactivó un checkpoint'
            icon = '🟢'
          }
        } else if (entityType.toLowerCase() === 'patrol_route') {
          icon = '🛤️'
          if (action.includes('created')) {
            mainDescription = 'Creó una ruta'
            if (details?.entityName) {
              subDescription = details.entityName
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó una ruta'
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó una ruta'
            icon = '🗑️'
          } else if (action.includes('deactivated')) {
            mainDescription = 'Desactivó una ruta'
            icon = '🔴'
          } else if (action.includes('reactivated')) {
            mainDescription = 'Reactivó una ruta'
            icon = '🟢'
          }
        } else if (entityType.toLowerCase() === 'patrol_schedule') {
          icon = '📅'
          if (action.includes('created')) {
            mainDescription = 'Creó una programación'
            if (details?.entityName) {
              subDescription = details.entityName
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó una programación'
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó una programación'
            icon = '🗑️'
          } else if (action.includes('deactivated')) {
            mainDescription = 'Desactivó una programación'
            icon = '🔴'
          } else if (action.includes('reactivated')) {
            mainDescription = 'Reactivó una programación'
            icon = '🟢'
          }
        } else if (entityType.toLowerCase() === 'patrol_incident') {
          icon = '⚠️'
          if (action.includes('created')) {
            mainDescription = 'Reportó una novedad'
            if (details?.description) {
              subDescription = details.description
            }
          } else if (action.includes('updated')) {
            mainDescription = 'Actualizó una novedad'
          } else if (action.includes('deleted')) {
            mainDescription = 'Eliminó una novedad'
            icon = '🗑️'
          } else if (action.includes('resolved')) {
            mainDescription = 'Resolvió una novedad'
            icon = '✅'
          } else if (action.includes('escalated')) {
            mainDescription = 'Escaló una novedad'
            icon = '🚨'
          }
        } else if (entityType.toLowerCase() === 'patrol') {
          icon = '🚶'
          if (action.includes('created')) {
            mainDescription = 'Creó una patrulla'
          } else if (action.includes('started')) {
            mainDescription = 'Inició una patrulla'
          } else if (action.includes('completed')) {
            mainDescription = 'Completó una patrulla'
            icon = '✅'
          } else if (action.includes('missed')) {
            mainDescription = 'Omitió una patrulla'
            icon = '⚠️'
          }
        } else if (isConfigAuditAction(action)) {
          icon = '⚙️'
          mainDescription = `Actualizó configuración de ${getConfigModuleName(action).toLowerCase()}`
          if (details?.familyName) {
            subDescription = String(details.familyName)
          } else if (details?.policyName) {
            subDescription = String(details.policyName)
          }
          const summary = getConfigAuditSummary(details)
          if (summary) {
            subDescription = subDescription ? `${subDescription} · ${summary}` : summary
          }
        } else if (action === 'TYPE_CLONED') {
          const entityTypeLabels: Record<string, string> = {
            license_type: 'una licencia',
            equipment_type: 'un tipo de equipo',
            consumable_type: 'un tipo de suministro',
          }
          icon = '📋'
          const typeLabel = entityTypeLabels[entityType] ?? 'un tipo de activo'
          mainDescription = `Copió ${typeLabel}`
          if (details?.sourceTypeName) {
            subDescription = `Origen: ${details.sourceTypeName}`
            if (typeof details.attributesCopied === 'number') {
              subDescription += ` · ${details.attributesCopied} atributo${details.attributesCopied !== 1 ? 's' : ''} copiado${details.attributesCopied !== 1 ? 's' : ''}`
            }
          }
        } else if (action.startsWith('backup_')) {
          icon = '💾'
          if (action === 'backup_created') {
            mainDescription =
              details?.engine === 'export' ? 'Creó export .dump' : 'Creó respaldo pgBackRest'
            subDescription = details?.filename || details?.label || ''
          } else if (action === 'backup_restored') {
            mainDescription = 'Restauró un respaldo'
            subDescription = details?.filename || details?.label || ''
          } else if (action === 'backup_restore_started') {
            mainDescription = 'Inició restauración'
            subDescription = details?.filename || details?.label || ''
          } else if (action === 'backup_restore_failed') {
            mainDescription = 'Falló una restauración'
            subDescription = details?.message || details?.error || ''
          } else if (action === 'backup_imported') {
            mainDescription = 'Importó un backup'
            subDescription = details?.filename || ''
          } else if (action === 'backup_deleted') {
            mainDescription = 'Eliminó un backup'
            subDescription = details?.filename || ''
          }
        } else if (action.includes('login')) {
          icon = '🔐'
          mainDescription = 'Inició sesión'
        } else if (action.includes('logout')) {
          icon = '🚪'
          mainDescription = 'Cerró sesión'
        } else if (action.startsWith('access_pass_')) {
          icon = '🪪'
          const code = details?.credentialCode ? ` ${details.credentialCode}` : ''
          if (action === 'access_pass_deleted') {
            mainDescription = `Eliminó el pase de acceso${code}`
          } else if (action === 'access_pass_created') {
            mainDescription = `Emitió el pase de acceso${code}`
          } else if (action === 'access_pass_revoked') {
            mainDescription = `Revocó el pase de acceso${code}`
          } else if (action === 'access_pass_scanned') {
            const scanResult = details?.result
            if (scanResult === 'PENDING_PRIVACY') {
              mainDescription = `Verificó pase pendiente de privacidad${code}`
            } else {
              mainDescription = `Verificó el pase de acceso${code}`
            }
          } else if (action === 'access_pass_qr_reissued') {
            mainDescription = `Reemitió el QR del pase${code}`
          } else {
            mainDescription = `Actualizó el pase de acceso${code}`
          }
        } else {
          // Fallback genérico
          const actionTranslated = translateAction(action)
          const entityTranslated = translateEntityType(entityType)
          mainDescription = `${actionTranslated} ${entityTranslated.toLowerCase()}`
        }

        return (
          <div className='text-sm space-y-1 max-w-md'>
            <div className='flex items-start gap-2'>
              <span className='text-lg'>{icon}</span>
              <div className='flex-1 min-w-0'>
                <div className='font-medium text-foreground'>{mainDescription}</div>
                {subDescription && (
                  <div className='text-xs text-muted-foreground italic mt-1 line-clamp-2'>
                    {subDescription}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      key: 'ipAddress',
      label: 'Contexto Técnico',
      render: (log: AuditLog) => {
        const ip = log.ipAddress
        const userAgent = log.userAgent
        const context = log.details?.context

        // Detectar navegador y SO del userAgent (fallback si no hay context)
        let browser = context?.browser || 'Desconocido'
        let os = context?.os || 'Desconocido'
        const deviceType = context?.deviceType
        const source = context?.source

        if (!context && userAgent) {
          if (userAgent.includes('Chrome')) browser = '🌐 Chrome'
          else if (userAgent.includes('Firefox')) browser = '🦊 Firefox'
          else if (userAgent.includes('Safari')) browser = '🧭 Safari'
          else if (userAgent.includes('Edge')) browser = '🌊 Edge'

          if (userAgent.includes('Windows')) os = '🪟 Windows'
          else if (userAgent.includes('Mac')) os = '🍎 macOS'
          else if (userAgent.includes('Linux')) os = '🐧 Linux'
          else if (userAgent.includes('Android')) os = '🤖 Android'
          else if (userAgent.includes('iOS')) os = '📱 iOS'
        }

        return (
          <div className='text-sm space-y-1'>
            {/* Origen */}
            {source && (
              <div className='flex items-center gap-1'>
                <span className='text-xs font-semibold text-blue-600 dark:text-blue-400'>
                  {source === 'WEB' && '🌐 Web'}
                  {source === 'API' && '⚡ API'}
                  {source === 'MOBILE' && '📱 Móvil'}
                  {source === 'SYSTEM' && '⚙️ Sistema'}
                </span>
              </div>
            )}

            {/* IP */}
            {ip ? (
              <div className='flex items-center gap-1'>
                <span className='text-muted-foreground text-xs'>IP:</span>
                <code className='text-xs bg-muted px-1 py-0.5 rounded font-mono'>{ip}</code>
              </div>
            ) : (
              <span className='text-muted-foreground text-xs'>Sin IP</span>
            )}

            {/* Dispositivo */}
            {deviceType && (
              <div className='text-xs text-muted-foreground'>
                {deviceType === 'Desktop' && '🖥️ Escritorio'}
                {deviceType === 'Mobile' && '📱 Móvil'}
                {deviceType === 'Tablet' && '📱 Tablet'}
              </div>
            )}

            {/* Navegador y SO */}
            {userAgent && (
              <>
                <div className='text-xs text-muted-foreground'>{browser}</div>
                <div className='text-xs text-muted-foreground'>{os}</div>
              </>
            )}

            {/* Duración (si existe) */}
            {context?.duration && (
              <div className='text-xs text-purple-600 dark:text-purple-400'>
                ⏱️ {context.duration}ms
              </div>
            )}

            {/* Resultado (si es error) */}
            {context?.result === 'ERROR' && (
              <div className='text-xs text-red-600 dark:text-red-400 font-semibold'>❌ Error</div>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      label: 'Acciones',
      render: (log: AuditLog) => {
        return (
          <Button variant='ghost' size='sm' onClick={() => onViewDetails(log)}>
            <Eye className='h-4 w-4 mr-1' />
            Ver
          </Button>
        )
      },
    },
  ]
}
