'use client'

/**
 * UserDetailsModal — Panel de información del usuario para gestión.
 *
 * Muestra datos relevantes para administrar el usuario:
 * perfil, rol, módulos habilitados, departamento y acceso.
 *
 * Las métricas de tickets pertenecen al módulo de tickets, no aquí.
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
  Package,
  Ticket,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { RoleBadge } from '@/components/ui/role-badge'
import { formatTimeAgo } from '@/hooks/use-users'
import type { UserData } from '@/hooks/use-users'

interface UserDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  /** Pasar el objeto completo evita una petición extra a la API */
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
        <p className='text-xs text-muted-foreground'>{label}</p>
        <div className='text-sm font-medium'>{value}</div>
      </div>
    </div>
  )
}

function ModuleChip({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border ${
        enabled
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400'
          : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      {enabled ? <CheckCircle2 className='h-3 w-3' /> : <XCircle className='h-3 w-3' />}
      {label}
    </div>
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-md' aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <User className='h-4 w-4' />
            Detalles del usuario
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-5'>
          {/* Cabecera con avatar */}
          <div className='flex items-center gap-4'>
            <Avatar className='h-14 w-14'>
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className='text-lg font-semibold'>
                {user.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className='min-w-0'>
              <p className='text-base font-semibold truncate'>{user.name}</p>
              <div className='flex items-center gap-2 mt-1 flex-wrap'>
                <RoleBadge
                  role={user.role}
                  isSuperAdmin={(user as any).isSuperAdmin}
                  iconSize='sm'
                />
                <Badge
                  variant='outline'
                  className={`text-xs ${
                    user.isActive
                      ? 'border-green-300 text-green-700 dark:border-green-700 dark:text-green-400'
                      : 'border-muted-foreground/30 text-muted-foreground'
                  }`}
                >
                  {user.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Datos de contacto */}
          <div className='space-y-3'>
            <InfoRow icon={Mail} label='Email' value={user.email} />
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
              value={user.lastLogin ? formatTimeAgo(user.lastLogin) : 'Nunca'}
            />
            <InfoRow
              icon={Clock}
              label='Registrado'
              value={new Date(user.createdAt).toLocaleDateString('es-EC', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            />
          </div>

          <Separator />

          {/* Módulos habilitados */}
          <div className='space-y-2'>
            <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
              Módulos
            </p>
            <div className='flex flex-wrap gap-2'>
              <ModuleChip enabled={user.ticketsEnabled !== false} label='🎫 Tickets' />
              <ModuleChip
                enabled={user.inventoryEnabled === true || user.canManageInventory === true}
                label='📦 Inventario'
              />
              <ModuleChip enabled={user.patrolsEnabled === true} label='🛡️ Rondas' />
              {user.canManageInventory && (
                <div className='flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400'>
                  <Shield className='h-3 w-3' />
                  Gestor de inventario
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
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
