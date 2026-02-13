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
  Calendar,
  Save,
  Edit,
  Camera,
  Upload,
  Loader2,
  Trash2
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

    // Cargar datos del usuario
    setFormData({
      name: session.user.name || '',
      email: session.user.email || '',
      phone: session.user.phone || '',
    })
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
    switch (session?.user?.role) {
      case 'ADMIN':
        return 'bg-blue-100 text-blue-800'
      case 'TECHNICIAN':
        return 'bg-green-100 text-green-800'
      case 'CLIENT':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getRoleLabel = () => {
    switch (session?.user?.role) {
      case 'ADMIN':
        return 'Administrador'
      case 'TECHNICIAN':
        return 'Técnico'
      case 'CLIENT':
        return 'Cliente'
      default:
        return 'Usuario'
    }
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
        // Actualizar la sesión con el nuevo avatar
        await update({
          ...session,
          user: {
            ...session.user,
            avatar: result.data.avatarUrl
          }
        })
        
        // Cerrar modal y limpiar estado
        setShowAvatarDialog(false)
        setSelectedFile(null)
        setPreviewAvatar(null)
        
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
        // Actualizar la sesión sin avatar
        await update({
          ...session,
          user: {
            ...session.user,
            avatar: null
          }
        })
        
        setShowRemoveAvatarDialog(false)
        
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
        // Actualizar la sesión
        await update({
          ...session,
          user: {
            ...session?.user,
            name: formData.name,
            phone: formData.phone,
          }
        })

        toast({
          title: 'Perfil actualizado',
          description: 'Tu información ha sido guardada exitosamente',
        })
        setEditing(false)
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
            <div className="flex items-center space-x-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={session.user.avatar || ''} />
                  <AvatarFallback className="text-lg">
                    <RoleIcon className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="sm"
                  variant="outline"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0"
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              <div className="space-y-2">
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
                {session.user.avatar && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowRemoveAvatarDialog(true)}
                    disabled={avatarUploading}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar foto
                  </Button>
                )}
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
      </div>

      {/* Modal de confirmación de avatar - NUEVO */}
      <Dialog open={showAvatarDialog} onOpenChange={setShowAvatarDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar nueva foto de perfil</DialogTitle>
            <DialogDescription>
              ¿Te gusta cómo se ve tu nueva foto de perfil?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={previewAvatar || ''} alt="Preview" />
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