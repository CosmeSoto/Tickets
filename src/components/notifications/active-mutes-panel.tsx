'use client'

import { useCallback, useEffect, useState } from 'react'
import { BellOff, Loader2, Volume2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { entityKeyLabel } from '@/lib/notifications/entity-key'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface MuteRow {
  id: string
  entityKey: string
  mutedUntil: string | null
  updatedAt: string
}

interface ActiveMutesPanelProps {
  onUnmute: (entityKey: string) => Promise<void>
}

export function ActiveMutesPanel({ onUnmute }: ActiveMutesPanelProps) {
  const [mutes, setMutes] = useState<MuteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications/mutes', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setMutes(Array.isArray(data.mutes) ? data.mutes : [])
    } catch {
      /* silencioso */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Exponer recarga cuando el padre silencia
  useEffect(() => {
    const handler = () => load()
    window.addEventListener('notification-mutes-changed', handler)
    return () => window.removeEventListener('notification-mutes-changed', handler)
  }, [load])

  if (loading) {
    return (
      <Card>
        <CardContent className='py-4 flex items-center gap-2 text-sm text-muted-foreground'>
          <Loader2 className='h-4 w-4 animate-spin' />
          Cargando silencios...
        </CardContent>
      </Card>
    )
  }

  if (mutes.length === 0) return null

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base flex items-center gap-2'>
          <BellOff className='h-4 w-4' />
          Hilos silenciados
          <Badge variant='secondary' className='text-xs'>
            {mutes.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-2'>
        {mutes.map(m => (
          <div
            key={m.id}
            className='flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2'
          >
            <div className='min-w-0'>
              <div className='text-sm font-medium truncate'>{entityKeyLabel(m.entityKey)}</div>
              <div className='text-xs text-muted-foreground'>
                {m.mutedUntil
                  ? `Hasta ${formatDistanceToNow(new Date(m.mutedUntil), {
                      addSuffix: true,
                      locale: es,
                    })}`
                  : 'Silencio indefinido'}
              </div>
            </div>
            <Button
              variant='outline'
              size='sm'
              className='h-7 text-xs shrink-0'
              disabled={busyKey === m.entityKey}
              onClick={async () => {
                setBusyKey(m.entityKey)
                try {
                  await onUnmute(m.entityKey)
                  await load()
                } finally {
                  setBusyKey(null)
                }
              }}
            >
              {busyKey === m.entityKey ? (
                <Loader2 className='h-3.5 w-3.5 mr-1 animate-spin' />
              ) : (
                <Volume2 className='h-3.5 w-3.5 mr-1' />
              )}
              Reactivar
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
