'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Shield, Key, Info, Cloud } from 'lucide-react'
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

export function OAuthSettingsTab({
  onGoToStorageTab,
}: {
  /** Cambia a la pestaña Almacenamiento dentro de la misma página de Ajustes. */
  onGoToStorageTab?: () => void
}) {
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false)
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

      <Alert className='border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800'>
        <AlertDescription className='text-amber-900 dark:text-amber-200 text-sm space-y-1'>
          <p className='font-medium'>Si cambias de dominio/IP más adelante</p>
          <p>
            Cada Redirect URI que ves abajo se calcula a partir de la URL con la que accedes ahora
            mismo — pero el servidor usa la variable <code className='font-mono'>NEXTAUTH_URL</code>{' '}
            para negociar de verdad con Google/Microsoft. Si algún día cambias de IP o pasas a un
            dominio propio, actualiza <code className='font-mono'>NEXTAUTH_URL</code> en el servidor
            y reconstruye el contenedor primero; luego vuelve a entrar a esta pantalla ya desde el
            dominio nuevo y registra en Google Cloud Console / Azure Portal las URIs que te muestre
            en ese momento (las viejas puedes dejarlas o quitarlas después).
          </p>
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

      {/* Microsoft OAuth — una sola credencial para todos los flujos delegados */}
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
                  Un solo registro de aplicación en Entra ID cubre <strong>todo</strong> lo que este
                  sistema usa de Microsoft con permisos delegados (el usuario autoriza vía
                  popup/redirect): iniciar sesión con Microsoft, adjuntos y backups en OneDrive (si
                  se activan en Ajustes → Almacenamiento / Backups), la cuenta de servicio de
                  Planner y que cada usuario conecte su Microsoft To Do personal desde su perfil. Se
                  configura <strong>una sola vez, acá</strong> — las demás pantallas solo muestran
                  si está lista y un enlace de vuelta a esta tarjeta, nunca un formulario aparte.
                  Cada flujo tiene su propio Redirect URI fijo; abajo están los dos que siempre
                  hacen falta (login y Planner/To Do); si además activas adjuntos o backups por
                  OneDrive, esas pantallas te muestran su Redirect URI adicional.
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
            redirectUriPath={['/api/auth/callback/azure-ad', '/api/planner/oauth-callback']}
            scopes='openid profile email User.Read Tasks.ReadWrite Group.Read.All offline_access'
            enabledLabel='Habilitar Microsoft OAuth'
            enabledDescription='Habilita el login con Microsoft y, con el mismo interruptor, la cuenta de Planner y el Microsoft To Do personal de cada usuario.'
            saveLabel='Guardar Configuración de Microsoft'
            onStateChange={s => setMicrosoftEnabled(s.isEnabled)}
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
                  de adjuntos en Ajustes → Almacenamiento. Puede ser la misma app de Microsoft OAuth
                  de arriba (marca la casilla abajo) o una app dedicada.
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
                <code className='font-mono'>Sites.Selected</code> se otorga en{' '}
                <strong>dos pasos separados</strong>, en este orden — falta cualquiera de los dos y
                falla con error 403:
              </p>
              <p>
                <strong>1)</strong> En Azure Portal → la app que uses acá abajo (la misma de
                Microsoft OAuth si activas &quot;Usar la misma app&quot;, o una dedicada si no) →
                API permissions, agregar <code className='font-mono'>Sites.Selected</code> como
                permiso de <strong>aplicación</strong> (Application permission) de Microsoft Graph,
                y un administrador debe presionar <strong>&quot;Grant admin consent&quot;</strong>{' '}
                para el tenant. Sin este consentimiento a nivel de la app, el paso 2 no tiene ningún
                efecto aunque parezca completarse sin error.
              </p>
              <p>
                <strong>2)</strong> Ya con eso hecho, otorgarle a esa app acceso al sitio específico
                con rol <code className='font-mono'>write</code> (no solo{' '}
                <code className='font-mono'>read</code>) — un paso aparte con PowerShell (PnP) o
                Graph Explorer, fuera de esta pantalla. Con solo lectura, conectar el sitio abajo va
                a funcionar (son llamadas de consulta) pero subir un archivo real va a fallar
                después con otro 403 — más difícil de relacionar con el permiso si no se sabe de
                antemano.
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
            tenantHint={
              <p className='text-xs text-muted-foreground'>
                SharePoint no admite &quot;common&quot; — poné el GUID real del directorio de esta
                app dedicada.
              </p>
            }
            enabledLabel='Habilitar estas credenciales'
            enabledDescription='Debe estar activo para poder conectar un sitio en Ajustes → Almacenamiento.'
            reuseToggle={{
              checkboxLabel: 'Usar la misma app que Microsoft OAuth',
              sourceProvider: 'azure-ad',
              sourceLabel: 'Microsoft OAuth',
            }}
            onStateChange={s => setSharePointEnabled(s.isEnabled)}
          />
        </CardContent>
      </Card>

      {/* Enlace al módulo de almacenamiento — mismo patrón que Seguridad → Backups */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center'>
            <Cloud className='h-5 w-5 mr-2' />
            Almacenamiento en la nube
          </CardTitle>
          <CardDescription>
            Con las credenciales de arriba ya configuradas, conecta Google Drive, OneDrive o
            SharePoint como destino de los adjuntos en Ajustes → Almacenamiento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 bg-muted border border-border rounded-lg'>
            <div className='min-w-0'>
              <h4 className='font-medium text-foreground'>Destino de adjuntos</h4>
              <p className='text-sm text-muted-foreground mt-1'>
                Elige el proveedor activo, autoriza el acceso y revisa quién conectó su Drive
                personal.
              </p>
            </div>
            <Button className='w-full sm:w-auto flex-shrink-0' onClick={() => onGoToStorageTab?.()}>
              <Cloud className='h-4 w-4 mr-2' />
              Ir a Almacenamiento
            </Button>
          </div>
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
