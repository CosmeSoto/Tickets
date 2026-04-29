'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/components/ui/role-badge'
import { Separator } from '@/components/ui/separator'
import {
  User,
  Building,
  Camera,
  Save,
  AlertCircle,
  AlertTriangle,
  Activity,
  RotateCcw,
  X,
  Lock,
  Unlock,
  Calendar,
  Ticket,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UserData } from '@/hooks/use-users'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { DepartmentSelector } from '@/components/ui/department-selector'
import { Switch } from '@/components/ui/switch'
import { extractApiError, extractCatchError } from '@/lib/utils/api-error'
import {
  useSystemModules,
  getModuleRoleDescription,
  getModuleEmoji,
} from '@/hooks/use-system-modules'

interface EditUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserUpdated: () => void
  user: UserData | null
  departments: Array<{ id: string; name: string; color: string }>
}

interface EditUserData {
  name: string
  email: string
  role: UserRole
  departmentId: string
  phone: string
  isActive: boolean
  canManageInventory: boolean
  ticketsEnabled: boolean
  inventoryEnabled: boolean
  isSuperAdmin: boolean
  avatar?: File
}

// ── Panel de módulos del usuario ─────────────────────────────────────────

function ModuleStatusCard({
  emoji,
  name,
  active,
  families,
  guide,
  badge,
}: {
  emoji: string
  name: string
  active: boolean
  families?: Array<{ id: string; name: string; color?: string | null }>
  guide?: { steps: string[]; type: 'warning' | 'info' } | null
  badge?: string
}) {
  return (
    <div
      className={`rounded-lg border p-2.5 space-y-1.5 ${
        active
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-muted/30 border-border'
      }`}
    >
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          <span className='text-sm'>{emoji}</span>
          <span className='text-xs font-semibold text-foreground'>{name}</span>
          {badge && (
            <span className='text-[9px] px-1.5 py-0.5 rounded-full bg-muted border text-muted-foreground font-medium'>
              {badge}
            </span>
          )}
        </div>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
            active
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {active ? '● Activo' : '○ Inactivo'}
        </span>
      </div>

      {/* Familias activas — chips compactos */}
      {active && families && families.length > 0 && (
        <div className='flex flex-wrap gap-1'>
          {families.map(f => (
            <span
              key={f.id}
              className='inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background border font-medium'
            >
              {f.color && (
                <span
                  className='w-1.5 h-1.5 rounded-full flex-shrink-0'
                  style={{ backgroundColor: f.color }}
                />
              )}
              {f.name}
            </span>
          ))}
        </div>
      )}

      {/* Guía numerada — solo cuando inactivo */}
      {!active && guide && (
        <div
          className={`rounded-md px-2 py-1.5 space-y-1 ${
            guide.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800'
          }`}
        >
          <p
            className={`text-[9px] font-bold uppercase tracking-wider ${
              guide.type === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-blue-600 dark:text-blue-400'
            }`}
          >
            Cómo activar
          </p>
          <ol className='space-y-0.5'>
            {guide.steps.map((step, i) => (
              <li key={i} className='flex items-start gap-1'>
                <span
                  className={`text-[10px] font-bold flex-shrink-0 ${
                    guide.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                  }`}
                >
                  {i + 1}.
                </span>
                <span className='text-[11px] text-foreground leading-tight'>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

function UserModulesPanel({
  userId,
  role,
  canManageInventory,
  ticketsEnabled,
  inventoryEnabled,
}: {
  userId: string
  role: string
  canManageInventory: boolean
  ticketsEnabled?: boolean
  inventoryEnabled?: boolean
}) {
  const [data, setData] = useState<{
    tickets: boolean
    inventory: boolean
    families: Array<{
      id: string
      name: string
      code: string
      color?: string | null
      modules: { tickets: boolean; inventory: boolean }
    }>
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/user/modules?userId=${userId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        setData(d)
        // Auto-expandir si hay módulos inactivos (hay algo que mostrar)
        if (d && (!d.tickets || !d.inventory)) setExpanded(true)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, canManageInventory, ticketsEnabled, inventoryEnabled])

  const isAdminRole = role === 'ADMIN'
  const hasFamilies = data && data.families.length > 0
  const ticketsActive = data?.tickets ?? false
  const inventoryActive = data?.inventory ?? false
  const allActive =
    ticketsActive && (role === 'CLIENT' ? inventoryActive || true : inventoryActive || !isAdminRole)

  const getTicketsGuide = () => {
    if (ticketsActive) return null
    if (isAdminRole)
      return {
        type: 'info' as const,
        steps: ['Admin → Familias → [Familia]', 'Personal → Administradores → Agregar'],
      }
    if (role === 'TECHNICIAN')
      return hasFamilies
        ? {
            type: 'warning' as const,
            steps: ['Admin → Configuración → Tickets', 'Seleccionar familia → Activar módulo'],
          }
        : {
            type: 'warning' as const,
            steps: ['Admin → Familias → [Familia]', 'Personal → Técnicos de Tickets → Agregar'],
          }
    return { type: 'info' as const, steps: ['Activar el toggle "Tickets" en la sección anterior'] }
  }

  const getInventoryGuide = () => {
    if (inventoryActive) return null
    if (isAdminRole)
      return {
        type: 'info' as const,
        steps: ['Admin → Familias → [Familia]', 'Personal → Administradores → Agregar'],
      }
    if (role === 'TECHNICIAN') {
      if (!canManageInventory)
        return {
          type: 'warning' as const,
          steps: [
            'Activar "Inventario" en la sección anterior',
            'Admin → Familias → [Familia]',
            'Personal → Gestores de Inventario → Agregar',
          ],
        }
      return hasFamilies
        ? {
            type: 'warning' as const,
            steps: ['Admin → Configuración → Inventario', 'Seleccionar familia → Activar módulo'],
          }
        : {
            type: 'warning' as const,
            steps: ['Admin → Familias → [Familia]', 'Personal → Gestores de Inventario → Agregar'],
          }
    }
    return {
      type: 'info' as const,
      steps: ['Activar el toggle "Inventario" en la sección anterior'],
    }
  }

  if (loading) {
    return (
      <div className='flex items-center gap-2 py-1'>
        <div className='w-2 h-2 rounded-full bg-muted-foreground/30 animate-pulse' />
        <p className='text-[11px] text-muted-foreground'>Verificando acceso...</p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border overflow-hidden'>
      {/* Header colapsable */}
      <button
        type='button'
        onClick={() => setExpanded(v => !v)}
        className='w-full flex items-center justify-between px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors'
      >
        <div className='flex items-center gap-2'>
          <Activity className='h-3.5 w-3.5 text-muted-foreground' />
          <span className='text-xs font-semibold text-foreground'>Estado de acceso</span>
          {/* Resumen compacto de módulos */}
          <div className='flex items-center gap-1'>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                ticketsActive
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              🎫 {ticketsActive ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                inventoryActive
                  ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              📦 {inventoryActive ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
        <svg
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
        >
          <path d='M6 9l6 6 6-6' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
      </button>

      {/* Contenido expandible */}
      {expanded && (
        <div className='p-2.5 space-y-2 border-t'>
          <ModuleStatusCard
            emoji='🎫'
            name='Tickets'
            active={ticketsActive}
            families={data?.families.filter(f => f.modules.tickets)}
            guide={getTicketsGuide()}
          />
          <ModuleStatusCard
            emoji='📦'
            name='Inventario'
            active={inventoryActive}
            families={data?.families.filter(f => f.modules.inventory)}
            guide={getInventoryGuide()}
            badge={role === 'TECHNICIAN' && !canManageInventory ? 'Requiere Gestor' : undefined}
          />
        </div>
      )}
    </div>
  )
}

// ── Modal principal ────────────────────────────────────────────────────────

export function EditUserModal({
  isOpen,
  onClose,
  onUserUpdated,
  user,
  departments,
}: EditUserModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [formData, setFormData] = useState<EditUserData>({
    name: '',
    email: '',
    role: 'CLIENT',
    departmentId: '',
    phone: '',
    isActive: true,
    canManageInventory: false,
    ticketsEnabled: true,
    inventoryEnabled: false,
    isSuperAdmin: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const showApiError = (title: string, result: any, fallback?: string) => {
    toast({ title, description: extractApiError(result, fallback), variant: 'destructive' })
  }
  const showNetworkError = (err: unknown) => {
    toast({
      title: 'Error de conexión',
      description: extractCatchError(err),
      variant: 'destructive',
    })
  }

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId:
          typeof user.department === 'object' ? user.department?.id || '' : user.department || '',
        phone: user.phone || '',
        isActive: user.isActive,
        canManageInventory: (user as any).canManageInventory ?? false,
        ticketsEnabled: (user as any).ticketsEnabled ?? true,
        inventoryEnabled: (user as any).inventoryEnabled ?? false,
        isSuperAdmin: user.isSuperAdmin ?? false,
        avatar: undefined,
      })
      setAvatarPreview(user.avatar || null)
      setErrors({})
      setIsLocked(false)
      setShowResetPassword(false)
      setNewPassword('')
      fetch(`/api/users/${user.id}/reset-password`, { method: 'GET' })
        .then(r => r.json())
        .then(data => setIsLocked(data.isLocked || false))
        .catch(() => {})
    }
  }, [user, isOpen])

  const handleClose = () => {
    setErrors({})
    setAvatarPreview(null)
    setShowResetPassword(false)
    setNewPassword('')
    onClose()
  }

  const handleResetPassword = async () => {
    if (!user || !newPassword || newPassword.length < 6) return
    setResetPasswordLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        toast({ title: 'Contraseña actualizada', description: result.message })
        setShowResetPassword(false)
        setNewPassword('')
      } else {
        showApiError('Error al resetear contraseña', result)
      }
    } catch (err) {
      showNetworkError(err)
    } finally {
      setResetPasswordLoading(false)
    }
  }

  const handleUnlockAccess = async () => {
    if (!user) return
    setUnlockLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success) {
        toast({ title: 'Acceso desbloqueado', description: result.message })
        setIsLocked(false)
      } else {
        showApiError('Error al desbloquear', result)
      }
    } catch (err) {
      showNetworkError(err)
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Selecciona una imagen válida',
        variant: 'destructive',
      })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'La imagen debe ser menor a 5MB',
        variant: 'destructive',
      })
      return
    }
    setFormData(p => ({ ...p, avatar: file }))
    const reader = new FileReader()
    reader.onload = e => setAvatarPreview(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleDeleteAvatar = async () => {
    if (!user) return
    try {
      const res = await fetch(`/api/users/${user.id}/avatar`, { method: 'DELETE' })
      const result = await res.json()
      if (res.ok && result.success) {
        setAvatarPreview(null)
        setFormData(p => ({ ...p, avatar: undefined }))
        toast({ title: 'Avatar eliminado' })
        onUserUpdated()
      } else {
        showApiError('Error al eliminar avatar', result)
      }
    } catch (err) {
      showNetworkError(err)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    else if (formData.name.trim().length < 2) newErrors.name = 'Mínimo 2 caracteres'
    if (!formData.email.trim()) newErrors.email = 'El email es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email inválido'
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone))
      newErrors.phone = 'Formato inválido'
    if (formData.role !== 'ADMIN' && !formData.departmentId)
      newErrors.departmentId = 'Requerido para este rol'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!user || !validateForm()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          role: formData.role,
          departmentId: formData.departmentId || null,
          phone: formData.phone.trim() || null,
          isActive: formData.isActive,
          canManageInventory: formData.canManageInventory,
          ticketsEnabled: formData.ticketsEnabled,
          inventoryEnabled: formData.inventoryEnabled,
          isSuperAdmin: formData.role === 'ADMIN' ? formData.isSuperAdmin : false,
        }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        if (formData.avatar) {
          const fd = new FormData()
          fd.append('avatar', formData.avatar)
          await fetch(`/api/users/${user.id}/avatar`, { method: 'POST', body: fd })
        }
        toast({
          title: 'Usuario actualizado',
          description: `${formData.name} actualizado correctamente`,
        })
        window.dispatchEvent(new CustomEvent('modules-updated'))
        handleClose()
        onUserUpdated()
      } else {
        if (res.status === 409 && extractApiError(result).toLowerCase().includes('email')) {
          setErrors(prev => ({ ...prev, email: 'Este email ya está registrado' }))
        }
        showApiError('Error al actualizar usuario', result)
      }
    } catch (err) {
      showNetworkError(err)
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = user?.id === session?.user?.id
  const { modules: systemModules } = useSystemModules()
  const formatDate = (dateString?: string) =>
    dateString
      ? new Date(dateString).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '—'

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className='max-w-2xl max-h-[90vh] overflow-y-auto'
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <User className='h-5 w-5 text-primary' />
            Editar Usuario
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-6'>
          {/* Cabecera: Avatar + info */}
          <div className='flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border'>
            <div className='relative group shrink-0'>
              <Avatar className='h-16 w-16 border-2 border-background shadow'>
                <AvatarImage src={avatarPreview || user.avatar || undefined} alt={user.name} />
                <AvatarFallback className='text-base font-semibold bg-primary/10 text-primary'>
                  {user.name
                    .split(' ')
                    .slice(0, 2)
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1'>
                <button
                  type='button'
                  title='Cambiar foto'
                  onClick={() => document.getElementById('edit-avatar-input')?.click()}
                  className='p-1 rounded-full bg-white/20 hover:bg-white/40 text-white'
                >
                  <Camera className='h-3.5 w-3.5' />
                </button>
                {(avatarPreview || user.avatar) && (
                  <button
                    type='button'
                    title='Eliminar foto'
                    onClick={handleDeleteAvatar}
                    className='p-1 rounded-full bg-white/20 hover:bg-red-500/60 text-white'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                )}
                {formData.avatar && (
                  <button
                    type='button'
                    title='Deshacer'
                    onClick={() => {
                      setFormData(p => ({ ...p, avatar: undefined }))
                      setAvatarPreview(user.avatar || null)
                    }}
                    className='p-1 rounded-full bg-white/20 hover:bg-amber-500/60 text-white'
                  >
                    <RotateCcw className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>
              <input
                id='edit-avatar-input'
                type='file'
                accept='image/*'
                onChange={handleAvatarChange}
                className='hidden'
              />
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2 flex-wrap'>
                <span className='font-semibold text-foreground truncate'>{user.name}</span>
                <RoleBadge role={formData.role} isSuperAdmin={formData.isSuperAdmin} />
                {isCurrentUser && (
                  <Badge variant='outline' className='text-xs'>
                    Tu cuenta
                  </Badge>
                )}
                {isLocked && (
                  <Badge variant='destructive' className='text-xs flex items-center gap-1'>
                    <Lock className='h-3 w-3' />
                    Bloqueado
                  </Badge>
                )}
              </div>
              <p className='text-sm text-muted-foreground mt-0.5'>{user.email}</p>
              <div className='flex items-center gap-3 mt-1.5 text-xs text-muted-foreground'>
                <span className='flex items-center gap-1'>
                  <Calendar className='h-3 w-3' />
                  Registro: {formatDate(user.createdAt)}
                </span>
                <span className='flex items-center gap-1'>
                  <Activity className='h-3 w-3' />
                  Último acceso: {formatDate(user.lastLogin)}
                </span>
              </div>
            </div>
            <div className='flex gap-3 shrink-0'>
              <div className='text-center'>
                <p className='text-lg font-bold text-primary'>
                  {(user._count as any)?.tickets_tickets_clientIdTousers ?? 0}
                </p>
                <p className='text-xs text-muted-foreground flex items-center gap-0.5'>
                  <Ticket className='h-3 w-3' />
                  Tickets
                </p>
              </div>
              <div className='text-center'>
                <p className='text-lg font-bold text-green-600 dark:text-green-400'>
                  {user._count?.tickets_tickets_assigneeIdTousers ?? 0}
                </p>
                <p className='text-xs text-muted-foreground'>Asignados</p>
              </div>
            </div>
          </div>

          {isCurrentUser && (
            <div className='flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2 text-sm text-muted-foreground'>
              <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' />
              <span>
                Estás editando tu propia cuenta. No puedes cambiar tu rol ni desactivarla.
              </span>
            </div>
          )}

          {/* Datos personales */}
          <div className='space-y-3'>
            <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
              <User className='h-4 w-4 text-muted-foreground' />
              Datos personales
            </h3>
            <div className='grid grid-cols-2 gap-3'>
              {(
                [
                  {
                    id: 'edit-name',
                    label: 'Nombre completo',
                    key: 'name',
                    placeholder: 'Juan Pérez',
                    required: true,
                  },
                  {
                    id: 'edit-email',
                    label: 'Email',
                    key: 'email',
                    placeholder: 'usuario@empresa.com',
                    type: 'email',
                    required: true,
                  },
                  {
                    id: 'edit-phone',
                    label: 'Teléfono',
                    key: 'phone',
                    placeholder: '+593 99 999 9999',
                  },
                ] as const
              ).map(({ id, label, key, placeholder, type, required }) => (
                <div key={id} className='space-y-1'>
                  <Label htmlFor={id}>
                    {label} {required && <span className='text-destructive'>*</span>}
                  </Label>
                  <Input
                    id={id}
                    type={type}
                    value={(formData as any)[key]}
                    onChange={e => setFormData(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className={errors[key] ? 'border-destructive' : ''}
                  />
                  {errors[key] && (
                    <p className='text-xs text-destructive flex items-center gap-1'>
                      <AlertCircle className='h-3 w-3' />
                      {errors[key]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Rol y departamento */}
          <div className='space-y-3'>
            <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
              <Building className='h-4 w-4 text-muted-foreground' />
              Rol y departamento
            </h3>
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1'>
                <Label htmlFor='edit-role'>
                  Rol del usuario <span className='text-destructive'>*</span>
                </Label>
                <select
                  id='edit-role'
                  value={formData.role}
                  disabled={isCurrentUser}
                  onChange={e => {
                    const r = e.target.value as UserRole
                    setFormData(p => ({ ...p, role: r }))
                    if (r === 'ADMIN') setErrors(p => ({ ...p, departmentId: '' }))
                  }}
                  className='flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {USER_ROLE_FORM_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {isCurrentUser && (
                  <p className='text-xs text-amber-600'>No puedes cambiar tu propio rol</p>
                )}
              </div>
              <div className='space-y-1'>
                <Label>
                  Departamento{' '}
                  {formData.role !== 'ADMIN' && <span className='text-destructive'>*</span>}
                </Label>
                <DepartmentSelector
                  value={formData.departmentId || null}
                  onChange={val => setFormData(p => ({ ...p, departmentId: val ?? '' }))}
                  departments={departments as any}
                  placeholder='Buscar departamento...'
                  error={errors.departmentId}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Estado y permisos */}
          <div className='space-y-3'>
            <h3 className='text-sm font-semibold text-foreground'>Estado y permisos</h3>
            <div className='space-y-2'>
              {/* Cuenta activa */}
              <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
                <div>
                  <p className='text-sm font-medium'>Usuario activo</p>
                  <p className='text-xs text-muted-foreground'>
                    El usuario puede iniciar sesión y usar el sistema
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))}
                  disabled={isCurrentUser}
                />
              </div>

              {/* Super Admin — solo para ADMIN */}
              {formData.role === 'ADMIN' && !isCurrentUser && (
                <div className='flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5'>
                  <div>
                    <p className='text-sm font-medium'>Administrador Principal (Super Admin)</p>
                    <p className='text-xs text-muted-foreground'>
                      Acceso total a todas las familias y configuraciones del sistema.
                    </p>
                  </div>
                  <Switch
                    checked={formData.isSuperAdmin}
                    onCheckedChange={v => setFormData(p => ({ ...p, isSuperAdmin: v }))}
                  />
                </div>
              )}

              {/* Info de acceso para ADMIN normal (no super admin) */}
              {formData.role === 'ADMIN' && !formData.isSuperAdmin && (
                <div className='rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1'>
                  <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
                    <Activity className='h-3.5 w-3.5' />
                    Acceso como Administrador de Familia
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Este admin ve los módulos de las familias que tiene asignadas en{' '}
                    <span className='font-mono text-[11px]'>
                      Admin → Familias → [Familia] → Personal → Administradores
                    </span>
                    . Si no tiene familias asignadas, tiene acceso completo al sistema.
                  </p>
                </div>
              )}
            </div>

            {/* ── Módulos — grid escalable, funciona con 2 o 10 módulos ── */}
            {formData.role !== 'ADMIN' && systemModules.length > 0 && (
              <div className='space-y-2 pt-1'>
                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  Acceso a módulos
                </p>

                {/* Grid 2 columnas — escala bien con más módulos */}
                <div className='grid grid-cols-2 gap-2'>
                  {systemModules.map(mod => {
                    const isEnabled = (() => {
                      if (mod.key === 'tickets') return formData.ticketsEnabled
                      if (mod.key === 'inventory')
                        return formData.inventoryEnabled || formData.canManageInventory
                      return false
                    })()

                    const handleToggle = (v: boolean) => {
                      if (mod.key === 'tickets') {
                        setFormData(p => ({ ...p, ticketsEnabled: v }))
                      } else if (mod.key === 'inventory') {
                        setFormData(p => ({
                          ...p,
                          inventoryEnabled: v,
                          canManageInventory:
                            formData.role === 'TECHNICIAN' ? v : p.canManageInventory,
                        }))
                      }
                    }

                    return (
                      <div key={mod.key} className='space-y-1.5'>
                        {/* Tarjeta del módulo */}
                        <button
                          type='button'
                          onClick={() => handleToggle(!isEnabled)}
                          className={`w-full text-left rounded-xl border-2 p-3 transition-all duration-150 ${
                            isEnabled
                              ? 'border-primary/40 bg-primary/5 shadow-sm'
                              : 'border-border bg-background hover:border-border/80 hover:bg-muted/30'
                          }`}
                        >
                          <div className='flex items-start justify-between gap-2'>
                            <div className='flex items-center gap-2 min-w-0'>
                              <span className='text-xl leading-none'>
                                {getModuleEmoji(mod.key)}
                              </span>
                              <div className='min-w-0'>
                                <p
                                  className={`text-xs font-semibold leading-tight ${isEnabled ? 'text-primary' : 'text-foreground'}`}
                                >
                                  {mod.name}
                                </p>
                                <p className='text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2'>
                                  {getModuleRoleDescription(mod.key, formData.role)}
                                </p>
                              </div>
                            </div>
                            {/* Indicador visual de estado */}
                            <div
                              className={`flex-shrink-0 w-4 h-4 rounded-full border-2 mt-0.5 transition-colors ${
                                isEnabled
                                  ? 'bg-primary border-primary'
                                  : 'bg-background border-muted-foreground/30'
                              }`}
                            >
                              {isEnabled && (
                                <svg
                                  className='w-full h-full text-primary-foreground p-0.5'
                                  viewBox='0 0 12 12'
                                  fill='none'
                                >
                                  <path
                                    d='M2 6l3 3 5-5'
                                    stroke='currentColor'
                                    strokeWidth='2'
                                    strokeLinecap='round'
                                    strokeLinejoin='round'
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>

                        {/* Sub-opción gestión completa — solo cuando está activo y aplica */}
                        {mod.requiresManager && isEnabled && formData.role !== 'CLIENT' && (
                          <div
                            className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 transition-colors ${
                              formData.canManageInventory
                                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
                                : 'border-dashed border-border bg-muted/20'
                            }`}
                          >
                            <div className='flex items-center gap-1.5 min-w-0'>
                              <span className='text-xs'>🔧</span>
                              <p className='text-[11px] font-medium text-foreground leading-tight'>
                                Gestión completa
                              </p>
                            </div>
                            <Switch
                              checked={formData.canManageInventory}
                              onCheckedChange={v =>
                                setFormData(p => ({ ...p, canManageInventory: v }))
                              }
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Panel de estado actual — separado de los controles, colapsado por defecto */}
            {user && formData.role !== 'ADMIN' && (
              <UserModulesPanel
                userId={user.id}
                role={formData.role}
                canManageInventory={formData.canManageInventory}
                ticketsEnabled={formData.ticketsEnabled}
                inventoryEnabled={formData.inventoryEnabled}
              />
            )}
            {/* Para ADMIN normal: panel informativo de sus familias */}
            {user && formData.role === 'ADMIN' && !formData.isSuperAdmin && (
              <UserModulesPanel
                userId={user.id}
                role={formData.role}
                canManageInventory={true}
                ticketsEnabled={true}
                inventoryEnabled={true}
              />
            )}
          </div>

          <Separator />

          {/* Seguridad */}
          <div className='space-y-3'>
            <h3 className='text-sm font-semibold text-foreground flex items-center gap-1.5'>
              <Lock className='h-4 w-4 text-muted-foreground' />
              Seguridad
            </h3>
            <div className='flex flex-wrap gap-2'>
              {!showResetPassword ? (
                <>
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => setShowResetPassword(true)}
                    className='text-amber-600 border-amber-300 hover:bg-amber-50'
                  >
                    <Lock className='h-3.5 w-3.5 mr-1.5' />
                    Resetear contraseña
                  </Button>
                  {isLocked && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={handleUnlockAccess}
                      disabled={unlockLoading}
                      className='text-primary border-primary/30 hover:bg-primary/10'
                    >
                      <Unlock className='h-3.5 w-3.5 mr-1.5' />
                      {unlockLoading ? 'Desbloqueando...' : 'Desbloquear acceso'}
                    </Button>
                  )}
                </>
              ) : (
                <div className='flex items-center gap-2 w-full'>
                  <Input
                    type='password'
                    placeholder='Nueva contraseña (mín. 6 caracteres)'
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className='flex-1 h-8 text-sm'
                    autoFocus
                  />
                  <Button
                    type='button'
                    size='sm'
                    onClick={handleResetPassword}
                    disabled={resetPasswordLoading || newPassword.length < 6}
                    className='bg-amber-600 hover:bg-amber-700 text-white shrink-0'
                  >
                    {resetPasswordLoading ? 'Guardando...' : 'Confirmar'}
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setShowResetPassword(false)
                      setNewPassword('')
                    }}
                    className='shrink-0'
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type='button'
              onClick={handleSubmit}
              disabled={loading || !formData.name || !formData.email}
            >
              {loading ? (
                <>
                  <Save className='h-4 w-4 mr-2 animate-spin' />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className='h-4 w-4 mr-2' />
                  Guardar cambios
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
