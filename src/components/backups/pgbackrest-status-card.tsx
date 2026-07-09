'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Database, RefreshCw, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface PgBackRestHealth {
  status: 'healthy' | 'degraded' | 'unavailable'
  pgbackrestOk: boolean
  stanzaOk: boolean
  stanza: string
  allowRestore: boolean
}

interface PgBackRestStatusCardProps {
  onInitialized?: () => void
}

export function PgBackRestStatusCard({ onInitialized }: PgBackRestStatusCardProps) {
  const { toast } = useToast()
  const [health, setHealth] = useState<PgBackRestHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/backups/init-pgbackrest')
      if (res.ok) {
        const data = await res.json()
        setHealth(data.health)
      }
    } catch {
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  const handleInit = async () => {
    setInitializing(true)
    try {
      const res = await fetch('/api/admin/backups/init-pgbackrest', { method: 'POST' })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || 'No se pudo inicializar pgBackRest')
      }

      setHealth(data.health)
      toast({
        title: data.alreadyInitialized ? 'pgBackRest ya estaba listo' : 'pgBackRest inicializado',
        description: data.message,
      })
      onInitialized?.()
    } catch (error) {
      toast({
        title: 'Error al inicializar pgBackRest',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      })
    } finally {
      setInitializing(false)
      loadHealth()
    }
  }

  const isReady = health?.status === 'healthy' && health.stanzaOk

  return (
    <Card className={isReady ? 'border-primary/20' : 'border-amber-500/40 bg-amber-500/5'}>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <CardTitle className='text-base flex items-center gap-2'>
              <Database className='h-5 w-5 text-primary' />
              Infraestructura pgBackRest
            </CardTitle>
            <CardDescription className='mt-1'>
              Motor de respaldos automáticos (FULL / DIFF) y recuperación ante desastre
            </CardDescription>
          </div>
          {loading ? (
            <Badge variant='outline'>
              <Loader2 className='h-3 w-3 mr-1 animate-spin' />
              Verificando
            </Badge>
          ) : isReady ? (
            <Badge className='bg-emerald-600 hover:bg-emerald-600'>
              <CheckCircle className='h-3 w-3 mr-1' />
              Disponible
            </Badge>
          ) : (
            <Badge variant='destructive'>
              <AlertTriangle className='h-3 w-3 mr-1' />
              No disponible
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {!loading && health && (
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs'>
            <div>
              <p className='text-muted-foreground'>Stanza</p>
              <p className='font-mono font-medium'>{health.stanza}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>pgBackRest</p>
              <p>{health.pgbackrestOk ? 'OK' : 'Error'}</p>
            </div>
            <div>
              <p className='text-muted-foreground'>Repositorio</p>
              <p>{health.stanzaOk ? 'OK' : 'Pendiente'}</p>
            </div>
          </div>
        )}

        {!isReady && !loading && (
          <p className='text-xs text-muted-foreground leading-relaxed'>
            Tras un despliegue limpio (<code className='text-[11px]'>--clean</code>), la stanza y el
            primer backup FULL pueden tardar unos minutos. Si persiste el error, usa{' '}
            <strong>Inicializar pgBackRest</strong> o ejecuta{' '}
            <code className='text-[11px]'>./docker/scripts/fix-pgbackrest.sh</code> en el servidor.
          </p>
        )}

        <div className='flex flex-wrap gap-2'>
          <Button
            variant='outline'
            size='sm'
            onClick={loadHealth}
            disabled={loading || initializing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Verificar
          </Button>
          {!isReady && (
            <Button size='sm' onClick={handleInit} disabled={loading || initializing}>
              {initializing ? (
                <>
                  <Loader2 className='h-4 w-4 mr-2 animate-spin' />
                  Inicializando…
                </>
              ) : (
                'Inicializar pgBackRest'
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
