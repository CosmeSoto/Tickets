'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { getRoleLabel as getRoleLabelFn, getRoleColor as getRoleColorFn } from '@/components/ui/role-badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Wrench,
  UserCircle,
  Save,
  Edit,
  Camera,
  Upload,
  Loader2,
  X,
  Key,
  Eye,
  EyeOff
} from 'lucide-react'

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  const [showRemoveAvatarDialog, setShowRemoveAvatarDialog] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)
  
  // Estados para cambio de contraseña
  const [changingPassword, setChangingPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    // Cargar datos del usuario incluyendo avatar actualizado
    const loadUserData = async () => {
      try {
        const response = await fetch(`/api/users/${session.user.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.user) {
            setCurrentAvatar(data.user.avatar)
            setFormData({
              name: data.user.name || '',
              email: data.user.email || '',
              phone: data.user.phone || '',
            })
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
        // Fallback a datos de sesión
        setCurrentAvatar(session.user.avatar || null)
        setFormData({
          name: session.user.name || '',
          email: session.user.email || '',
          phone: session.user.phone || '',
        })
      }
    }
    
    loadUserData()
  }, [session, status, router])

  const getRoleIcon = () => {
    switch (session?.user?.role) {
      case 'ADMIN':
        return Shield
      case 'TECHNICIAN':
        return Wrench
      case 'CLIENT':
        return UserCircle
      default:
        return UserCircle
    }
  }

  const getRoleColor = () => {
    return getRoleColorFn(session?.user?.role ?? '', (session?.user as any)?.isSuperAdmin)
  }

  const getRoleLabel = () => {
    if (session?.user?.role === 'TECHNICIAN') {
      return (session.user as any).canManageInventory ? 'Técnico · Gestor' : 'Técnico'
    }
    return getRoleLabelFn(session?.user?.role ?? '', (session?.user as any)?.isSuperAdmin)
  }

  // NUEVA FUNCIONALIDAD DE AVATAR
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Por favor selecciona una imagen válida (JPG, PNG, GIF, WebP)',
        variant: 'destructive',
      })
      return
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Archivo muy grande',
        description: 'La imagen debe ser menor a 5MB',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    
    // Crear preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewAvatar(e.target?.result as string)
      setShowAvatarDialog(true)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = async () => {
    if (!selectedFile || !session?.user?.id) return

    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', selectedFile)

      const response = await fetch(`/api/users/${session.user.id}/avatar`, {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Actualizar avatar local
        setCurrentAvatar(result.data.avatarUrl)
        setShowAvatarDialog(false)
        setSelectedFile(null)
        setPreviewAvatar(null)
        
        // Disparar evento para actualizar header
        window.dispatchEvent(new CustomEvent('avatarUpdated', { 
          detail: { avatarUrl: result.data.avatarUrl } 
        }))
        
        toast({
          title: 'Avatar actualizado',
          description: 'Tu foto de perfil se ha actualizado correctamente',
        })
        
      } else {
        toast({
          title: 'Error al subir avatar',
          description: result.error || 'No se pudo actualizar tu foto de perfil',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!session?.user?.id) return

    setAvatarUploading(true)
    try {
      const response = await fetch(`/api/users/${session.user.id}/avatar`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Actualizar avatar local
        setCurrentAvatar(null)
        setShowRemoveAvatarDialog(false)
        
        // Disparar evento para actualizar header
        window.dispatchEvent(new CustomEvent('avatarUpdated', { 
          detail: { avatarUrl: null } 
        }))
        
        toast({
          title: 'Avatar eliminado',
          description: 'Tu foto de perfil se ha eliminado correctamente',
        })
        
      } else {
        toast({
          title: 'Error al eliminar avatar',
          description: result.error || 'No se pudo eliminar tu foto de perfil',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error removing avatar:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Intenta nuevamente.',
        variant: 'destructive',
      })
    } finally {
      setAvatarUploading(false)
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/users/${session?.user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Actualizar la sesión con los nuevos datos
        if (update) {
          await update()
        }

        toast({
          title: 'Perfil actualizado',
          description: 'Tu información ha sido guardada exitosamente',
        })
        setEditing(false)
        
        // Recargar la página para reflejar los cambios
        window.location.reload()
      } else {
        toast({
          title: 'Error al actualizar',
          description: result.error || 'No se pudo actualizar el perfil',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error updating profile:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    // Validaciones básicas
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast({
        title: 'Campos incompletos',
        description: 'Por favor completa todos los campos',
        variant: 'destructive',
      })
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contraseñas nuevas no coinciden',
        variant: 'destructive',
      })
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: 'Contraseña muy corta',
        description: 'La contraseña debe tener al menos 6 caracteres',
        variant: 'destructive',
      })
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordForm),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Contraseña actualizada',
          description: 'Tu contraseña ha sido cambiada exitosamente',
        })
        
        // Limpiar formulario
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
      } else {
        toast({
          title: 'Error al cambiar contraseña',
          description: result.error || 'No se pudo cambiar la contraseña',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error changing password:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setChangingPassword(false)
    }
  }

  const RoleIcon = getRoleIcon()

  if (status === 'loading') {
    return (
      <RoleDashboardLayout title='Mi Perfil' subtitle='Gestiona tu información personal'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session) {
    return null
  }

  return (
    <RoleDashboardLayout
      title='Mi Perfil'
      subtitle='Gestiona tu información personal y configuración de cuenta'
    >
      <div className='max-w-4xl mx-auto space-y-6'>
        {/* Información Principal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Información Personal</span>
            </CardTitle>
            <CardDescription>
              Actualiza tu información personal y de contacto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar y Rol - MEJORADO */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
              <div className="relative group flex-shrink-0">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={currentAvatar || undefined} />
                  <AvatarFallback className="text-lg">
                    <RoleIcon className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                {/* Botón para cambiar foto */}
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 shadow-sm"
                  title="Cambiar foto"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                {/* Botón para eliminar foto - Solo visible si hay avatar */}
                {currentAvatar && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 shadow-sm bg-white hover:bg-red-50 border-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Eliminar foto"
                    onClick={() => setShowRemoveAvatarDialog(true)}
                    disabled={avatarUploading}
                  >
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <div className="space-y-2 text-center sm:text-left">
                <h3 className="text-xl font-semibold">{session.user.name}</h3>
                <Badge className={getRoleColor()}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {getRoleLabel()}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Miembro desde {new Date().toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>

            <Separator />

            {/* Formulario */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={true}
                    className="pl-10 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  El email no se puede cambiar por seguridad
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editing}
                    className="pl-10"
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Departamento</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    value={session.user.department || 'Sin departamento'}
                    disabled={true}
                    className="pl-10 bg-muted"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Contacta al administrador para cambiar de departamento
                </p>
              </div>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center justify-end space-x-3">
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditing(false)
                      setFormData({
                        name: session.user.name || '',
                        email: session.user.email || '',
                        phone: session.user.phone || '',
                      })
                    }}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={loading || !formData.name}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </>
              ) : (
                <Button onClick={() => setEditing(true)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Perfil
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seguridad */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>Seguridad</span>
            </CardTitle>
            <CardDescription>
              Cambia tu contraseña para mantener tu cuenta segura
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Contraseña actual</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="pl-10 pr-10"
                    placeholder="Ingresa tu contraseña actual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="pl-10 pr-10"
                    placeholder="Mínimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="pl-10 pr-10"
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={changingPassword || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                <Key className="h-4 w-4 mr-2" />
                {changingPassword ? 'Cambiando...' : 'Cambiar Contraseña'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de confirmación de avatar - NUEVO */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Confirmar nueva foto de perfil</DialogTitle>
            <DialogDescription>
              ¿Te gusta cómo se ve tu nueva foto de perfil?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={previewAvatar || undefined} alt="Preview" />
              <AvatarFallback>
                <RoleIcon className="h-16 w-16" />
              </AvatarFallback>
            </Avatar>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAvatarDialog(false)
                setPreviewAvatar(null)
                setSelectedFile(null)
              }}
              disabled={avatarUploading}
            >
              Cancelar
            </Button>
            <Button onClick={handleAvatarUpload} disabled={avatarUploading}>
              {avatarUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Upload className="h-4 w-4 mr-2" />
              Subir Foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación para eliminar avatar - NUEVO */}
      <AlertDialog open={showRemoveAvatarDialog} onOpenChange={setShowRemoveAvatarDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar foto de perfil?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará tu foto de perfil actual. Podrás subir una nueva foto en cualquier momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={avatarUploading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveAvatar}
              disabled={avatarUploading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {avatarUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleDashboardLayout>
  )
}