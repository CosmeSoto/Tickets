'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  Shield,
  Globe,
  Camera,
  Link,
  Unlink,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

interface EnhancedProfileFormProps {
  user: {
    id: string
    email: string
    name: string
    firstName?: string
    lastName?: string
    displayName?: string
    phone?: string
    alternativePhone?: string
    address?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
    jobTitle?: string
    employeeId?: string
    hireDate?: string
    workLocation?: string
    dateOfBirth?: string
    gender?: string
    nationality?: string
    avatar?: string
    oauthProvider?: string
    oauthPicture?: string
    oauthVerified?: boolean
    registrationSource?: string
    timezone?: string
    language?: string
    theme?: string
    role: string
    department?: {
      id: string
      name: string
      color: string
    }
    isActive: boolean
    lastLoginAt?: string
    createdAt: string
  }
  onSave: (data: any) => Promise<void>
  onAvatarChange: () => void
  isCurrentUser?: boolean
  canEdit?: boolean
}

const genderOptions = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'OTHER', label: 'Otro' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefiero no decir' }
]

const registrationSourceLabels = {
  MANUAL: 'Creado manualmente',
  SELF_REGISTER: 'Autoregistro',
  GOOGLE_OAUTH: 'Registro con Google',
  MICROSOFT_OAUTH: 'Registro con Microsoft',
  BULK_IMPORT: 'Importación masiva',
  API: 'Creado via API'
}

const registrationSourceColors = {
  MANUAL: 'bg-blue-100 text-blue-800',
  SELF_REGISTER: 'bg-green-100 text-green-800',
  GOOGLE_OAUTH: 'bg-red-100 text-red-800',
  MICROSOFT_OAUTH: 'bg-orange-100 text-orange-800',
  BULK_IMPORT: 'bg-purple-100 text-purple-800',
  API: 'bg-gray-100 text-gray-800'
}

