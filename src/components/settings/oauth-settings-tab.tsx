'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Shield, Key, Info } from 'lucide-react'
import { OAuthCredentialsFields } from '@/components/settings/oauth-credentials-fields'

const MicrosoftIcon = () => (
  <svg className='h-6 w-6' viewBox='0 0 23 23'>
    <path fill='#f3f3f3' d='M0 0h23v23H0z' />
    <path fill='#f35325' d='M1 1h10v10H1z' />
    <path fill='#81bc06' d='M12 1h10v10H12z' />
    <path fill='#05a6f0' d='M1 12h10v10H1z' />
    <path fill='#ffba08' d='M12 12h10v10H12z' />
  </svg>
)

const GoogleIcon = () => (
  <svg className='h-6 w-6' viewBox='0 0 24 24'>
    <path
      fill='#4285F4'
      d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
    />
    <path
      fill='#34A853'
      d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
    />
    <path
      fill='#FBBC05'
      d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'
    />
    <path
      fill='#EA4335'
      d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'
    />
  </svg>
)

function ProviderStatusBadge({ isEnabled }: { isEnabled: boolean }) {
  return (
    <Badge variant={isEnabled ? 'default' : 'secondary'}>{isEnabled ? 'Activo' : 'Inactivo'}</Badge>
  )
}

