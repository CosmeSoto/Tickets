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
  User, Mail, Phone, Building, Camera, Save,
  AlertCircle, AlertTriangle, Activity, RotateCcw,
  X, Lock, Unlock, Calendar, Ticket,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UserData } from '@/hooks/use-users'
import { USER_ROLE_FORM_OPTIONS, type UserRole } from '@/lib/constants/user-constants'
import { DepartmentSelector } from '@/components/ui/department-selector'

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
  isSuperAdmin: boolean
  avatar?: File
}

export function EditUserModal({ isOpen, onClose, onUserUpdated, user, departments }: EditUserModalProps) {
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
    name: '', email: '', role: 'CLIENT', departmentId: '',
    phone: '', isActive: true, canManageInventory: false, isSuperAdmin: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: typeof user.department === 'object' ? user.department?.id || '' : user.department || '',
        phone: user.phone || '',
        isActive: user.isActive,
        canManageInventory: (user as any).canManageInventory ?? false,
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
        toast({ title: 'Error', description: result.error || 'No se pudo actualizar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
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
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Archivo inválido', description: 'Selecciona una imagen válida', variant: 'destructive' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'La imagen debe ser menor a 5MB', variant: 'destructive' })
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
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    if (!formData.email.trim()) newErrors.email = 'El email es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email inválido'
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) newErrors.phone = 'Formato inválido'
    if (formData.role !== 'ADMIN' && !formData.departmentId) newErrors.departmentId = 'Requerido para este rol'
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
        toast({ title: 'Usuario actualizado', description: `${formData.name} actualizado correctamente` })
        handleClose()
        onUserUpdated()
      } else {
        toast({ title: 'Error', description: result.error || 'No se pudo actualizar', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = user?.id === session?.user?.id
  const selectedDepartment = departments.find(d => d.id === formData.departmentId)

  const formatDate = (dateString?: string) =>
    dateString ? new Date(dateString).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Editar Usuario
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          {/* ── CABECERA: Avatar + info básica ─────────────────────── */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
            {/* Avatar con controles */}
            <div className="relative group shrink-0">
              <Avatar className="h-16 w-16 border-2 border-background shadow">
                <AvatarImage src={avatarPreview || user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                  {user.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {/* Overlay de acciones al hover */}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  title="Cambiar foto"
                  onClick={() => document.getElementById('edit-avatar-input')?.click()}
                  className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                {(avatarPreview || user.avatar) && (
                  <button
                    type="button"
                    title="Eliminar foto"
                    onClick={handleDeleteAvatar}
                    className="p-1 rounded-full bg-white/20 hover:bg-red-500/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {formData.avatar && (
                  <button
                    type="button"
                    title="Deshacer cambio"
                    onClick={() => { setFormData(p => ({ ...p, avatar: undefined })); setAvatarPreview(user.avatar || null) }}
                    className="p-1 rounded-full bg-white/20 hover:bg-amber-500/60 text-white"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <input id="edit-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            {/* Info del usuario */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground truncate">{user.name}</span>
                <RoleBadge role={formData.role} isSuperAdmin={formData.isSuperAdmin} />
                {isCurrentUser && <Badge variant="outline" className="text-xs">Tu cuenta</Badge>}
                {isLocked && <Badge variant="destructive" className="text-xs flex items-center gap-1"><Lock className="h-3 w-3" />Bloqueado</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">{user.email}</p>
              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Registro: {formatDate(user.createdAt)}</span>
                <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Último acceso: {formatDate(user.lastLogin)}</span>
              </div>
            </div>

            {/* Estadísticas rápidas */}
            <div className="flex gap-3 shrink-0">
              <div className="text-center">
                <p className="text-lg font-bold text-blue-600">{user._count?.tickets_tickets_clientIdTousers ?? 0}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-0.5"><Ticket className="h-3 w-3" />Tickets</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{user._count?.tickets_tickets_assigneeIdTousers ?? 0}</p>
                <p className="text-xs text-muted-foreground">Asignados</p>
              </div>
            </div>
          </div>

          {/* Alerta usuario actual */}
          {isCurrentUser && (
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>Estás editando tu propia cuenta. No puedes cambiar tu rol ni desactivarla.</span>
            </div>
          )}

          {/* ── SECCIÓN 1: Datos personales ────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              Datos personales
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Nombre completo <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Juan Pérez"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  placeholder="+593 99 999 9999"
                  className={errors.phone ? 'border-destructive' : ''}
                />
                {errors.phone && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.phone}</p>}
              </div>
            </div>
          </div>

          <Separator />

          {/* ── SECCIÓN 2: Rol y departamento ──────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Building className="h-4 w-4 text-muted-foreground" />
              Rol y departamento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="edit-role">Rol del usuario <span className="text-destructive">*</span></Label>
                <select
                  id="edit-role"
                  value={formData.role}
                  disabled={isCurrentUser}
                  onChange={e => {
                    const r = e.target.value as UserRole
                    setFormData(p => ({ ...p, role: r }))
                    if (r === 'ADMIN') setErrors(p => ({ ...p, departmentId: '' }))
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {USER_ROLE_FORM_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                {isCurrentUser && <p className="text-xs text-amber-600">No puedes cambiar tu propio rol</p>}
              </div>
              <div className="space-y-1">
                <Label>Departamento {formData.role !== 'ADMIN' && <span className="text-destructive">*</span>}</Label>
                <DepartmentSelector
                  value={formData.departmentId || null}
                  onChange={val => setFormData(p => ({ ...p, departmentId: val ?? '' }))}
                  departments={departments}
                  placeholder="Buscar departamento..."
                  emptyLabel="Sin departamento"
                  error={errors.departmentId}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── SECCIÓN 3: Estado y permisos ───────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Estado y permisos</h3>
            <div className="space-y-2">
              {/* Estado activo */}
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Usuario activo</p>
                  <p className="text-xs text-muted-foreground">El usuario puede iniciar sesión y usar el sistema</p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                  disabled={isCurrentUser}
                  className="h-4 w-4 rounded border-border disabled:opacity-50"
                />
              </div>

              {/* Gestor de inventario — solo no-ADMIN */}
              {formData.role !== 'ADMIN' && (
                <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Gestor de Inventario</p>
                    <p className="text-xs text-muted-foreground">Permite gestionar activos, consumibles y configuración de inventario</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.canManageInventory}
                    onChange={e => setFormData(p => ({ ...p, canManageInventory: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>
              )}

              {/* Super Admin — solo ADMIN y no es el usuario actual */}
              {formData.role === 'ADMIN' && !isCurrentUser && (
                <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Administrador Principal (Super Admin)</p>
                    <p className="text-xs text-muted-foreground">Acceso total a todas las familias. Solo debe haber uno.</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.isSuperAdmin}
                    onChange={e => setFormData(p => ({ ...p, isSuperAdmin: e.target.checked }))}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* ── SECCIÓN 4: Seguridad ───────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-muted-foreground" />
              Seguridad
            </h3>
            <div className="flex flex-wrap gap-2">
              {!showResetPassword ? (
                <>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => setShowResetPassword(true)}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Resetear contraseña
                  </Button>
                  {isLocked && (
                    <Button
                      type="button" variant="outline" size="sm"
                      onClick={handleUnlockAccess} disabled={unlockLoading}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <Unlock className="h-3.5 w-3.5 mr-1.5" />
                      {unlockLoading ? 'Desbloqueando...' : 'Desbloquear acceso'}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <Input
                    type="password"
                    placeholder="Nueva contraseña (mín. 6 caracteres)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="flex-1 h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    type="button" size="sm"
                    onClick={handleResetPassword}
                    disabled={resetPasswordLoading || newPassword.length < 6}
                    className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
                  >
                    {resetPasswordLoading ? 'Guardando...' : 'Confirmar'}
                  </Button>
                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => { setShowResetPassword(false); setNewPassword('') }}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* ── FOOTER ────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !formData.name || !formData.email}
            >
              {loading ? (
                <><Save className="h-4 w-4 mr-2 animate-spin" />Guardando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Guardar cambios</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
