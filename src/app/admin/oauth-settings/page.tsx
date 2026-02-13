'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  Save, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield,
  Key,
  Globe,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OAuthConfig {
  id: string
  provider: string
  clientId: string
  clientSecret: string
  tenantId?: string
  isEnabled: boolean
  redirectUri?: string
  scopes?: string
  updatedAt: string
}

export default function OAuthSettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configs, setConfigs] = useState<OAuthConfig[]>([])
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Estados para Google
  const [googleConfig, setGoogleConfig] = useState({
    clientId: '',
    clientSecret: '',
    isEnabled: false,
    showSecret: false
  })

  // Estados para Microsoft
  const [microsoftConfig, setMicrosoftConfig] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: 'common',
    isEnabled: false,
    showSecret: false
  })

  useEffect(() => {
    if (status === 'loading') return

    if (!session || session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    loadConfigs()
  }, [session, status, router])

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/admin/oauth-config')
      const data = await response.json()

      if (data.success) {
        setConfigs(data.data)

        // Cargar configuración de Google
        const google = data.data.find((c: OAuthConfig) => c.provider === 'google')
        if (google) {
          setGoogleConfig({
            clientId: google.clientId,
            clientSecret: '', // No mostrar el secret completo
            isEnabled: google.isEnabled,
            showSecret: false
          })
        }

        // Cargar configuración de Microsoft
        const microsoft = data.data.find((c: OAuthConfig) => c.provider === 'azure-ad')
        if (microsoft) {
          setMicrosoftConfig({
            clientId: microsoft.clientId,
            clientSecret: '', // No mostrar el secret completo
            tenantId: microsoft.tenantId || 'common',
            isEnabled: microsoft.isEnabled,
            showSecret: false
          })
        }
      }
    } catch (error) {
      console.error('Error loading configs:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const saveGoogleConfig = async () => {
    if (!googleConfig.clientId || !googleConfig.clientSecret) {
      toast({
        title: 'Campos requeridos',
        description: 'Client ID y Client Secret son obligatorios',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'google',
          clientId: googleConfig.clientId,
          clientSecret: googleConfig.clientSecret,
          isEnabled: googleConfig.isEnabled,
          redirectUri: `${window.location.origin}/api/auth/callback/google`,
          scopes: 'openid profile email'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Google OAuth configurado exitosamente'
        })
        loadConfigs()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar la configuración',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving Google config:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const saveMicrosoftConfig = async () => {
    if (!microsoftConfig.clientId || !microsoftConfig.clientSecret) {
      toast({
        title: 'Campos requeridos',
        description: 'Client ID y Client Secret son obligatorios',
        variant: 'destructive'
      })
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/admin/oauth-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'azure-ad',
          clientId: microsoftConfig.clientId,
          clientSecret: microsoftConfig.clientSecret,
          tenantId: microsoftConfig.tenantId,
          isEnabled: microsoftConfig.isEnabled,
          redirectUri: `${window.location.origin}/api/auth/callback/azure-ad`,
          scopes: 'openid profile email User.Read'
        })
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: 'Configuración guardada',
          description: 'Microsoft OAuth configurado exitosamente'
        })
        loadConfigs()
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar la configuración',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error saving Microsoft config:', error)
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
    toast({
      title: 'Copiado',
      description: 'Texto copiado al portapapeles'
    })
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Configuración OAuth' subtitle='Gestión de proveedores de autenticación'>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='h-12 w-12 animate-spin text-blue-600' />
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

  return (
    <RoleDashboardLayout
      title='Configuración OAuth'
      subtitle='Gestiona los proveedores de autenticación externa'
    >
      <div className="space-y-6">
        {/* Información General */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Configura Google y Microsoft OAuth para permitir que los usuarios se registren con sus cuentas.
            Los usuarios registrados mediante OAuth serán creados automáticamente con rol de <strong>CLIENT</strong>.
          </AlertDescription>
        </Alert>

        {/* Google OAuth Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="h-6 w-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>Google OAuth</CardTitle>
                  <CardDescription>Configuración para Gmail y cuentas de Google</CardDescription>
                </div>
              </div>
              <Badge variant={googleConfig.isEnabled ? "default" : "secondary"}>
                {googleConfig.isEnabled ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Redirect URI */}
            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Redirect URI (Copiar a Google Console)</span>
              </Label>
              <div className="flex space-x-2">
                <Input
                  value={`${baseUrl}/api/auth/callback/google`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`${baseUrl}/api/auth/callback/google`, 'google-redirect')}
                >
                  {copiedField === 'google-redirect' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="google-client-id">Client ID *</Label>
              <Input
                id="google-client-id"
                value={googleConfig.clientId}
                onChange={(e) => setGoogleConfig({ ...googleConfig, clientId: e.target.value })}
                placeholder="123456789-abc123.apps.googleusercontent.com"
                className="font-mono text-sm"
              />
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <Label htmlFor="google-client-secret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="google-client-secret"
                  type={googleConfig.showSecret ? 'text' : 'password'}
                  value={googleConfig.clientSecret}
                  onChange={(e) => setGoogleConfig({ ...googleConfig, clientSecret: e.target.value })}
                  placeholder="GOCSPX-..."
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setGoogleConfig({ ...googleConfig, showSecret: !googleConfig.showSecret })}
                >
                  {googleConfig.showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="google-enabled"
                checked={googleConfig.isEnabled}
                onChange={(e) => setGoogleConfig({ ...googleConfig, isEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="google-enabled" className="text-sm font-medium cursor-pointer">
                Habilitar Google OAuth
              </Label>
            </div>

            {/* Save Button */}
            <Button
              onClick={saveGoogleConfig}
              disabled={saving || !googleConfig.clientId || !googleConfig.clientSecret}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración de Google
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Microsoft OAuth Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="h-6 w-6" viewBox="0 0 23 23">
                    <path fill="#f3f3f3" d="M0 0h23v23H0z"/>
                    <path fill="#f35325" d="M1 1h10v10H1z"/>
                    <path fill="#81bc06" d="M12 1h10v10H12z"/>
                    <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                    <path fill="#ffba08" d="M12 12h10v10H12z"/>
                  </svg>
                </div>
                <div>
                  <CardTitle>Microsoft OAuth</CardTitle>
                  <CardDescription>Configuración para Outlook, Hotmail y cuentas Microsoft</CardDescription>
                </div>
              </div>
              <Badge variant={microsoftConfig.isEnabled ? "default" : "secondary"}>
                {microsoftConfig.isEnabled ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Redirect URI */}
            <div className="space-y-2">
              <Label className="flex items-center space-x-2">
                <Globe className="h-4 w-4" />
                <span>Redirect URI (Copiar a Azure Portal)</span>
              </Label>
              <div className="flex space-x-2">
                <Input
                  value={`${baseUrl}/api/auth/callback/azure-ad`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`${baseUrl}/api/auth/callback/azure-ad`, 'microsoft-redirect')}
                >
                  {copiedField === 'microsoft-redirect' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Client ID */}
            <div className="space-y-2">
              <Label htmlFor="microsoft-client-id">Application (Client) ID *</Label>
              <Input
                id="microsoft-client-id"
                value={microsoftConfig.clientId}
                onChange={(e) => setMicrosoftConfig({ ...microsoftConfig, clientId: e.target.value })}
                placeholder="12345678-1234-1234-1234-123456789012"
                className="font-mono text-sm"
              />
            </div>

            {/* Client Secret */}
            <div className="space-y-2">
              <Label htmlFor="microsoft-client-secret">Client Secret *</Label>
              <div className="relative">
                <Input
                  id="microsoft-client-secret"
                  type={microsoftConfig.showSecret ? 'text' : 'password'}
                  value={microsoftConfig.clientSecret}
                  onChange={(e) => setMicrosoftConfig({ ...microsoftConfig, clientSecret: e.target.value })}
                  placeholder="..."
                  className="font-mono text-sm pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setMicrosoftConfig({ ...microsoftConfig, showSecret: !microsoftConfig.showSecret })}
                >
                  {microsoftConfig.showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Tenant ID */}
            <div className="space-y-2">
              <Label htmlFor="microsoft-tenant-id">Tenant ID</Label>
              <Input
                id="microsoft-tenant-id"
                value={microsoftConfig.tenantId}
                onChange={(e) => setMicrosoftConfig({ ...microsoftConfig, tenantId: e.target.value })}
                placeholder="common"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Usa "common" para cuentas personales y organizacionales, "consumers" solo para personales
              </p>
            </div>

            {/* Enable/Disable */}
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="microsoft-enabled"
                checked={microsoftConfig.isEnabled}
                onChange={(e) => setMicrosoftConfig({ ...microsoftConfig, isEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="microsoft-enabled" className="text-sm font-medium cursor-pointer">
                Habilitar Microsoft OAuth
              </Label>
            </div>

            {/* Save Button */}
            <Button
              onClick={saveMicrosoftConfig}
              disabled={saving || !microsoftConfig.clientId || !microsoftConfig.clientSecret}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Guardar Configuración de Microsoft
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-900 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>¿Necesitas ayuda?</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 space-y-2">
            <p><strong>Google:</strong> Crea credenciales en <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></p>
            <p><strong>Microsoft:</strong> Registra tu app en <a href="https://portal.azure.com/" target="_blank" rel="noopener noreferrer" className="underline">Azure Portal</a></p>
            <p className="mt-4">Consulta la documentación completa en <code className="bg-blue-100 px-2 py-1 rounded">OAUTH_SETUP_GUIDE.md</code></p>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}
