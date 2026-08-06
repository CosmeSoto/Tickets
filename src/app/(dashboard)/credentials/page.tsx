'use client'

import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, Eye, Loader2, ExternalLink, Trash2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateCredentialDialog } from '@/components/credentials/create-credential-dialog'
import { RevealCredentialDialog } from '@/components/credentials/reveal-credential-dialog'
import { useToast } from '@/hooks/use-toast'

type Vault = {
  id: string
  name: string
  kind: string
  family?: { id: string; name: string; code: string; color?: string | null } | null
  _count?: { entries: number }
}

type CredentialEntry = {
  id: string
  title: string
  username?: string | null
  url?: string | null
  notes?: string | null
  entryType: string
  equipmentId?: string | null
  lastRevealedAt?: string | null
  vault?: {
    id: string
    name: string
    family?: { name: string } | null
  }
}

export default function CredentialsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [entries, setEntries] = useState<CredentialEntry[]>([])
  const [selectedVaultId, setSelectedVaultId] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [revealEntry, setRevealEntry] = useState<CredentialEntry | null>(null)

  const isSuperAdmin = (session?.user as { isSuperAdmin?: boolean })?.isSuperAdmin === true
  const credentialsEnabled =
    isSuperAdmin || (session?.user as { credentialsEnabled?: boolean })?.credentialsEnabled === true
  const canManage =
    credentialsEnabled &&
    (session?.user?.role === 'ADMIN' ||
      (session?.user as { canManageCredentials?: boolean })?.canManageCredentials === true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [vaultRes, entryRes] = await Promise.all([
        fetch('/api/credentials/vaults'),
        fetch(
          selectedVaultId === 'all'
            ? '/api/credentials/entries'
            : `/api/credentials/entries?vaultId=${selectedVaultId}`
        ),
      ])

      if (vaultRes.status === 403 || entryRes.status === 403) {
        router.push('/')
        return
      }

      if (vaultRes.ok) {
        const data = await vaultRes.json()
        setVaults(data.vaults ?? [])
      }
      if (entryRes.ok) {
        const data = await entryRes.json()
        setEntries(data.entries ?? [])
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las credenciales',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [selectedVaultId, router, toast])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
      return
    }
    if (status === 'authenticated') {
      if (!credentialsEnabled) {
        router.push('/')
        return
      }
      loadData()
    }
  }, [status, loadData, router, credentialsEnabled])

  if (status === 'loading' || !session) {
    return (
      <ModuleLayout title='Credenciales' subtitle='Cargando...'>
        <div className='flex justify-center py-16'>
          <Loader2 className='h-8 w-8 animate-spin text-primary' />
        </div>
      </ModuleLayout>
    )
  }

  return (
    <ModuleLayout
      title='Credenciales'
      subtitle='Bóveda de credenciales por área'
      headerActions={
        canManage ? (
          <Button onClick={() => setCreateOpen(true)} size='sm'>
            <Plus className='h-4 w-4 mr-1.5' />
            Nueva credencial
          </Button>
        ) : undefined
      }
    >
      <div className='space-y-6'>
        <div className='flex flex-wrap items-center gap-3'>
          <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
            <SelectTrigger className='w-[280px]'>
              <SelectValue placeholder='Filtrar por bóveda' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas las bóvedas</SelectItem>
              {vaults.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                  {v.family ? ` · ${v.family.name}` : v.kind === 'PERSONAL' ? ' · Personal' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant='secondary'>{entries.length} credenciales</Badge>
        </div>

        {loading ? (
          <div className='flex justify-center py-12'>
            <Loader2 className='h-8 w-8 animate-spin text-primary' />
          </div>
        ) : entries.length === 0 ? (
          <Card>
            <CardContent className='py-12 text-center text-muted-foreground'>
              <KeyRound className='h-10 w-10 mx-auto mb-3 opacity-40' />
              <p>No hay credenciales en esta bóveda.</p>
              {canManage && (
                <Button variant='link' className='mt-2' onClick={() => setCreateOpen(true)}>
                  Crear la primera credencial
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {entries.map(entry => (
              <Card key={entry.id}>
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-base'>{entry.title}</CardTitle>
                    <Badge variant='outline'>{entry.entryType}</Badge>
                  </div>
                  {entry.vault && (
                    <p className='text-xs text-muted-foreground'>
                      {entry.vault.family?.name ?? entry.vault.name}
                    </p>
                  )}
                </CardHeader>
                <CardContent className='space-y-3'>
                  {entry.username && (
                    <p className='text-sm'>
                      <span className='text-muted-foreground'>Usuario:</span> {entry.username}
                    </p>
                  )}
                  {entry.url && (
                    <a
                      href={entry.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-sm text-primary inline-flex items-center gap-1 hover:underline'
                    >
                      Abrir enlace
                      <ExternalLink className='h-3 w-3' />
                    </a>
                  )}
                  <div className='flex gap-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      className='flex-1'
                      onClick={() => setRevealEntry(entry)}
                    >
                      <Eye className='h-4 w-4 mr-1.5' />
                      Revelar
                    </Button>
                    {canManage && (
                      <Button
                        variant='outline'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        title='Eliminar credencial'
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `¿Eliminar la credencial «${entry.title}»? Esta acción se registra en auditoría.`
                            )
                          ) {
                            return
                          }
                          const res = await fetch(`/api/credentials/entries/${entry.id}`, {
                            method: 'DELETE',
                          })
                          if (!res.ok) {
                            toast({
                              title: 'Error',
                              description: 'No se pudo eliminar',
                              variant: 'destructive',
                            })
                            return
                          }
                          toast({ title: 'Credencial eliminada' })
                          void loadData()
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <CreateCredentialDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          vaults={vaults}
          onCreated={loadData}
        />
      )}

      <RevealCredentialDialog entry={revealEntry} onClose={() => setRevealEntry(null)} />
    </ModuleLayout>
  )
}
