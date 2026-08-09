'use client'

/**
 * Modal de detalles del usuario — vista de solo lectura.
 * Muestra perfil, rol, módulos habilitados (resolución real) y acceso.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Badge } from './badge'
import { Button } from './button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Separator } from './separator'
import {
  User,
  Phone,
  Building2,
  Clock,
  Edit,
  Trash2,
  Calendar,
} from 'lucide-react'
import { RoleBadge } from '@/components/ui/role-badge'
import type { UserData } from '@/hooks/use-users'
import { getUserInitials } from '@/components/users/user-utils'
import { UserModulesPanel } from '@/components/users/user-modules-panel'
import { getAppTimezone } from '@/lib/utils/date-utils'

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  user: UserData | null
  onEdit?: () => void
  onDelete?: () => void
  canEdit?: boolean
  canDelete?: boolean
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className='flex items-start gap-3'>
      <Icon className='h-4 w-4 text-muted-foreground mt-0.5 shrink-0' />
      <div className='min-w-0'>
        <p className='text-[11px] text-muted-foreground'>{label}</p>
        <div className='text-sm font-medium'>{value}</div>
      </div>
    </div>
  )
}

function formatDateTime(dateString: string): React.ReactNode {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

  const time = date.toLocaleTimeString('es-EC', {
    timeZone: getAppTimezone(),
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return <span>Hoy, {time}</span>
  }
  if (isYesterday) {
    return <span>Ayer, {time}</span>
  }

  return (
    <span>
      {date.toLocaleDateString('es-EC', {
        timeZone: getAppTimezone(),
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}{' '}
      <span className='text-muted-foreground'>{time}</span>
    </span>
  )
}

export function UserDetailsModal({
  isOpen,
  onClose,
  user,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: UserDetailsModalProps) {
  if (!user) return null

  const deptName = user.department
    ? typeof user.department === 'string'
      ? user.department
      : user.department.name
    : null

  const deptColor =
    user.department && typeof user.department !== 'string' ? user.department.color : undefined

  const isSuperAdmin = (user as any).isSuperAdmin === true

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className='w-[calc(100%-1.5rem)] max-w-2xl sm:max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 text-base sm:text-lg'>
            <User className='h-5 w-5' />
            Detalles del usuario
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-5'>
          {/* ── Cabecera con avatar prominente ── */}
          <div className='flex items-center gap-4'>
            <Avatar className='h-16 w-16 sm:h-20 sm:w-20 border-2 border-border shadow-sm'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className='text-lg font-bold bg-primary/10 text-primary'>
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='text-base sm:text-lg font-bold truncate'>{user.name}</p>
              <p className='text-xs sm:text-sm text-muted-foreground truncate'>{user.email}</p>
              <div className='flex items-center gap-2 mt-1.5 flex-wrap'>
                <RoleBadge role={user.role} isSuperAdmin={isSuperAdmin} iconSize='sm' />
                <Badge
                  variant='outline'
                  className={`text-[10px] px-1.5 py-0 ${
                    user.isActive
                      ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                      : 'border-red-300 text-red-700 dark:border-red-700 dark:text-red-400'
                  }`}
                >
                  {user.isActive ? '● Activo' : '● Inactivo'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Información de contacto ── */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
            {user.phone && <InfoRow icon={Phone} label='Teléfono' value={user.phone} />}
            {deptName && (
              <InfoRow
                icon={Building2}
                label='Departamento'
                value={
                  <div className='flex items-center gap-1.5'>
                    {deptColor && (
                      <span
                        className='inline-block h-2.5 w-2.5 rounded-full'
                        style={{ backgroundColor: deptColor }}
                      />
                    )}
                    {deptName}
                  </div>
                }
              />
            )}
            <InfoRow
              icon={Clock}
              label='Último acceso'
              value={
                user.lastLogin ? (
                  formatDateTime(user.lastLogin)
                ) : (
                  <span className='text-muted-foreground italic'>Nunca</span>
                )
              }
            />
            <InfoRow icon={Calendar} label='Registrado' value={formatDateTime(user.createdAt)} />
          </div>

          <Separator />

          {/* ── Módulos + perfil (misma resolución del API) ── */}
          <UserModulesPanel
            userId={user.id}
            role={user.role}
            canManageInventory={user.canManageInventory ?? false}
            canRequestAssets={(user as any).canRequestAssets ?? false}
            ticketsEnabled={user.ticketsEnabled}
            inventoryEnabled={user.inventoryEnabled}
            patrolsEnabled={user.patrolsEnabled}
            credentialsEnabled={(user as any).credentialsEnabled}
            canManageCredentials={(user as any).canManageCredentials}
            newsEnabled={(user as any).newsEnabled}
            canManageNews={(user as any).canManageNews}
            formsEnabled={(user as any).formsEnabled}
            canManageForms={(user as any).canManageForms}
            showModuleChips
            defaultCollapsed
            hideGuides
          />

          {/* ── Acciones ── */}
          {(canEdit || canDelete) && (
            <>
              <Separator />
              <div className='flex justify-end gap-2'>
                {canDelete && onDelete && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={onDelete}
                    className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                  >
                    <Trash2 className='h-4 w-4 mr-1.5' />
                    Eliminar
                  </Button>
                )}
                {canEdit && onEdit && (
                  <Button size='sm' onClick={onEdit}>
                    <Edit className='h-4 w-4 mr-1.5' />
                    Editar
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
