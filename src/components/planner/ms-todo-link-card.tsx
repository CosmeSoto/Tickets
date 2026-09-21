'use client'

/**
 * MsTodoLinkCard — vinculación de la cuenta PERSONAL de Microsoft To Do del
 * usuario, para sincronizar sus tareas independientes (personal_tasks). A
 * diferencia de la conexión de Planner (una sola cuenta de servicio,
 * administrada por el Super Admin en /admin/planner/settings), esta la
 * conecta cada usuario por su cuenta desde su propio perfil — mismo lugar
 * que TelegramLinkCard, para otras integraciones personales opcionales.
 *
 * Si el usuario no conecta ninguna cuenta, sus tareas simplemente quedan
 * locales sin sincronizar — no es un error, es el comportamiento esperado.
 */
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ExternalLink, Link2, Link2Off, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'

interface MsTodoStatus {
  connected: boolean
  connectedEmail?: string | null
  lastSyncedAt?: string | null
  lastSyncError?: string | null
}

export function MsTodoLinkCard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [status, setStatus] = useState<MsTodoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/planner/ms-todo/status')
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
    const msTodo = searchParams.get('msTodo')
    if (!msTodo) return
    if (msTodo === 'authorized') {
      toast({
        title: 'Microsoft To Do conectado',
        description: 'Tus tareas ya pueden sincronizarse.',
      })
      void load()
    } else if (msTodo === 'error') {
      // searchParams.get ya decodifica el percent-encoding una vez — volver a
      // llamar decodeURIComponent sobre eso es un doble-decode que lanza
      // URIError si el mensaje de error de Microsoft contiene un "%" literal.
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
      const res = await fetch('/api/planner/ms-todo/connect')
      const data = await res.json()
      if (data.oauthConfigured === false || !data.authUrl) {
        toast({
          title: 'Integración no disponible',
          description: 'El administrador todavía no habilitó la conexión con Microsoft To Do.',
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
      const res = await fetch('/api/planner/ms-todo/disconnect', { method: 'DELETE' })
      if (res.ok) {
        setStatus({ connected: false })
        toast({ title: 'Conexión revocada' })
      }
    } catch {
      toast({ title: 'Error al revocar acceso', variant: 'destructive' })
    } finally {
      setDisconnecting(false)
    }
  }

  if (loading) return null

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='flex items-center gap-2 text-base'>
              <ExternalLink className='h-4 w-4' />
              Microsoft To Do
            </CardTitle>
            <CardDescription>
              Vincula tu cuenta para que tus tareas independientes (módulo Tareas) se sincronicen
              con tu lista personal de Microsoft To Do. Sin conectar, tus tareas quedan solo en la
              app.
            </CardDescription>
          </div>
          {status?.connected ? (
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
        {status?.connected ? (
          <>
            {status.connectedEmail && (
              <p className='text-sm text-muted-foreground'>Cuenta: {status.connectedEmail}</p>
            )}
            {status.lastSyncError && (
              <p className='text-xs text-destructive'>
                Último error de sincronización: {status.lastSyncError}
              </p>
            )}
            <Button
              variant='outline'
              size='sm'
              className='text-destructive hover:text-destructive'
              onClick={() => void disconnect()}
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
            Conectar cuenta de Microsoft
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