export function EnhancedProfileForm({
  user,
  onSave,
  onAvatarChange,
  isCurrentUser = false,
  canEdit = true
}: EnhancedProfileFormProps) {
  const [formData, setFormData] = useState({
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    displayName: user.displayName || user.name,
    email: user.email,
    phone: user.phone || '',
    alternativePhone: user.alternativePhone || '',
    address: user.address || '',
    city: user.city || '',
    state: user.state || '',
    country: user.country || 'México',
    postalCode: user.postalCode || '',
    jobTitle: user.jobTitle || '',
    employeeId: user.employeeId || '',
    workLocation: user.workLocation || '',
    dateOfBirth: user.dateOfBirth || '',
    gender: user.gender || '',
    nationality: user.nationality || 'Ecuatoriana',
    timezone: user.timezone || 'America/Guayaquil',
    language: user.language || 'es',
    theme: user.theme || 'system'
  })

  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('personal')

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No registrado'
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="space-y-6">
      {/* Header con avatar y información básica */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start space-x-6">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-white shadow-lg">
                <AvatarImage 
                  src={user.oauthPicture || user.avatar || ''} 
                  alt={user.displayName || user.name} 
                />
                <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                  {(user.firstName?.[0] || user.name[0]) + (user.lastName?.[0] || user.name.split(' ')[1]?.[0] || '')}
                </AvatarFallback>
              </Avatar>
              {canEdit && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-full bg-black/60 hover:bg-black/80 text-white border-0"
                  onClick={onAvatarChange}
                >
                  <Camera className="h-5 w-5" />
                </Button>
              )}
            </div>
            
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {user.displayName || user.name}
                </h2>
                <p className="text-muted-foreground">{user.email}</p>
                {user.jobTitle && (
                  <p className="text-sm text-muted-foreground flex items-center mt-1">
                    <Briefcase className="h-4 w-4 mr-1" />
                    {user.jobTitle}
                  </p>
                )}
              </div>
              
              <div className="flex items-center space-x-2 flex-wrap gap-2">
                <Badge className={`text-xs ${
                  user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                  user.role === 'TECHNICIAN' ? 'bg-green-100 text-green-800' :
                  'bg-blue-100 text-blue-800'
                }`}>
                  <Shield className="h-3 w-3 mr-1" />
                  {user.role === 'ADMIN' ? 'Administrador' : 
                   user.role === 'TECHNICIAN' ? 'Técnico' : 'Cliente'}
                </Badge>
                
                {user.registrationSource && (
                  <Badge className={`text-xs ${registrationSourceColors[user.registrationSource as keyof typeof registrationSourceColors] || 'bg-gray-100 text-gray-800'}`}>
                    {registrationSourceLabels[user.registrationSource as keyof typeof registrationSourceLabels] || user.registrationSource}
                  </Badge>
                )}
                
                <Badge variant={user.isActive ? "default" : "secondary"} className="text-xs">
                  {user.isActive ? 'Activo' : 'Inactivo'}
                </Badge>
                
                {isCurrentUser && (
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Tu cuenta
                  </Badge>
                )}
              </div>
              
              {user.oauthProvider && (
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Link className="h-4 w-4" />
                    <span>Vinculado con {user.oauthProvider === 'google' ? 'Google' : 'Microsoft'}</span>
                    {user.oauthVerified && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Restricciones para usuario actual */}
      {isCurrentUser && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">Restricciones de tu cuenta</h3>
                <ul className="text-sm text-blue-700 mt-1 space-y-1">
                  <li>• No puedes desactivar tu propia cuenta</li>
                  <li>• No puedes eliminar tu propio usuario</li>
                  <li>• Algunos cambios requieren confirmación adicional</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulario con pestañas */}
      <Card>
        <CardHeader>
          <CardTitle>Información del Usuario</CardTitle>
          <CardDescription>
            Gestiona la información personal y laboral del usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="contact">Contacto</TabsTrigger>
              <TabsTrigger value="work">Laboral</TabsTrigger>
              <TabsTrigger value="system">Sistema</TabsTrigger>
            </TabsList>
            
            {/* Información Personal */}
            <TabsContent value="personal" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Nombre(s) *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Nombre(s)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Apellido(s) *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Apellido(s)"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="displayName">Nombre para mostrar</Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Cómo quieres que aparezca tu nombre"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Fecha de Nacimiento</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select 
                    value={formData.gender} 
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar género" />
                    </SelectTrigger>
                    <SelectContent>
                      {genderOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="nationality">Nacionalidad</Label>
                <Input
                  id="nationality"
                  value={formData.nationality}
                  onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Nacionalidad"
                />
              </div>
            </TabsContent>
            
            {/* Información de Contacto */}
            <TabsContent value="contact" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={!canEdit}
                  placeholder="email@empresa.com"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono Principal</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!canEdit}
                    placeholder="+52 55 1234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alternativePhone">Teléfono Alternativo</Label>
                  <Input
                    id="alternativePhone"
                    value={formData.alternativePhone}
                    onChange={(e) => setFormData({ ...formData, alternativePhone: e.target.value })}
                    disabled={!canEdit}
                    placeholder="+52 55 8765 4321"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Dirección completa"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Ciudad"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado/Provincia</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Estado"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">Código Postal</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    disabled={!canEdit}
                    placeholder="12345"
                  />
                </div>
              </div>
            </TabsContent>
            
            {/* Información Laboral */}
            <TabsContent value="work" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jobTitle">Cargo/Puesto</Label>
                  <Input
                    id="jobTitle"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    disabled={!canEdit}
                    placeholder="Desarrollador Senior"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employeeId">ID de Empleado</Label>
                  <Input
                    id="employeeId"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    disabled={!canEdit}
                    placeholder="EMP001"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="workLocation">Ubicación de Trabajo</Label>
                <Input
                  id="workLocation"
                  value={formData.workLocation}
                  onChange={(e) => setFormData({ ...formData, workLocation: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Oficina Central, Remoto, etc."
                />
              </div>
              
              {user.department && (
                <div className="space-y-2">
                  <Label>Departamento</Label>
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full" 
                      style={{ backgroundColor: user.department.color }}
                    />
                    <span className="text-sm font-medium">{user.department.name}</span>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Configuración del Sistema */}
            <TabsContent value="system" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Horaria</Label>
                  <Select 
                    value={formData.timezone} 
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Guayaquil">Guayaquil, Ecuador (GMT-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language">Idioma</Label>
                  <Select 
                    value={formData.language} 
                    onValueChange={(value) => setFormData({ ...formData, language: value })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="theme">Tema</Label>
                <Select 
                  value={formData.theme} 
                  onValueChange={(value) => setFormData({ ...formData, theme: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Sistema</SelectItem>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="dark">Oscuro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Información de auditoría */}
              <div className="pt-4 border-t space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Información de Auditoría</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Registrado:</span>
                    <div className="font-medium">{formatDate(user.createdAt)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último acceso:</span>
                    <div className="font-medium">{formatDate(user.lastLoginAt)}</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
          
          {canEdit && (
            <div className="flex justify-end space-x-2 pt-6 border-t">
              <Button variant="outline" disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}