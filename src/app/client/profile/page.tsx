'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import {
  User,
  Mail,
  Phone,
  Building,
  MapPin,
  Calendar,
  Shield,
  Camera,
  Save,
  X,
} from 'lucide-react'

interface UserProfile {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  address?: string
  avatar?: string
  createdAt: string
  role: string
}

export default function ClientProfilePage() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    address: '',
  })

  useEffect(() => {
    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'CLIENT') {
      router.push('/unauthorized')
      return
    }

    loadProfile()
  }, [session, router])

  const loadProfile = async () => {
    try {
      const response = await fetch('/api/profile')
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setFormData({
          name: data.profile.name || '',
          email: data.profile.email || '',
          phone: data.profile.phone || '',
          company: data.profile.company || '',
          address: data.profile.address || '',
        })
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      toast({
        title: 'Error al cargar perfil',
        description: 'No se pudo cargar la información del perfil',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
        setIsEditing(false)
        
        // Actualizar sesión si cambió el nombre
        if (formData.name !== session?.user?.name) {
          await update({ name: formData.name })
        }

        toast({
          title: 'Perfil actualizado',
          description: 'Los cambios se guardaron correctamente',
          variant: 'success',
        })
      } else {
        throw new Error('Error al actualizar perfil')
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      toast({
        title: 'Error al guardar',
        description: 'No se pudieron guardar los cambios',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: profile?.name || '',
      email: profile?.email || '',
      phone: profile?.phone || '',
      company: profile?.company || '',
      address: profile?.address || '',
    })
    setIsEditing(false)
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (isLoading) {
    return (
      <RoleDashboardLayout title="Mi Perfil" subtitle="Gestiona tu información personal">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  return (
    <RoleDashboardLayout
      title="Mi Perfil"
      subtitle="Gestiona tu información personal"
    >
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Avatar Card */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-center">Foto de Perfil</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-4">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile?.avatar} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-3xl">
                  {profile?.name ? getInitials(profile.name) : 'CL'}
                </AvatarFallback>
              </Avatar>
              
              <Button variant="outline" size="sm" disabled>
                <Camera className="h-4 w-4 mr-2" />
                Cambiar Foto
              </Button>

              <div className="w-full pt-4 border-t space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Rol</span>
                  <span className="font-medium text-foreground">Cliente</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Miembro desde</span>
                  <span className="font-medium text-foreground">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('es-ES', {
                          month: 'short',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Information Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información Personal</CardTitle>
                  <CardDescription>
                    {isEditing
                      ? 'Edita tu información personal'
                      : 'Tu información de contacto y detalles'}
                  </CardDescription>
                </div>
                {!isEditing ? (
                  <Button onClick={() => setIsEditing(true)}>
                    <User className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                ) : (
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                      <Save className="h-4 w-4 mr-2" />
                      {isSaving ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center">
                  <User className="h-4 w-4 mr-2 text-muted-foreground" />
                  Nombre Completo
                </Label>
                {isEditing ? (
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Tu nombre completo"
                  />
                ) : (
                  <div className="text-foreground font-medium">
                    {profile?.name || 'No especificado'}
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-muted-foreground" />
                  Correo Electrónico
                </Label>
                <div className="text-foreground font-medium">
                  {profile?.email || 'No especificado'}
                </div>
                <p className="text-xs text-muted-foreground">
                  El correo no se puede cambiar. Contacta a soporte si necesitas actualizarlo.
                </p>
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phone" className="flex items-center">
                  <Phone className="h-4 w-4 mr-2 text-muted-foreground" />
                  Teléfono
                </Label>
                {isEditing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                  />
                ) : (
                  <div className="text-foreground font-medium">
                    {profile?.phone || 'No especificado'}
                  </div>
                )}
              </div>

              {/* Company */}
              <div className="space-y-2">
                <Label htmlFor="company" className="flex items-center">
                  <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                  Empresa
                </Label>
                {isEditing ? (
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) =>
                      setFormData({ ...formData, company: e.target.value })
                    }
                    placeholder="Nombre de tu empresa"
                  />
                ) : (
                  <div className="text-foreground font-medium">
                    {profile?.company || 'No especificado'}
                  </div>
                )}
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  Dirección
                </Label>
                {isEditing ? (
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    placeholder="Tu dirección"
                  />
                ) : (
                  <div className="text-foreground font-medium">
                    {profile?.address || 'No especificado'}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2 text-blue-600" />
              Seguridad
            </CardTitle>
            <CardDescription>
              Gestiona la seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <h3 className="font-medium text-foreground">Contraseña</h3>
                  <p className="text-sm text-muted-foreground">
                    Última actualización hace 30 días
                  </p>
                </div>
                <Button variant="outline">Cambiar Contraseña</Button>
              </div>

              <div className="flex items-center justify-between p-4 border border-border rounded-lg">
                <div>
                  <h3 className="font-medium text-foreground">
                    Autenticación de Dos Factores
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Agrega una capa extra de seguridad
                  </p>
                </div>
                <Button variant="outline" disabled>
                  Habilitar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
