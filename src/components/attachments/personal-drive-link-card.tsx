'use client'

/**
 * PersonalDriveLinkCard — vinculación del Drive PERSONAL del usuario para sus
 * adjuntos (tickets, documentos, equipos, licencias, contratos, noticias,
 * procesos — incluida evidencia de cámara). Mismo lugar y patrón que
 * MsTodoLinkCard/TelegramLinkCard: cada usuario conecta la suya desde su
 * propio perfil, no algo que un admin configure por él.
 *
 * A diferencia de esas dos, esta función además la puede apagar un admin
 * globalmente (Ajustes → Almacenamiento → Drive personal) — por eso el
 * estado trae `enabled` aparte de `connected`: alguien pudo conectarse antes
 * de que se apagara, y esta tarjeta se lo explica en vez de desaparecer sin
 * más (dejaría "colgada" su cuenta sin forma de desconectarla desde acá).
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, HardDrive, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { useToast } from '@/hooks/use-toast'

interface PersonalDriveStatus {
  enabled: boolean
  connected: boolean
  connectedEmail?: string | null
  storedAttachmentCount?: number
}

export function PersonalDriveLinkCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [status, setStatus] = useState<PersonalDriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/attachments/personal-drive/status')
      if (res.ok) setStatus(await res.json())
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const personalDrive = searchParams.get('personalDrive')
    if (!personalDrive) return
    if (personalDrive === 'authorized') {
      toast({
        title: 'Drive personal conectado',
        description: 'Tus archivos nuevos ya se guardan ahí.',
      })
      void load()
    } else if (personalDrive === 'error') {
      const reason = searchParams.get('reason')
      toast({
        title: 'No se pudo conectar',
        description: reason || 'Error desconocido',
        variant: 'destructive',
      })
    }
    router.replace('/profile')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const connect = async () => {
    setConnecting(true)
    try {
      const res = await fetch('/api/attachments/personal-drive/connect')
      const data = await res.json()
      if (data.enabled === false) {
        toast({
          title: 'Función no disponible',
          description: 'El administrador todavía no habilitó conectar un Drive personal.',
          variant: 'destructive',
        })
        return
      }
      if (data.oauthConfigured === false || !data.authUrl) {
        toast({
          title: 'Integración no disponible',
          description: 'El administrador todavía no configuró Microsoft OAuth.',
          variant: 'destructive',
        })
        return
      }
      window.location.href = data.authUrl
    } catch {
      toast({ title: 'Error de conexión', variant: 'destructive' })
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/attachments/personal-drive/disconnect', { method: 'DELETE' })
      if (res.ok) {
        setStatus(current => (current ? { ...current, connected: false } : current))
        toast({ title: 'Conexión revocada' })
      }
    } catch {
      toast({ title: 'Error al revocar acceso', variant: 'destructive' })
    } finally {
      setDisconnecting(false)
      setConfirmOpen(false)
    }
  }

  const requestDisconnect = () => {
    if ((status?.storedAttachmentCount ?? 0) > 0) {
      setConfirmOpen(true)
    } else {
      void disconnect()
    }
  }

  if (loading || !status) return null
  // Nunca se conectó y el admin no lo habilitó: no hay nada que mostrar acá.
  if (!status.enabled && !status.connected) return null

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2 text-base'>
                <HardDrive className='h-4 w-4' />
                Drive personal
              </CardTitle>
              <CardDescription>
                Conecta tu OneDrive para que tus archivos nuevos (tickets, documentos, equipos,
                licencias, contratos, noticias, procesos — incluidas fotos tomadas con la cámara) se
                guarden ahí en vez del almacenamiento del servidor. Sin conectar, siguen guardándose
                donde ya se guardan hoy.
              </CardDescription>
            </div>
            {status.connected ? (
              <Badge variant='outline' className='flex items-center gap-1 text-xs'>
                <CheckCircle2 className='h-3 w-3 text-primary' />
                Conectado
              </Badge>
            ) : (
              <Badge variant='secondary' className='text-xs'>
                Sin conectar
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className='space-y-3'>
          {!status.enabled && status.connected && (
            <p className='text-xs text-muted-foreground'>
              El administrador desactivó esta función. Tus archivos nuevos ya no se guardan en tu
              Drive personal, pero los que ya subiste siguen ahí.
            </p>
          )}
          {status.connected ? (
            <>
              {status.connectedEmail && (
                <p className='text-sm text-muted-foreground'>Cuenta: {status.connectedEmail}</p>
              )}
              <Button
                variant='outline'
                size='sm'
                className='text-destructive hover:text-destructive'
                onClick={requestDisconnect}
                disabled={disconnecting}
              >
                <Link2Off className='mr-2 h-3.5 w-3.5' />
                {disconnecting ? 'Desconectando...' : 'Desconectar'}
              </Button>
            </>
          ) : (
            <Button size='sm' onClick={() => void connect()} disabled={connecting}>
              {connecting ? (
                <RefreshCw className='mr-2 h-3.5 w-3.5 animate-spin' />
              ) : (
                <Link2 className='mr-2 h-3.5 w-3.5' />
              )}
              Conectar mi Drive
            </Button>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desconectar tu Drive personal?</AlertDialogTitle>
            <AlertDialogDescription>
              Tenés {status.storedAttachmentCount} archivo(s) guardados en tu Drive personal. Si
              desconectás, nadie va a poder volver a abrirlos desde el sistema (pero van a seguir
              existiendo en tu OneDrive).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void disconnect()}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={disconnecting}
            >
              {disconnecting ? 'Desconectando...' : 'Desconectar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
