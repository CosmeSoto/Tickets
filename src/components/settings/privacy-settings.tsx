'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Shield,
  Save,
  AlertTriangle
} from 'lucide-react'

interface UserSettings {
  privacy: {
    profileVisible: boolean
    activityVisible: boolean
  }
}

interface PrivacySettingsProps {
  settings: UserSettings
  onUpdateSetting: (key: keyof UserSettings['privacy'], value: boolean) => void
  onSave: () => void
  loading: boolean
  isAdmin: boolean
  userRole: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

export function PrivacySettings({ settings, onUpdateSetting, onSave, loading, isAdmin, userRole }: PrivacySettingsProps) {
  // Solo los CLIENTES pueden desactivar su propia cuenta
  // ADMIN y TECHNICIAN NO deben tener esta opción
  const canDeactivateOwnAccount = userRole === 'CLIENT'
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Privacidad</span>
          </CardTitle>
          <CardDescription>
            Controla la visibilidad de tu información
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Perfil visible</Label>
                <p className="text-sm text-muted-foreground">
                  Permite que otros usuarios vean tu perfil básico
                </p>
              </div>
              <Switch
                checked={settings.privacy.profileVisible}
                onCheckedChange={(value) => onUpdateSetting('profileVisible', value)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">Actividad visible</Label>
                <p className="text-sm text-muted-foreground">
                  Muestra tu última actividad a otros usuarios
                </p>
              </div>
              <Switch
                checked={settings.privacy.activityVisible}
                onCheckedChange={(value) => onUpdateSetting('activityVisible', value)}
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={onSave} disabled={loading} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Guardando...' : 'Guardar Privacidad'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Zona de Peligro - Solo para CLIENTES */}
      {canDeactivateOwnAccount && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Zona de Peligro</span>
            </CardTitle>
            <CardDescription>
              Acciones irreversibles que afectan tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border border-red-200 rounded-lg bg-red-50">
                <h4 className="font-medium text-red-800 mb-2">Desactivar cuenta</h4>
                <p className="text-sm text-red-700 mb-3">
                  Tu cuenta será desactivada y no podrás acceder al sistema. 
                  Un administrador puede reactivarla posteriormente.
                </p>
                <Button variant="destructive" size="sm">
                  Desactivar mi cuenta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}