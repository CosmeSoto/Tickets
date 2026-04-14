'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  User, Mail, Phone, Building, Camera,
  UserPlus, Eye, EyeOff, AlertCircle, Save, X, Info, Crown
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import {
  USER_ROLE_FORM_OPTIONS,
  type UserRole
} from '@/lib/constants/user-constants'
import { DepartmentSelector } from '@/components/ui/department-selector'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
  departments: Array<{ id: string; name: string; color: string }>
  suggestedRole?: UserRole
}

interface NewUserData {
  name: string
  email: string
  password: string
  role: UserRole
  departmentId: string
  phone: string
  isSuperAdmin: boolean
  avatar?: File
}

export function CreateUserModal({
  isOpen,
  onClose,
  onUserCreated,
  departments,
  suggestedRole
}: CreateUserModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const isSuperAdminSession = (session?.user as any)?.isSuperAdmin === true
  const defaultRole: UserRole = suggestedRole ?? 'CLIENT'

  const [formData, setFormData] = useState<NewUserData>({
    name: '', email: '', password: '',
    role: defaultRole,
    departmentId: '', phone: '', isSuperAdmin: false, avatar: undefined
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Actualizar rol sugerido cuando cambia (ej: usuario abre modal con filtro diferente)
  useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({ ...prev, role: suggestedRole ?? 'CLIENT' }))
    }
  }, [isOpen, suggestedRole])

  const handleClose = () => {
    setFormData({ name: '', email: '', password: '', role: defaultRole, departmentId: '', phone: '', isSuperAdmin: false, avatar: undefined })
    setErrors({})
    setAvatarPreview(null)
    onClose()
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) newErrors.name = 'El nombre es requerido'
    if (!formData.email.trim()) newErrors.email = 'El email es requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email inválido'
    if (!formData.password.trim()) newErrors.password = 'La contraseña es requerida'
    else if (formData.password.length < 6) newErrors.password = 'Mínimo 6 caracteres'
    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) newErrors.phone = 'Formato inválido'
    if (formData.role !== 'ADMIN' && !formData.departmentId) newErrors.departmentId = 'Requerido para este rol'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setLoading(true)
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          role: formData.role,
          departmentId: formData.departmentId || null,
          phone: formData.phone.trim() || null,
          isActive: true,
          isSuperAdmin: formData.role === 'ADMIN' ? formData.isSuperAdmin : false,
        }),
      })
      const result = await response.json()
      if (response.ok && result.success) {
        if (formData.avatar && result.user?.id) {
          const fd = new FormData()
          fd.append('avatar', formData.avatar)
          await fetch(`/api/users/${result.user.id}/avatar`, { method: 'POST', body: fd })
        }
        const roleLabel = USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)?.label
        toast({ title: 'Usuario creado', description: `${formData.name} registrado como ${roleLabel}` })
        handleClose()
        onUserCreated()
      } else {
        toast({ title: 'Error al crear usuario', description: result.error || 'No se pudo crear el usuario', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const initials = formData.name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || 'U'
  const selectedDepartment = departments.find(d => d.id === formData.departmentId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Crear Nuevo Usuario
          </DialogTitle>
          <DialogDescription>
            Completa la información para registrar una nueva cuenta en el sistema
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">

          {/* ── CABECERA: Avatar + preview ─────────────────────────── */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/40 border border-border">
            <div className="relative group shrink-0">
              <Avatar className="h-16 w-16 border-2 border-background shadow">
                <AvatarImage src={avatarPreview || undefined} alt="Preview" />
                <AvatarFallback className="text-base font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                <button
                  type="button"
                  title="Seleccionar foto"
                  onClick={() => document.getElementById('create-avatar-input')?.click()}
                  className="p-1 rounded-full bg-white/20 hover:bg-white/40 text-white"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                {avatarPreview && (
                  <button
                    type="button"
                    title="Quitar foto"
                    onClick={() => { setFormData(p => ({ ...p, avatar: undefined })); setAvatarPreview(null) }}
                    className="p-1 rounded-full bg-white/20 hover:bg-red-500/60 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <input id="create-avatar-input" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground truncate">{formData.name || 'Nombre del usuario'}</p>
              <p className="text-sm text-muted-foreground truncate">{formData.email || 'email@empresa.com'}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role) && (() => {
                  const role = USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)!
                  return (
                    <Badge className={role.color}>
                      <role.icon className="h-3 w-3 mr-1" />
                      {formData.role === 'ADMIN' && formData.isSuperAdmin ? 'Super Admin' : role.label}
                    </Badge>
                  )
                })()}
                {selectedDepartment && (
                  <Badge variant="outline" style={{ borderColor: selectedDepartment.color, color: selectedDepartment.color }}>
                    <Building className="h-3 w-3 mr-1" />
                    {selectedDepartment.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Nota de rol sugerido */}
          {suggestedRole && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
              <Info className="h-4 w-4 shrink-0" />
              <span>Rol sugerido basado en el filtro activo. Puedes cambiarlo si lo necesitas.</span>
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
                <Label htmlFor="create-name">Nombre completo <span className="text-destructive">*</span></Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Juan Pérez"
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="create-email"
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="usuario@empresa.com"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p>}
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-phone">Teléfono</Label>
                <Input
                  id="create-phone"
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

          {/* ── SECCIÓN 2: Contraseña ──────────────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Acceso al sistema
            </h3>
            <div className="space-y-1">
              <Label htmlFor="create-password">Contraseña <span className="text-destructive">*</span></Label>
              <div className="relative">
                <Input
                  id="create-password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                />
                <Button
                  type="button" variant="ghost" size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(p => !p)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.password}</p>}
            </div>
          </div>

          <Separator />

          {/* ── SECCIÓN 3: Rol y departamento ──────────────────────── */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Building className="h-4 w-4 text-muted-foreground" />
              Rol y departamento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="create-role">Rol del usuario <span className="text-destructive">*</span></Label>
                <select
                  id="create-role"
                  value={formData.role}
                  onChange={e => {
                    const r = e.target.value as UserRole
                    setFormData(p => ({ ...p, role: r, isSuperAdmin: false }))
                    if (r === 'ADMIN') setErrors(p => ({ ...p, departmentId: '' }))
                  }}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {USER_ROLE_FORM_OPTIONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>
                  Departamento {formData.role !== 'ADMIN' && <span className="text-destructive">*</span>}
                </Label>
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

            {/* Super Admin — solo visible para Super Admins cuando el rol es ADMIN */}
            {isSuperAdminSession && formData.role === 'ADMIN' && (
              <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-amber-600" />
                    Administrador Principal (Super Admin)
                  </p>
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

          {/* ── FOOTER ────────────────────────────────────────────── */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !formData.name || !formData.email || !formData.password}
            >
              {loading ? (
                <><Save className="h-4 w-4 mr-2 animate-spin" />Creando...</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" />Crear Usuario</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