export function OAuthSettingsTab() {
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false)
  const [plannerEnabled, setPlannerEnabled] = useState(false)
  const [sharePointEnabled, setSharePointEnabled] = useState(false)

  return (
    <div className='space-y-6'>
      {/* Información General */}
      <Alert>
        <Shield className='h-4 w-4' />
        <AlertDescription>
          Todas las credenciales de aplicación (Google y Microsoft) del sistema se configuran acá,
          en un solo lugar — incluidas las que usan las Tareas/Planner y el almacenamiento en
          SharePoint. Google y Microsoft (login) permiten además que los usuarios se registren con
          sus cuentas; los registrados así se crean automáticamente con rol <strong>CLIENT</strong>.
        </AlertDescription>
      </Alert>

      {(() => {
        const origin = typeof window !== 'undefined' ? window.location.origin : ''
        const isLocal =
          origin.includes('localhost') ||
          origin.includes('127.0.0.1') ||
          /192\.168\.\d+\.\d+/.test(origin) ||
          /10\.\d+\.\d+\.\d+/.test(origin)
        if (!isLocal) return null
        return (
          <Alert className='border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'>
            <AlertDescription className='text-amber-900 dark:text-amber-200 text-sm space-y-1'>
              <p className='font-medium'>Red local — registra la Redirect URI exacta</p>
              <p>
                En Google Cloud Console y Azure Portal agrega la Redirect URI que muestra cada
                tarjeta abajo. Google exige HTTPS; con certificado autofirmado puede pedir aceptar
                la excepción en el navegador antes del login OAuth.
              </p>
            </AlertDescription>
          </Alert>
        )
      })()}

      {/* Google OAuth */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <GoogleIcon />
              </div>
              <div>
                <CardTitle>Google OAuth</CardTitle>
                <CardDescription>Configuración para Gmail y cuentas de Google</CardDescription>
              </div>
            </div>
            <ProviderStatusBadge isEnabled={googleEnabled} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <OAuthCredentialsFields
            provider='google'
            clientIdPlaceholder='123456789-abc123.apps.googleusercontent.com'
            clientSecretPlaceholder='GOCSPX-...'
            showTenantId={false}
            redirectUriPath='/api/auth/callback/google'
            scopes='openid profile email'
            enabledLabel='Habilitar Google OAuth'
            enabledDescription='Permite a los usuarios registrarse e iniciar sesión con Google'
            saveLabel='Guardar Configuración de Google'
            onStateChange={s => setGoogleEnabled(s.isEnabled)}
          />
        </CardContent>
      </Card>

      {/* Microsoft OAuth (login) */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <MicrosoftIcon />
              </div>
              <div>
                <CardTitle>Microsoft OAuth</CardTitle>
                <CardDescription>
                  Configuración para Outlook, Hotmail y cuentas Microsoft
                </CardDescription>
              </div>
            </div>
            <ProviderStatusBadge isEnabled={microsoftEnabled} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <OAuthCredentialsFields
            provider='azure-ad'
            clientIdLabel='Application (Client) ID *'
            clientIdPlaceholder='12345678-1234-1234-1234-123456789012'
            showTenantId
            tenantPlaceholder='common'
            tenantHint={
              <p className='text-xs text-muted-foreground'>
                Usa &quot;common&quot; para cuentas personales y organizacionales,
                &quot;consumers&quot; solo para personales
              </p>
            }
            redirectUriPath='/api/auth/callback/azure-ad'
            scopes='openid profile email User.Read'
            enabledLabel='Habilitar Microsoft OAuth'
            enabledDescription='Permite a los usuarios registrarse e iniciar sesión con Microsoft'
            saveLabel='Guardar Configuración de Microsoft'
            onStateChange={s => setMicrosoftEnabled(s.isEnabled)}
          />
        </CardContent>
      </Card>

      {/* Microsoft (Planner) */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <MicrosoftIcon />
              </div>
              <div>
                <CardTitle>Microsoft (Planner)</CardTitle>
                <CardDescription>
                  Registro de aplicación en Entra ID con permisos delegados de Planner
                  (Tasks.ReadWrite, Group.Read.All). Puede ser el mismo registro que ya usa el login
                  de Microsoft, solo con estos permisos agregados.
                </CardDescription>
              </div>
            </div>
            <ProviderStatusBadge isEnabled={plannerEnabled} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <OAuthCredentialsFields
            provider='azure-ad-planner'
            clientIdPlaceholder='00000000-0000-0000-0000-000000000000'
            showTenantId
            tenantPlaceholder='common'
            redirectUriPath='/api/admin/planner/cloud-auth/callback'
            scopes='https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All offline_access'
            enabledLabel='Habilitar credenciales de Planner'
            enabledDescription='Debe estar activo para poder conectar la cuenta dedicada en Configuración de Tareas.'
            onStateChange={s => setPlannerEnabled(s.isEnabled)}
          />
        </CardContent>
      </Card>

      {/* Microsoft (SharePoint) */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div className='flex items-center space-x-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <MicrosoftIcon />
              </div>
              <div>
                <CardTitle>Microsoft (SharePoint)</CardTitle>
                <CardDescription>
                  Credenciales de aplicación (client_credentials) para usar SharePoint como destino
                  de adjuntos en Ajustes → Almacenamiento.
                </CardDescription>
              </div>
            </div>
            <ProviderStatusBadge isEnabled={sharePointEnabled} />
          </div>
        </CardHeader>
        <CardContent className='space-y-4'>
          <Alert>
            <Info className='h-4 w-4' />
            <AlertDescription className='text-sm space-y-1'>
              <p>
                SharePoint usa credenciales de <strong>aplicación</strong>, no un usuario que
                autoriza: no hay ventana emergente de consentimiento.
              </p>
              <p>
                Después de guardar, un administrador de Microsoft 365 debe otorgarle a esta app el
                permiso <code className='font-mono'>Sites.Selected</code> sobre el sitio específico
                — un paso aparte que se hace con PowerShell o Graph Explorer, fuera de esta app. Sin
                ese paso, conectar el sitio en Ajustes → Almacenamiento fallará con error 403.
              </p>
            </AlertDescription>
          </Alert>
          <OAuthCredentialsFields
            provider='azure-ad-sharepoint'
            clientIdLabel='Application (Client) ID *'
            clientIdPlaceholder='12345678-1234-1234-1234-123456789012'
            showTenantId
            tenantRequired
            tenantPlaceholder='ID del directorio (tenant) — no uses "common" aquí'
            enabledLabel='Habilitar estas credenciales'
            enabledDescription='Debe estar activo para poder conectar un sitio en Ajustes → Almacenamiento.'
            onStateChange={s => setSharePointEnabled(s.isEnabled)}
          />
        </CardContent>
      </Card>

      {/* Help Section */}
      <Card className='bg-muted border-border'>
        <CardHeader>
          <CardTitle className='text-foreground flex items-center space-x-2'>
            <Key className='h-5 w-5' />
            <span>¿Necesitas ayuda?</span>
          </CardTitle>
        </CardHeader>
        <CardContent className='text-sm text-muted-foreground space-y-2'>
          <p>
            <strong>Google:</strong> Crea credenciales en{' '}
            <a
              href='https://console.cloud.google.com/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              Google Cloud Console
            </a>
          </p>
          <p>
            <strong>Microsoft:</strong> Registra tu app en{' '}
            <a
              href='https://portal.azure.com/'
              target='_blank'
              rel='noopener noreferrer'
              className='underline'
            >
              Azure Portal
            </a>
          </p>
          <p className='mt-4'>
            Consulta la documentación completa en{' '}
            <code className='bg-muted px-2 py-1 rounded'>OAUTH_SETUP_GUIDE.md</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
