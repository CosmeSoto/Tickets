'use client'

import { useState } from 'react'
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
  Upload,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { 
  USER_ROLE_FORM_OPTIONS,
  type UserRole
} from '@/lib/constants/user-constants'

interface CreateUserModalProps {
  isOpen: boolean
  onClose: () => void
  onUserCreated: () => void
  departments: Array<{ id: string; name: string; color: string }>
}

interface NewUserData {
  name: string
  email: string
  password: string
  role: UserRole
  departmentId: string
  phone: string
  avatar?: File
}

export function CreateUserModal({ isOpen, onClose, onUserCreated, departments }: CreateUserModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [activeTab, setActiveTab] = useState('basic')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<NewUserData>({
    name: '',
    email: '',
    password: '',
    role: 'CLIENT',
    departmentId: '',
    phone: '',
    avatar: undefined
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleClose = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'CLIENT',
      departmentId: '',
      phone: '',
      avatar: undefined
    })
    setErrors({})
    setAvatarPreview(null)
    setActiveTab('basic')
    onClose()
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

    if (!formData.password.trim()) {
      newErrors.password = 'La contraseña es requerida'
    } else if (formData.password.length < 6) {
      newErrors.password = 'La contraseña debe tener al menos 6 caracteres'
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
    if (!validateForm()) {
      toast({
        title: 'Datos inválidos',
        description: 'Por favor corrige los errores en el formulario',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      // Crear usuario primero
      const userData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: formData.role,
        departmentId: formData.departmentId || null,
        phone: formData.phone.trim() || null,
        isActive: true
      }

      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        // Si hay avatar, subirlo después de crear el usuario
        if (formData.avatar && result.user?.id) {
          const avatarFormData = new FormData()
          avatarFormData.append('avatar', formData.avatar)

          await fetch(`/api/users/${result.user.id}/avatar`, {
            method: 'POST',
            body: avatarFormData
          })
        }
        
        toast({
          title: 'Usuario creado exitosamente',
          description: `${formData.name} ha sido registrado como ${USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)?.label}`,
        })
        
        handleClose()
        onUserCreated()
      } else {
        toast({
          title: 'Error al crear usuario',
          description: result.error || 'No se pudo crear el usuario',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error creating user:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const selectedRole = USER_ROLE_FORM_OPTIONS.find(r => r.value === formData.role)
  const selectedDepartment = departments.find(d => d.id === formData.departmentId)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Crear Nuevo Usuario</span>
          </DialogTitle>
          <DialogDescription>
            Completa la información para crear una nueva cuenta de usuario en el sistema
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Información Básica</TabsTrigger>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="preview">Vista Previa</TabsTrigger>
          </TabsList>

          {/* Información Básica */}
          <TabsContent value="basic" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
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
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
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

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-600 flex items-center">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {errors.password}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role">Rol del Usuario *</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => {
                    const newRole = e.target.value as any
                    setFormData({ ...formData, role: newRole })
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
                <Label htmlFor="department">
                  Departamento {formData.role !== 'ADMIN' ? '*' : ''}
                </Label>
                <select
                  id="department"
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

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
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
                  Sube una imagen de perfil para el usuario (opcional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <Avatar className="h-20 w-20 border-4 border-white shadow-lg">
                      <AvatarImage src={avatarPreview || undefined} alt="Preview" />
                      <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {formData.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    {/* Botón para cambiar foto */}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full p-0 shadow-sm"
                      title="Seleccionar foto"
                      onClick={() => document.getElementById('avatar')?.click()}
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                    {/* Botón para limpiar foto - Solo visible si hay foto seleccionada */}
                    {(formData.avatar || avatarPreview) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 shadow-sm bg-white hover:bg-red-50 border-red-200 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Limpiar foto"
                        onClick={() => {
                          setFormData({ ...formData, avatar: undefined })
                          setAvatarPreview(null)
                        }}
                      >
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="avatar">Seleccionar Imagen</Label>
                      <Input
                        id="avatar"
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarChange}
                        className="hidden"
                      />
                      <p className="text-xs text-muted-foreground">
                        Haz clic en el icono de cámara para seleccionar una foto. Formatos: JPG, PNG, GIF (máx. 5MB)
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vista Previa */}
          <TabsContent value="preview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="h-5 w-5" />
                  <span>Vista Previa del Usuario</span>
                </CardTitle>
                <CardDescription>
                  Revisa la información antes de crear el usuario
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-start space-x-6">
                  <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
                    <AvatarImage src={avatarPreview || undefined} alt={formData.name} />
                    <AvatarFallback className="text-lg font-semibold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {formData.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{formData.name || 'Nombre del usuario'}</h3>
                      <p className="text-muted-foreground flex items-center">
                        <Mail className="h-4 w-4 mr-1" />
                        {formData.email || 'email@empresa.com'}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-2 flex-wrap gap-2">
                      {selectedRole && (
                        <Badge className={selectedRole.color}>
                          <selectedRole.icon className="h-3 w-3 mr-1" />
                          {selectedRole.label}
                        </Badge>
                      )}
                      
                      {selectedDepartment && (
                        <Badge variant="outline" style={{ 
                          borderColor: selectedDepartment.color,
                          color: selectedDepartment.color 
                        }}>
                          <Building className="h-3 w-3 mr-1" />
                          {selectedDepartment.name}
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
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <div className="flex space-x-2">
            {activeTab !== 'basic' && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  const tabs = ['basic', 'profile', 'preview']
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
                  const tabs = ['basic', 'profile', 'preview']
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
                disabled={loading || !formData.name || !formData.email || !formData.password}
              >
                {loading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-spin" />
                    Creando Usuario...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Crear Usuario
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