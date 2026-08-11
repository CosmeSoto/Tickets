'use client'

/**
 * TelegramLinkCard — vinculación de cuenta Telegram para recibir alertas del bot.
 *
 * Flujo:
 *   1. Usuario pulsa "Generar código" → POST /api/telegram/link
 *   2. Se muestra el código y el comando /vincular <código>
 *   3. El usuario va al bot y escribe el comando
 *   4. El bot confirma en Telegram y el polling de esta card detecta la vinculación
 *
 * Se puede desvincular en cualquier momento con DELETE /api/telegram/link.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Send,
  Link2,
  Link2Off,
  RefreshCw,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  Bell,
  BellOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface TelegramLinkState {
  linked: boolean
  telegramChatId: string | null
  telegramNotifications: boolean
  /** Teléfono registrado en el perfil del usuario — ayuda a confirmar identidad */
  phone: string | null
  pendingToken: { token: string; expiresAt: string } | null
  botConfigured: boolean
  botUsername: string | null
}

export function TelegramLinkCard() {
  const [state, setState] = useState<TelegramLinkState | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [savingPref, setSavingPref] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram/link')
      if (res.ok) {
        const data = await res.json()
        setState(data)
      }
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
  }, [fetchState])

  // Polling cada 5 s mientras hay token pendiente y no está vinculado
  useEffect(() => {
    if (state?.pendingToken && !state.linked) {
      pollRef.current = setInterval(fetchState, 5000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [state?.pendingToken, state?.linked, fetchState])

  const handleGenerateCode = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'No se pudo generar el código')
        return
      }
      await fetchState()
      toast.success('Código generado. Tienes 15 minutos para usarlo.')
    } catch {
      toast.error('Error de red')
    } finally {
      setGenerating(false)
    }
  }

  const handleUnlink = async () => {
    setUnlinking(true)
    try {
      const res = await fetch('/api/telegram/link', { method: 'DELETE' })
      if (res.ok) {
        await fetchState()
        toast.success('Cuenta Telegram desvinculada')
      }
    } catch {
      toast.error('Error al desvincular')
    } finally {
      setUnlinking(false)
    }
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar al portapapeles')
    }
  }

  const handleToggleTelegramNotifications = async (enabled: boolean) => {
    setSavingPref(true)
    try {
      const res = await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramNotifications: enabled }),
      })
      if (res.ok) {
        setState(prev => (prev ? { ...prev, telegramNotifications: enabled } : prev))
        toast.success(enabled ? 'Alertas Telegram activadas' : 'Alertas Telegram desactivadas')
      }
    } catch {
      toast.error('Error al guardar preferencia')
    } finally {
      setSavingPref(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-10'>
          <RefreshCw className='h-5 w-5 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  if (!state) return null

  const { linked, telegramNotifications, pendingToken, botConfigured, botUsername, phone } = state
  const botUrl = botUsername ? `https://t.me/${botUsername}` : null

  // Token expirado si queda menos de 0 segundos
  const tokenExpired = pendingToken
    ? new Date(pendingToken.expiresAt).getTime() < Date.now()
    : false
  const hasValidToken = pendingToken && !tokenExpired
  const command = hasValidToken ? `/vincular ${pendingToken.token}` : null

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Send className='h-5 w-5 text-blue-500' />
          <span>Telegram</span>
          {linked ? (
            <Badge className='bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800 ml-1'>
              <CheckCircle2 className='h-3 w-3 mr-1' />
              Vinculado
            </Badge>
          ) : (
            <Badge variant='secondary' className='ml-1'>
              <Link2Off className='h-3 w-3 mr-1' />
              Sin vincular
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Recibe alertas operativas importantes directamente en Telegram: tickets, inventario y
          backups.
        </CardDescription>
      </CardHeader>

      <CardContent className='space-y-5'>
        {/* Bot no configurado */}
        {!botConfigured && (
          <div className='flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-300'>
            <AlertCircle className='h-4 w-4 mt-0.5 flex-shrink-0' />
            <span>
              El bot de Telegram no está habilitado. El administrador debe configurarlo en{' '}
              <strong>Admin → Configuración → Telegram</strong>.
            </span>
          </div>
        )}

        {/* Estado: vinculado */}
        {linked && (
          <>
            <div className='flex items-center justify-between'>
              <div className='space-y-0.5'>
                <Label className='text-base flex items-center gap-2'>
                  {telegramNotifications ? (
                    <Bell className='h-4 w-4 text-blue-600 dark:text-blue-400' />
                  ) : (
                    <BellOff className='h-4 w-4 text-muted-foreground' />
                  )}
                  <span>Alertas activas</span>
                </Label>
                <p className='text-sm text-muted-foreground'>
                  Recibir alertas importantes por Telegram (tickets, inventario, backups)
                </p>
              </div>
              <Switch
                checked={telegramNotifications}
                onCheckedChange={handleToggleTelegramNotifications}
                disabled={savingPref}
              />
            </div>

            {/* Teléfono registrado — confirmación de identidad */}
            {phone && (
              <>
                <Separator />
                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                  <span className='text-base'>📱</span>
                  <span>
                    Cuenta vinculada al teléfono{' '}
                    <span className='font-medium text-foreground'>{phone}</span>
                    {' '}registrado en tu perfil.
                  </span>
                </div>
              </>
            )}

            <Separator />

            <div className='flex items-center justify-between'>
              <p className='text-sm text-muted-foreground'>
                Tu cuenta está vinculada. Para desvincularla pulsa el botón o escribe{' '}
                <code className='font-mono text-xs'>/desvincular</code> en el bot.
              </p>
              <Button
                variant='outline'
                size='sm'
                onClick={handleUnlink}
                disabled={unlinking}
                className='ml-4 flex-shrink-0 text-destructive hover:text-destructive'
              >
                {unlinking ? (
                  <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                ) : (
                  <Link2Off className='h-3.5 w-3.5 mr-1.5' />
                )}
                Desvincular
              </Button>
            </div>
          </>
        )}

        {/* Estado: no vinculado */}
        {!linked && botConfigured && (
          <>
            {hasValidToken && command ? (
              <div className='space-y-4'>
                <p className='text-sm text-muted-foreground'>
                  Escribe el siguiente comando en el bot de Telegram para vincular tu cuenta.
                  El código expira en 15 minutos.
                </p>

                {/* Código destacado */}
                <div className='rounded-lg border bg-muted/50 p-4 space-y-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <code className='text-lg font-mono font-bold tracking-widest'>
                      {pendingToken!.token}
                    </code>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => handleCopy(command)}
                    >
                      {copied ? (
                        <Check className='h-4 w-4 text-green-600' />
                      ) : (
                        <Copy className='h-4 w-4' />
                      )}
                    </Button>
                  </div>
                  <p className='text-xs text-muted-foreground font-mono'>{command}</p>
                </div>

                {/* Enlace al bot */}
                {botUrl && (
                  <div className='flex items-center gap-2'>
                    <Button variant='default' size='sm' asChild>
                      <a href={botUrl} target='_blank' rel='noopener noreferrer'>
                        <Send className='h-3.5 w-3.5 mr-1.5' />
                        Abrir bot en Telegram
                        <ExternalLink className='h-3 w-3 ml-1.5' />
                      </a>
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={handleGenerateCode}
                      disabled={generating}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${generating ? 'animate-spin' : ''}`} />
                      Nuevo código
                    </Button>
                  </div>
                )}

                <p className='text-xs text-muted-foreground flex items-center gap-1'>
                  <RefreshCw className='h-3 w-3' />
                  Comprobando vinculación automáticamente...
                </p>
              </div>
            ) : (
              <div className='space-y-4'>
                <p className='text-sm text-muted-foreground'>
                  Vincula tu cuenta para recibir alertas de tickets, inventario y backups
                  directamente en Telegram.
                </p>

                {/* Instrucciones rápidas */}
                <ol className='text-sm text-muted-foreground space-y-1 list-decimal list-inside'>
                  <li>Pulsa «Generar código» y copia el comando que aparece</li>
                  <li>
                    {botUrl ? (
                      <>
                        Abre el bot{' '}
                        <a
                          href={botUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary hover:underline inline-flex items-center gap-0.5'
                        >
                          @{botUsername}
                          <ExternalLink className='h-3 w-3' />
                        </a>
                      </>
                    ) : (
                      'Abre el bot en Telegram'
                    )}{' '}
                    y envía el comando
                  </li>
                  <li>Esta página se actualizará sola al confirmar</li>
                </ol>

                <Button
                  onClick={handleGenerateCode}
                  disabled={generating || !botConfigured}
                  size='sm'
                >
                  {generating ? (
                    <RefreshCw className='h-3.5 w-3.5 mr-1.5 animate-spin' />
                  ) : (
                    <Link2 className='h-3.5 w-3.5 mr-1.5' />
                  )}
                  Generar código
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
