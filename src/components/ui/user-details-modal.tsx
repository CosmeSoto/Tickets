'use client'

/**
 * Modal de detalles del usuario — vista de solo lectura.
 * Muestra perfil, rol, módulos habilitados, departamento y acceso.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog'
import { Badge } from './badge'
import { Button } from './button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Separator } from './separator'
import {
  User,
  Mail,
  Phone,
  Building2,
  Clock,
  Shield,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  Calendar,
} from 'lucide-react'
import { RoleBadge } from '@/components/ui/role-badge'
import type { UserData } from '@/hooks/use-users'
import { getUserInitials } from '@/components/users/user-utils'
import { UserModulesPanel } from '@/components/users/user-modules-panel'

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

function ModuleChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
        enabled
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
          : 'border-border bg-muted/50 text-muted-foreground'
      }`}
    >
      {enabled ? <CheckCircle2 className='h-3 w-3' /> : <XCircle className='h-3 w-3' />}
      {label}
    </div>
  )
}

function formatDateTime(dateString: string): React.ReactNode {
  const date = new Date(dateString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString()

  const time = date.toLocaleTimeString('es-EC', {
    timeZone: 'America/Guayaquil',
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
        timeZone: 'America/Guayaquil',
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
      <DialogContent className='max-w-md max-h-[90vh] overflow-y-auto' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <User className='h-4 w-4' />
            Detalles del usuario
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          {/* ── Cabecera con avatar prominente ── */}
          <div className='flex items-center gap-4'>
            <Avatar className='h-16 w-16 border-2 border-border shadow-sm'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className='text-lg font-bold bg-primary/10 text-primary'>
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0 flex-1'>
              <p className='text-base font-bold truncate'>{user.name}</p>
              <p className='text-xs text-muted-foreground truncate'>{user.email}</p>
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
          <div className='grid grid-cols-1 gap-3'>
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

          {/* ── Módulos habilitados ── */}
          <div className='space-y-2.5'>
            <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
              Módulos habilitados
            </p>
            <div className='flex flex-wrap gap-2'>
              <ModuleChip enabled={user.ticketsEnabled !== false} label='🎫 Tickets' />
              <ModuleChip
                enabled={user.inventoryEnabled === true || user.canManageInventory === true}
                label='📦 Inventario'
              />
              <ModuleChip enabled={user.patrolsEnabled === true} label='🛡️ Rondas' />
              <ModuleChip enabled={(user as any).newsEnabled === true} label='📰 Noticias' />
              <ModuleChip enabled={(user as any).formsEnabled === true} label='📄 Documentos' />
              {user.canManageInventory && (
                <div className='flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400'>
                  <Shield className='h-3 w-3' />
                  Gestor de Inventario
                </div>
              )}
              {(user as any).canManageNews && (
                <div className='flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400'>
                  <Shield className='h-3 w-3' />
                  Gestor de Noticias
                </div>
              )}
              {(user as any).canManageForms && (
                <div className='flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-400'>
                  <Shield className='h-3 w-3' />
                  Gestor de Documentos
                </div>
              )}
            </div>
          </div>

          {/* ── Estado de acceso (familias por módulo) ── */}
          <UserModulesPanel
            userId={user.id}
            role={user.role}
            canManageInventory={user.canManageInventory ?? false}
            ticketsEnabled={user.ticketsEnabled}
            inventoryEnabled={user.inventoryEnabled}
            patrolsEnabled={user.patrolsEnabled}
            newsEnabled={(user as any).newsEnabled}
            canManageNews={(user as any).canManageNews}
            formsEnabled={(user as any).formsEnabled}
            canManageForms={(user as any).canManageForms}
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
