'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  User, 
  Mail, 
  Phone, 
  Building, 
  Camera, 
  Save,
  UserCheck,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Activity,
  RotateCcw,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { UserData } from '@/hooks/use-users'
import { 
  USER_ROLE_FORM_OPTIONS,
  type UserRole
} from '@/lib/constants/user-constants'

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
  avatar?: File
}

export function EditUserModal({ isOpen, onClose, onUserUpdated, user, departments }: EditUserModalProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
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
    avatar: undefined
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Cargar datos del usuario cuando se abre el modal
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
        avatar: undefined
      })
      setAvatarPreview(user.avatar || null)
      setActiveTab('basic')
      setErrors({})
      setIsLocked(false)
      // Verificar si el usuario está bloqueado
      fetch(`/api/users/${user.id}/reset-password`, { method: 'GET' })
        .then(r => r.json())
        .then(data => setIsLocked(data.isLocked || false))
        .catch(() => setIsLocked(false))
    }
  }, [user, isOpen])

  const handleClose = () => {
    setErrors({})
    setAvatarPreview(null)
    setActiveTab('basic')
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
        toast({ title: 'Error', description: result.error || 'No se pudo actualizar la contraseña', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor', variant: 'destructive' })
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
        toast({ title: 'Error', description: result.error || 'No se pudo desbloquear', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error de conexión', description: 'No se pudo conectar con el servidor', variant: 'destructive' })
    } finally {
      setUnlockLoading(false)
    }
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Archivo inválido',
          description: 'Por favor selecciona una imagen válida',
          variant: 'destructive'
        })
        return
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'Archivo muy grande',
          description: 'La imagen debe ser menor a 5MB',
          variant: 'destructive'
        })
        return
      }

      setFormData({ ...formData, avatar: file })
      
      // Crear preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido'
    }

    if (formData.phone && !/^[\d\s\-\+\(\)]+$/.test(formData.phone)) {
      newErrors.phone = 'Formato de teléfono inválido'
    }

    // Departamento requerido para técnicos y clientes
    if (formData.role !== 'ADMIN' && !formData.departmentId) {
      newErrors.departmentId = 'El departamento es requerido para este rol'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!user || !validateForm()) {
      toast({
        title: 'Datos inválidos',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      // Actualizar usuario primero
      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        departmentId: formData.departmentId || null,
        phone: formData.phone.trim() || null,
        isActive: formData.isActive,
        canManageInventory: formData.canManageInventory,
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Si hay nuevo avatar, subirlo después
        if (formData.avatar) {
          const avatarFormData = new FormData()
          avatarFormData.append('avatar', formData.avatar)

          await fetch(`/api/users/${user.id}/avatar`, {
            method: 'POST',
            body: avatarFormData
          })
        }
        
        toast({
          title: 'Usuario actualizado exitosamente',
          description: `${formData.name} ha sido actualizado correctamente`,
        })
        
        handleClose()
        onUserUpdated()
      } else {
        toast({
          title: 'Error al actualizar usuario',
          description: result.error || 'No se pudo actualizar el usuario',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error updating user:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const isCurrentUser = user?.id === session?.user?.id
  const selectedRole = USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)
  const selectedDepartment = departments.find(d => d.id === formData.departmentId)

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No disponible'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!user) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5" />
            <span>Editar Usuario: {user.name}</span>
          </DialogTitle>
          <DialogDescription>
            Modifica la información del usuario en el sistema
          </DialogDescription>
        </DialogHeader>

        {/* Alerta para usuario actual */}
        {isCurrentUser && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-700">
                <h4 className="font-medium mb-1">Editando tu propia cuenta</h4>
                <p className="text-xs">No puedes desactivar tu propia cuenta por seguridad.</p>
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Información</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="activity">Actividad</TabsTrigger>
            <TabsTrigger value="preview">Vista Previa</TabsTrigger>
          </TabsList>

          {/* Información Básica */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre Completo *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Juan Pérez"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="usuario@empresa.com"
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-role">Rol del Usuario *</Label>
                <select
                  id="edit-role"
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as any
                    setFormData({ ...formData, role: newRole })
                    // Si cambia a ADMIN, limpiar error de departamento
                    if (newRole === 'ADMIN' && errors.departmentId) {
                      setErrors(prev => ({ ...prev, departmentId: undefined as any }))
                    }
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {USER_ROLE_FORM_OPTIONS.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-department">
                  Departamento {formData.role !== 'ADMIN' ? '*' : ''}
                </Label>
                <select
                  id="edit-department"
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${errors.departmentId ? 'border-red-500' : 'border-input'}`}
                >
                  <option value="">Sin departamento</option>
                  {departments.map(dept => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
                {errors.departmentId && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.departmentId}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+52 55 1234 5678"
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && (
                  <p className="text-sm text-red-600 flex items-center">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errors.phone}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-active">Estado del Usuario</Label>
                <div className="flex items-center space-x-3 h-10">
                  <input
                    type="checkbox"
                    id="edit-active"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    disabled={isCurrentUser}
                    className="h-4 w-4 rounded border-border disabled:opacity-50"
                  />
                  <Label htmlFor="edit-active" className="text-sm font-medium">
                    Usuario activo
                  </Label>
                  {isCurrentUser && (
                    <span className="text-xs text-amber-600">
                      (no puedes desactivarte)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Permiso de gestor de inventario */}
            <div className="rounded-lg border p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Gestor de Inventario</p>
                <p className="text-xs text-muted-foreground">
                  Permite a este usuario gestionar activos, consumibles y configuración de inventario.
                  Aplica a cualquier rol (Admin siempre tiene acceso).
                </p>
              </div>
              <input
                type="checkbox"
                id="edit-can-manage-inventory"
                checked={formData.canManageInventory}
                onChange={(e) => setFormData({ ...formData, canManageInventory: e.target.checked })}
                disabled={formData.role === 'ADMIN'}
                className="h-4 w-4 rounded border-border disabled:opacity-50"
                title={formData.role === 'ADMIN' ? 'Los administradores siempre tienen acceso' : ''}
              />
            </div>
          </TabsContent>

          {/* Perfil */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Camera className="h-5 w-5" />
                  <span>Avatar del Usuario</span>
                </CardTitle>
                <CardDescription>
                  Actualiza la imagen de perfil del usuario
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                      <AvatarImage src={avatarPreview || user.avatar || undefined} alt={user.name} />
                      <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Botón para cambiar foto */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 shadow-sm"
                      title="Cambiar foto"
                      onClick={() => document.getElementById('edit-avatar')?.click()}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    {/* Botón para restaurar foto - Solo visible si hay cambios pendientes */}
                    {formData.avatar && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute -top-2 -left-2 h-6 w-6 rounded-full p-0 shadow-sm bg-white hover:bg-orange-50 border-orange-200 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Cancelar cambio"
                        onClick={() => {
                          setFormData({ ...formData, avatar: undefined })
                          setAvatarPreview(user.avatar || null)
                        }}
                      >
                        <RotateCcw className="h-3 w-3 text-orange-600" />
                      </Button>
                    )}
                    {/* Botón para eliminar foto - Solo visible si el usuario tiene avatar */}
                    {(avatarPreview || user.avatar) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 shadow-sm bg-white hover:bg-red-50 border-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar foto"
                        onClick={async () => {
                          // Eliminar avatar del servidor
                          try {
                            const response = await fetch(`/api/users/${user.id}/avatar`, {
                              method: 'DELETE',
                            })
                            
                            const result = await response.json()
                            
                            if (response.ok && result.success) {
                              setAvatarPreview(null)
                              setFormData({ ...formData, avatar: undefined })
                              
                              toast({
                                title: 'Avatar eliminado',
                                description: 'La foto de perfil ha sido eliminada exitosamente',
                              })
                              
                              // Actualizar la lista de usuarios
                              onUserUpdated()
                            } else {
                              toast({
                                title: 'Error al eliminar',
                                description: result.error || 'No se pudo eliminar el avatar',
                                variant: 'destructive',
                              })
                            }
                          } catch (error) {
                            console.error('Error al eliminar avatar:', error)
                            toast({
                              title: 'Error de conexión',
                              description: 'No se pudo conectar con el servidor',
                              variant: 'destructive',
                            })
                          }
                        }}
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="edit-avatar">Cambiar Imagen</Label>
                      <Input
                        id="edit-avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">
                        Haz clic en el icono de cámara para cambiar la foto. Formatos: JPG, PNG, GIF (máx. 5MB)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Actividad */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Información de Actividad</span>
                </CardTitle>
                <CardDescription>
                  Historial y estadísticas del usuario
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Último Acceso</Label>
                    <p className="text-sm font-medium">{formatDate(user.lastLogin)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Fecha de Registro</Label>
                    <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Tickets Creados</Label>
                    <p className="text-2xl font-bold text-blue-600">{user._count.tickets_tickets_createdByIdTousers || 0}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Tickets Asignados</Label>
                    <p className="text-2xl font-bold text-green-600">{user._count.tickets_tickets_assigneeIdTousers || 0}</p>
                  </div>
                </div>

                {user.department && typeof user.department === 'object' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-muted-foreground">Departamento Actual</Label>
                    <Badge variant="outline" style={{ 
                      borderColor: user.department.color,
                      color: user.department.color 
                    }}>
                      <Building className="h-3 w-3 mr-1" />
                      {user.department.name}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vista Previa */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Vista Previa de Cambios</span>
                </CardTitle>
                <CardDescription>
                  Revisa los cambios antes de guardar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-6">
                  <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                    <AvatarImage src={avatarPreview || user.avatar || undefined} alt={formData.name} />
                    <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {formData.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{formData.name}</h3>
                      <p className="text-muted-foreground flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {formData.email}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      {selectedRole && (
                        <Badge className={selectedRole.color}>
                          <selectedRole.icon className="h-3 w-3 mr-1" />
                          {selectedRole.label}
                        </Badge>
                      )}
                      
                      <Badge variant={formData.isActive ? "default" : "secondary"}>
                        {formData.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                      
                      {selectedDepartment && (
                        <Badge variant="outline" style={{ 
                          borderColor: selectedDepartment.color,
                          color: selectedDepartment.color 
                        }}>
                          <Building className="h-3 w-3 mr-1" />
                          {selectedDepartment.name}
                        </Badge>
                      )}

                      {isCurrentUser && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Tu cuenta
                        </Badge>
                      )}
                    </div>
                    
                    {formData.phone && (
                      <p className="text-sm text-muted-foreground flex items-center">
                        <Phone className="h-4 w-4 mr-1" />
                        {formData.phone}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between">
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancelar
            </Button>
            {/* Resetear contraseña */}
            {!showResetPassword ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetPassword(true)}
                  disabled={loading}
                  className="text-amber-600 border-amber-300 hover:bg-amber-50"
                >
                  Resetear Contraseña
                </Button>
                {isLocked && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUnlockAccess}
                    disabled={unlockLoading || loading}
                    className="text-green-600 border-green-300 hover:bg-green-50"
                  >
                    {unlockLoading ? 'Desbloqueando...' : 'Desbloquear Acceso'}
                  </Button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  placeholder="Nueva contraseña (mín. 6 caracteres)"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-52 h-8 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={resetPasswordLoading || newPassword.length < 6}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {resetPasswordLoading ? 'Guardando...' : 'Confirmar'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowResetPassword(false); setNewPassword('') }}
                >
                  ✕
                </Button>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            {activeTab !== 'basic' && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  const tabs = ['basic', 'profile', 'activity', 'preview']
                  const currentIndex = tabs.indexOf(activeTab)
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1])
                  }
                }}
                disabled={loading}
              >
                Anterior
              </Button>
            )}
            
            {activeTab !== 'preview' ? (
              <Button 
                type="button" 
                onClick={() => {
                  const tabs = ['basic', 'profile', 'activity', 'preview']
                  const currentIndex = tabs.indexOf(activeTab)
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1])
                  }
                }}
                disabled={loading}
              >
                Siguiente
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !formData.name || !formData.email}
              >
                {loading ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-spin" />
                    Guardando Cambios...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Guardar Cambios
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}