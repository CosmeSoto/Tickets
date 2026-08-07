'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  KeyRound,
  Plus,
  Eye,
  Loader2,
  ExternalLink,
  Trash2,
  Copy,
  Share2,
  LayoutGrid,
  List,
} from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateCredentialDialog } from '@/components/credentials/create-credential-dialog'
import { RevealCredentialDialog } from '@/components/credentials/reveal-credential-dialog'
import { ShareCredentialDialog } from '@/components/credentials/share-credential-dialog'
import { useToast } from '@/hooks/use-toast'
import { CREDENTIAL_ENTRY_TYPE_LABELS } from '@/lib/credentials/constants'
import { cn } from '@/lib/utils'

type Vault = {
  id: string
  name: string
  kind: string
  familyId?: string | null
  family?: {
    id: string
    name: string
    code: string
    color?: string | null
    order?: number
  } | null
  _count?: { entries: number }
}

function vaultOptionLabel(v: Vault): string {
  if (v.kind === 'PERSONAL') return `${v.name} · Personal`
  if (v.family?.name) return `${v.family.name} · ${v.name}`
  return v.name
}

function entryAreaLabel(entry: CredentialEntry): string {
  if (!entry.vault) return '—'
  return entry.vault.family?.name
    ? `${entry.vault.family.name} · ${entry.vault.name}`
    : entry.vault.name
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
  sharedWithMe?: boolean
  shareCapability?: string | null
  vault?: {
    id: string
    name: string
    family?: { name: string } | null
  }
}

type ViewMode = 'table' | 'cards'

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
  const [shareEntry, setShareEntry] = useState<CredentialEntry | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')

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

  const copyUsername = async (username: string) => {
    await navigator.clipboard.writeText(username)
    toast({ title: 'Usuario copiado' })
  }

  const deleteEntry = async (entry: CredentialEntry) => {
    if (
      !window.confirm(
        `¿Eliminar la credencial «${entry.title}»? Esta acción se registra en auditoría.`
      )
    ) {
      return
    }
    const res = await fetch(`/api/credentials/entries/${entry.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast({
        title: 'No se pudo eliminar',
        description: data.error || 'Error del servidor',
        variant: 'destructive',
      })
      return
    }
    toast({ title: 'Credencial eliminada' })
    void loadData()
  }

  const renderActions = (entry: CredentialEntry, compact = false) => (
    <div className={cn('flex items-center gap-1.5', compact ? 'justify-end' : '')}>
      <Button
        variant={compact ? 'outline' : 'default'}
        size='sm'
        onClick={() => setRevealEntry(entry)}
      >
        <Eye className='h-4 w-4 mr-1.5' />
        {compact ? 'Usar' : 'Usar / revelar'}
      </Button>
      {canManage && !entry.sharedWithMe && (
        <Button
          variant='outline'
          size='sm'
          title='Compartir con otro usuario'
          onClick={() => setShareEntry(entry)}
        >
          <Share2 className='h-4 w-4' />
        </Button>
      )}
      {canManage && !entry.sharedWithMe && (
        <Button
          variant='outline'
          size='sm'
          className='text-destructive hover:text-destructive'
          title='Eliminar credencial'
          onClick={() => void deleteEntry(entry)}
        >
          <Trash2 className='h-4 w-4' />
        </Button>
      )}
    </div>
  )

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
      <div className='space-y-4'>
        <div className='flex flex-wrap items-center gap-3'>
          <Select value={selectedVaultId} onValueChange={setSelectedVaultId}>
            <SelectTrigger className='w-[280px]'>
              <SelectValue placeholder='Filtrar por bóveda' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Todas las áreas</SelectItem>
              {vaults.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {vaultOptionLabel(v)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant='secondary'>{entries.length} credenciales</Badge>
          <div className='ml-auto flex items-center rounded-md border p-0.5'>
            <Button
              type='button'
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size='sm'
              className='h-8 px-2.5'
              onClick={() => setViewMode('table')}
              title='Vista tabla'
            >
              <List className='h-4 w-4' />
            </Button>
            <Button
              type='button'
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size='sm'
              className='h-8 px-2.5'
              onClick={() => setViewMode('cards')}
              title='Vista tarjetas'
            >
              <LayoutGrid className='h-4 w-4' />
            </Button>
          </div>
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
        ) : viewMode === 'table' ? (
          <div className='rounded-md border bg-card overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Área</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className='text-right w-[220px]'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <div className='font-medium'>{entry.title}</div>
                      {entry.sharedWithMe ? (
                        <Badge variant='secondary' className='mt-1'>
                          Compartida contigo
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className='text-sm text-muted-foreground max-w-[200px] truncate'>
                      {entryAreaLabel(entry)}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline'>
                        {CREDENTIAL_ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.username ? (
                        <div className='flex items-center gap-1'>
                          <span className='font-mono text-sm truncate max-w-[140px]'>
                            {entry.username}
                          </span>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7'
                            onClick={() => void copyUsername(entry.username!)}
                          >
                            <Copy className='h-3.5 w-3.5' />
                          </Button>
                        </div>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.url ? (
                        <a
                          href={entry.url}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-sm text-primary inline-flex items-center gap-1 hover:underline'
                        >
                          Abrir
                          <ExternalLink className='h-3 w-3' />
                        </a>
                      ) : (
                        <span className='text-muted-foreground'>—</span>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>{renderActions(entry, true)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {entries.map(entry => (
              <Card key={entry.id}>
                <CardHeader className='pb-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <CardTitle className='text-base'>{entry.title}</CardTitle>
                    <div className='flex flex-wrap gap-1 justify-end'>
                      {entry.sharedWithMe ? (
                        <Badge variant='secondary'>Compartida contigo</Badge>
                      ) : null}
                      <Badge variant='outline'>
                        {CREDENTIAL_ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType}
                      </Badge>
                    </div>
                  </div>
                  <p className='text-xs text-muted-foreground'>{entryAreaLabel(entry)}</p>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {entry.username && (
                    <div className='flex items-center gap-2 text-sm'>
                      <span className='text-muted-foreground shrink-0'>Usuario:</span>
                      <span className='font-mono truncate'>{entry.username}</span>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon'
                        className='h-7 w-7 shrink-0'
                        onClick={() => void copyUsername(entry.username!)}
                      >
                        <Copy className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  )}
                  {entry.url && (
                    <a
                      href={entry.url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-sm text-primary inline-flex items-center gap-1 hover:underline'
                    >
                      Abrir URL de acceso
                      <ExternalLink className='h-3 w-3' />
                    </a>
                  )}
                  {renderActions(entry)}
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
      {canManage && (
        <ShareCredentialDialog entry={shareEntry} onClose={() => setShareEntry(null)} />
      )}
    </ModuleLayout>
  )
}
