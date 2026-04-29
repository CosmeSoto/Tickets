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

  useEffect(() => {
    setLoading(true)
    fetch(`/api/user/modules?userId=${userId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId, canManageInventory, ticketsEnabled, inventoryEnabled])

  if (loading) {
    return (
      <div className='rounded-lg border bg-muted/30 p-3'>
        <p className='text-xs text-muted-foreground'>Cargando módulos...</p>
      </div>
    )
  }

  const isTechOrClient = role === 'TECHNICIAN' || role === 'CLIENT'
  const hasFamilies = data && data.families.length > 0

  // ── Determinar estado y guía de cada módulo ──
  const ticketsActive = data?.tickets ?? false
  const inventoryActive = data?.inventory ?? false

  const getTicketsGuide = () => {
    if (ticketsActive) return null
    if (role === 'TECHNICIAN') {
      return hasFamilies
        ? 'La familia asignada no tiene el módulo de Tickets activo. Actívalo en: Admin → Configuración → Tickets → [Familia]'
        : 'Asigna este técnico a una familia en: Admin → Familias → [Familia] → Personal → Técnicos de Tickets'
    }
    if (role === 'CLIENT') {
      return 'El cliente verá Tickets cuando tenga tickets creados en una familia con el módulo activo.'
    }
    return null
  }

  const getInventoryGuide = () => {
    if (inventoryActive) return null
    if (role === 'TECHNICIAN') {
      if (!canManageInventory)
        return 'Activa "Gestor de Inventario" arriba y asígnalo en: Admin → Familias → [Familia] → Personal → Gestores de Inventario'
      return hasFamilies
        ? 'La familia asignada no tiene el módulo de Inventario activo. Actívalo en: Admin → Configuración → Inventario → [Familia]'
        : 'Asigna este técnico como gestor en: Admin → Familias → [Familia] → Personal → Gestores de Inventario'
    }
    if (role === 'CLIENT') {
      if (!canManageInventory)
        return 'Activa "Gestor de Inventario" arriba, o asigna un equipo a este cliente desde el módulo de Inventario.'
      return 'Asigna este cliente como gestor en: Admin → Familias → [Familia] → Personal → Gestores de Inventario'
    }
    return null
  }

  const ticketsGuide = getTicketsGuide()
  const inventoryGuide = getInventoryGuide()

  return (
    <div className='rounded-lg border bg-muted/30 p-3 space-y-3'>
      <p className='text-xs font-semibold text-foreground flex items-center gap-1.5'>
        <Activity className='h-3.5 w-3.5 text-muted-foreground' />
        Módulos activos
      </p>

      {/* Módulo Tickets */}
      <div
        className={`flex items-start gap-2.5 p-2.5 rounded-md border ${ticketsActive ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted/50 border-border'}`}
      >
        <span className='text-base mt-0.5'>🎫</span>
        <div className='flex-1 min-w-0'>
          <div className='flex items-center gap-2'>
            <span className='text-xs font-medium'>Tickets</span>
            <Badge
              variant={ticketsActive ? 'default' : 'secondary'}
              className='text-[10px] h-4 px-1.5'
            >
              {ticketsActive ? 'Activo' : 'Inactivo'}
            </Badge>
          </div>
          {ticketsGuide && (
            <p className='text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-tight'>
              ↳ {ticketsGuide}
            </p>
          )}
          {ticketsActive && hasFamilies && (
            <div className='flex flex-wrap gap-1 mt-1'>
              {data!.families
                .filter(f => f.modules.tickets)
                .map(f => (
                  <span
                    key={f.id}
                    className='inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background border'
                  >
                    {f.color && (
                      <span
                        className='w-1.5 h-1.5 rounded-full'
                        style={{ backgroundColor: f.color }}
                      />
                    )}
                    {f.name}
                  </span>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Módulo Inventario */}
      {isTechOrClient && (
        <div
          className={`flex items-start gap-2.5 p-2.5 rounded-md border ${inventoryActive ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' : 'bg-muted/50 border-border'}`}
        >
          <span className='text-base mt-0.5'>📦</span>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-2'>
              <span className='text-xs font-medium'>Inventario</span>
              <Badge
                variant={inventoryActive ? 'default' : 'secondary'}
                className='text-[10px] h-4 px-1.5'
              >
                {inventoryActive ? 'Activo' : 'Inactivo'}
              </Badge>
              {role === 'TECHNICIAN' && !canManageInventory && (
                <Badge variant='outline' className='text-[10px] h-4 px-1.5 text-muted-foreground'>
                  Requiere Gestor
                </Badge>
              )}
            </div>
            {inventoryGuide && (
              <p className='text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-tight'>
                ↳ {inventoryGuide}
              </p>
            )}
            {inventoryActive && hasFamilies && (
              <div className='flex flex-wrap gap-1 mt-1'>
                {data!.families
                  .filter(f => f.modules.inventory)
                  .map(f => (
                    <span
                      key={f.id}
                      className='inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-background border'
                    >
                      {f.color && (
                        <span
                          className='w-1.5 h-1.5 rounded-full'
                          style={{ backgroundColor: f.color }}
                        />
                      )}
                      {f.name}
                    </span>
                  ))}
              </div>
            )}
          </div>
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
            </div>

            {/* ── Módulos visibles — generado dinámicamente desde system_modules ── */}
            {formData.role !== 'ADMIN' && systemModules.length > 0 && (
              <div className='space-y-2'>
                <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1'>
                  Módulos visibles
                </p>
                <p className='text-xs text-muted-foreground -mt-1'>
                  Controla qué secciones aparecen en la navegación de este usuario.
                </p>

                {systemModules.map(mod => {
                  // Determinar si el módulo está activo para este usuario
                  const isEnabled = (() => {
                    if (mod.key === 'tickets') return formData.ticketsEnabled
                    if (mod.key === 'inventory')
                      return formData.inventoryEnabled || formData.canManageInventory
                    // Módulos futuros: leer de formData.moduleFlags[mod.key] cuando exista
                    return false
                  })()

                  const handleToggle = (v: boolean) => {
                    if (mod.key === 'tickets') {
                      setFormData(p => ({ ...p, ticketsEnabled: v }))
                    } else if (mod.key === 'inventory') {
                      setFormData(p => ({
                        ...p,
                        inventoryEnabled: v,
                        // Para técnicos: activar inventario implica activar canManageInventory
                        canManageInventory:
                          formData.role === 'TECHNICIAN' ? v : p.canManageInventory,
                      }))
                    }
                    // Módulos futuros: setFormData(p => ({ ...p, moduleFlags: { ...p.moduleFlags, [mod.key]: v } }))
                  }

                  return (
                    <div key={mod.key}>
                      <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
                        <div className='flex items-center gap-2.5'>
                          <span className='text-base'>{getModuleEmoji(mod.key)}</span>
                          <div>
                            <p className='text-sm font-medium'>{mod.name}</p>
                            <p className='text-xs text-muted-foreground'>
                              {getModuleRoleDescription(mod.key, formData.role)}
                            </p>
                          </div>
                        </div>
                        <Switch checked={isEnabled} onCheckedChange={handleToggle} />
                      </div>

                      {/* Sub-opción: gestión completa (solo para módulos con requiresManager) */}
                      {mod.requiresManager && isEnabled && formData.role !== 'CLIENT' && (
                        <div className='flex items-center justify-between rounded-lg border border-dashed px-3 py-2.5 ml-4 mt-1'>
                          <div>
                            <p className='text-sm font-medium text-muted-foreground'>
                              Gestión completa
                            </p>
                            <p className='text-xs text-muted-foreground'>
                              Puede crear, editar y configurar activos (no solo verlos)
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
            )}

            {/* Panel de estado actual de módulos */}
            {user && formData.role !== 'ADMIN' && (
              <UserModulesPanel
                userId={user.id}
                role={formData.role}
                canManageInventory={formData.canManageInventory}
                ticketsEnabled={formData.ticketsEnabled}
                inventoryEnabled={formData.inventoryEnabled}
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
