'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { KeyRound, Plus, Eye, Loader2, ExternalLink, Trash2, Copy, Share2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { FilterBar } from '@/components/common/filters'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { type TableColumnDef } from '@/components/common/table-columns-menu'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import { useExport } from '@/hooks/common/use-export'
import { useFilters, type FilterConfig } from '@/hooks/common/use-filters'
import {
  CREDENTIAL_ENTRY_TYPE_LABELS,
  CREDENTIAL_ENTRY_TYPE_OPTIONS,
  formatCredentialVaultLabel,
} from '@/lib/credentials/constants'
import type { ExportColumn } from '@/lib/utils/export'
import { exportToExcelMulti } from '@/lib/utils/export'
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

type ShareRecipient = {
  id: string
  name: string
  email: string
  capability: string
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
  isShared?: boolean
  shareCount?: number
  sharedWith?: ShareRecipient[]
  sharedWithLabel?: string
  vaultId?: string
  vault?: {
    id: string
    name: string
    kind?: string
    family?: { name: string } | null
  }
}

type CredentialRow = CredentialEntry & {
  areaLabel: string
  typeLabel: string
  vaultFilterId: string
  passwordMasked: string
  isSharedLabel: string
  sharedWithLabel: string
}

type ViewMode = 'table' | 'cards'

const COLUMN_DEFS: TableColumnDef[] = [
  { key: 'title', label: 'Título', required: true },
  { key: 'areaLabel', label: 'Área' },
  { key: 'typeLabel', label: 'Tipo' },
  { key: 'username', label: 'Usuario' },
  { key: 'passwordMasked', label: 'Contraseña (••••)' },
  { key: 'url', label: 'URL' },
  { key: 'isSharedLabel', label: 'Compartida' },
  { key: 'sharedWithLabel', label: 'Compartida con' },
]

const DEFAULT_ORDER = COLUMN_DEFS.map(c => c.key)
const DEFAULT_VISIBLE = COLUMN_DEFS.map(c => c.key).filter(k => k !== 'passwordMasked')

const EXPORT_COLUMN_MAP: Record<string, ExportColumn> = {
  title: { key: 'title', label: 'Título' },
  areaLabel: { key: 'areaLabel', label: 'Área' },
  typeLabel: { key: 'typeLabel', label: 'Tipo' },
  username: { key: 'username', label: 'Usuario' },
  passwordMasked: { key: 'passwordMasked', label: 'Contraseña' },
  url: { key: 'url', label: 'URL' },
  isSharedLabel: { key: 'isSharedLabel', label: 'Compartida' },
  sharedWithLabel: { key: 'sharedWithLabel', label: 'Compartida con' },
}

function toRow(entry: CredentialEntry): CredentialRow {
  const vault = entry.vault
    ? { name: entry.vault.name, kind: entry.vault.kind, family: entry.vault.family }
    : { name: '—', kind: null, family: null }
  const sharedOut = (entry.shareCount ?? 0) > 0 || (entry.sharedWith?.length ?? 0) > 0
  return {
    ...entry,
    areaLabel: formatCredentialVaultLabel(vault),
    typeLabel: CREDENTIAL_ENTRY_TYPE_LABELS[entry.entryType] ?? entry.entryType,
    vaultFilterId: entry.vault?.id ?? entry.vaultId ?? 'unknown',
    passwordMasked: '••••••••',
    isSharedLabel: sharedOut || entry.sharedWithMe ? 'Sí' : 'No',
    sharedWithLabel: entry.sharedWithLabel || (entry.sharedWithMe ? 'Compartida conmigo' : '—'),
  }
}

export default function CredentialsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [vaults, setVaults] = useState<Vault[]>([])
  const [entries, setEntries] = useState<CredentialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [revealEntry, setRevealEntry] = useState<CredentialEntry | null>(null)
  const [shareEntry, setShareEntry] = useState<CredentialEntry | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [columnOrder, setColumnOrder] = useState<string[]>(DEFAULT_ORDER)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_VISIBLE)

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
        fetch('/api/credentials/entries'),
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
  }, [router, toast])

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

  const rows = useMemo(() => entries.map(toRow), [entries])

  const filterConfig = useMemo<FilterConfig<CredentialRow>[]>(
    () => [
      {
        id: 'search',
        type: 'search',
        label: 'Buscar',
        placeholder: 'Título, usuario, notas…',
        searchFields: ['title', 'username', 'notes', 'areaLabel', 'url'],
      },
      {
        id: 'vault',
        type: 'select',
        label: 'Área',
        field: 'vaultFilterId',
        defaultValue: 'all',
        options: [
          { value: 'all', label: 'Todas las áreas' },
          ...vaults.map(v => ({
            value: v.id,
            label: formatCredentialVaultLabel(v),
          })),
        ],
      },
      {
        id: 'entryType',
        type: 'select',
        label: 'Tipo',
        field: 'entryType',
        defaultValue: 'all',
        options: CREDENTIAL_ENTRY_TYPE_OPTIONS,
      },
    ],
    [vaults]
  )

  const { filteredData, filters, setFilter, clearFilters, activeFiltersCount } = useFilters(
    rows,
    filterConfig
  )

  const activeColumnKeys = useMemo(
    () => columnOrder.filter(k => visibleColumns.includes(k) && EXPORT_COLUMN_MAP[k]),
    [columnOrder, visibleColumns]
  )

  const exportColumns = useMemo(
    () => activeColumnKeys.map(k => EXPORT_COLUMN_MAP[k]),
    [activeColumnKeys]
  )

  const {
    exportCSV,
    exportPDF,
    exporting: exportingBase,
  } = useExport({
    filename: 'credenciales',
    title: 'Credenciales',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} · contraseñas enmascaradas · ${filteredData.length} registros`,
    getData: () => filteredData,
    columns: exportColumns,
  })

  const [exportingExcel, setExportingExcel] = useState(false)
  const exporting = exportingBase || exportingExcel

  const shareExportColumns: ExportColumn[] = [
    { key: 'title', label: 'Credencial' },
    { key: 'areaLabel', label: 'Área' },
    { key: 'recipientName', label: 'Compartida con' },
    { key: 'recipientEmail', label: 'Email' },
    { key: 'capability', label: 'Permiso' },
  ]

  const exportExcel = async () => {
    setExportingExcel(true)
    try {
      if (filteredData.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay datos para exportar con los filtros actuales',
          variant: 'destructive',
        })
        return
      }
      const shareRows = filteredData.flatMap(entry =>
        (entry.sharedWith ?? []).map(r => ({
          title: entry.title,
          areaLabel: entry.areaLabel,
          recipientName: r.name,
          recipientEmail: r.email,
          capability: r.capability,
        }))
      )
      const date = new Date().toISOString().split('T')[0]
      await exportToExcelMulti({
        filename: `credenciales-${date}`,
        sheets: [
          {
            name: 'Credenciales',
            columns: exportColumns,
            rows: filteredData,
          },
          {
            name: 'Compartidos',
            columns: shareExportColumns,
            rows: shareRows,
          },
        ],
      })
      toast({
        title: 'Excel exportado',
        description: `${filteredData.length} credenciales · ${shareRows.length} compartidos`,
      })
    } catch {
      toast({
        title: 'Error al exportar Excel',
        description: 'No se pudo generar el informe',
        variant: 'destructive',
      })
    } finally {
      setExportingExcel(false)
    }
  }

  const copyUsername = async (username: string) => {
    await navigator.clipboard.writeText(username)
    toast({ title: 'Usuario copiado' })
  }

  const copyPassword = async (entry: CredentialEntry) => {
    setCopyingId(entry.id)
    try {
      const res = await fetch(`/api/credentials/entries/${entry.id}/copy`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo copiar')
      await navigator.clipboard.writeText(data.secret)
      toast({
        title: 'Contraseña copiada',
        description: 'En portapapeles (sin mostrar). Acción registrada en auditoría.',
      })
    } catch (err: unknown) {
      toast({
        title: 'No se pudo copiar',
        description: err instanceof Error ? err.message : 'Error inesperado',
        variant: 'destructive',
      })
    } finally {
      setCopyingId(null)
    }
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

  const renderActions = (entry: CredentialRow, compact = false) => (
    <div className={cn('flex items-center gap-1.5 flex-wrap', compact ? 'justify-end' : '')}>
      <Button
        variant='outline'
        size='sm'
        title='Copiar contraseña (auditado)'
        disabled={copyingId === entry.id}
        onClick={() => void copyPassword(entry)}
      >
        {copyingId === entry.id ? (
          <Loader2 className='h-4 w-4 animate-spin' />
        ) : (
          <KeyRound className='h-4 w-4' />
        )}
        <span className={cn(compact ? 'sr-only' : 'ml-1.5')}>Copiar clave</span>
      </Button>
      <Button
        variant={compact ? 'outline' : 'default'}
        size='sm'
        title='Revelar en pantalla'
        onClick={() => setRevealEntry(entry)}
      >
        <Eye className='h-4 w-4' />
        <span className={cn(compact ? 'sr-only' : 'ml-1.5')}>Revelar</span>
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

  const renderCell = (entry: CredentialRow, key: string) => {
    switch (key) {
      case 'title':
        return (
          <TableCell key={key}>
            <div className='font-medium'>{entry.title}</div>
            {entry.sharedWithMe ? (
              <Badge variant='secondary' className='mt-1'>
                Compartida contigo
              </Badge>
            ) : null}
          </TableCell>
        )
      case 'areaLabel':
        return (
          <TableCell key={key} className='text-sm text-muted-foreground max-w-[180px] truncate'>
            {entry.areaLabel}
          </TableCell>
        )
      case 'typeLabel':
        return (
          <TableCell key={key}>
            <Badge variant='outline'>{entry.typeLabel}</Badge>
          </TableCell>
        )
      case 'username':
        return (
          <TableCell key={key}>
            {entry.username ? (
              <div className='flex items-center gap-1'>
                <span className='font-mono text-sm truncate max-w-[140px]'>{entry.username}</span>
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  className='h-7 w-7'
                  title='Copiar usuario'
                  onClick={() => void copyUsername(entry.username!)}
                >
                  <Copy className='h-3.5 w-3.5' />
                </Button>
              </div>
            ) : (
              <span className='text-muted-foreground'>—</span>
            )}
          </TableCell>
        )
      case 'passwordMasked':
        return (
          <TableCell key={key} className='font-mono text-muted-foreground tracking-widest'>
            ••••••••
          </TableCell>
        )
      case 'url':
        return (
          <TableCell key={key}>
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
        )
      case 'isSharedLabel':
        return (
          <TableCell key={key}>
            {entry.isSharedLabel === 'Sí' ? (
              <Badge variant='secondary'>Sí</Badge>
            ) : (
              <span className='text-muted-foreground text-sm'>No</span>
            )}
          </TableCell>
        )
      case 'sharedWithLabel':
        return (
          <TableCell key={key} className='text-sm max-w-[240px]'>
            {entry.sharedWithLabel && entry.sharedWithLabel !== '—' ? (
              <span className='line-clamp-2' title={entry.sharedWithLabel}>
                {entry.sharedWithLabel}
              </span>
            ) : (
              <span className='text-muted-foreground'>—</span>
            )}
          </TableCell>
        )
      default:
        return null
    }
  }

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
        <FilterBar
          config={filterConfig}
          filters={filters}
          onFilterChange={setFilter}
          onClearFilters={clearFilters}
          onRefresh={loadData}
          loading={loading}
          activeFiltersCount={activeFiltersCount}
          stats={[
            { label: 'Total', value: String(filteredData.length) },
            {
              label: 'Compartidas',
              value: String(
                filteredData.filter(
                  e => e.sharedWithMe || (e.shareCount ?? 0) > 0 || (e.sharedWith?.length ?? 0) > 0
                ).length
              ),
            },
          ]}
        />

        <Card>
          <CardHeader className='pb-3'>
            <ListTableToolbar
              title={
                <CardTitle className='text-base'>
                  Credenciales ({filteredData.length}
                  {filteredData.length !== rows.length ? ` de ${rows.length}` : ''})
                </CardTitle>
              }
              subtitle={
                <>
                  Ordena columnas antes de exportar. Contraseñas siempre como ••••••••. Excel
                  incluye hoja «Compartidos» (destinatarios). «Copiar clave» audita sin mostrar.
                </>
              }
              loading={loading}
              onRefresh={() => void loadData()}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              columns={{
                defs: COLUMN_DEFS,
                order: columnOrder,
                visible: visibleColumns,
                onOrderChange: setColumnOrder,
                onVisibleChange: setVisibleColumns,
                storageKey: 'credentials-table-columns-v3',
              }}
              export={{
                onExportCSV: exportCSV,
                onExportExcel: exportExcel,
                onExportPDF: exportPDF,
                loading: exporting,
                disabled: loading || filteredData.length === 0,
              }}
            />
          </CardHeader>
          <CardContent className='p-0'>
            {loading ? (
              <div className='flex justify-center py-12'>
                <Loader2 className='h-8 w-8 animate-spin text-primary' />
              </div>
            ) : filteredData.length === 0 ? (
              <div className='py-12 text-center text-muted-foreground px-4'>
                <KeyRound className='h-10 w-10 mx-auto mb-3 opacity-40' />
                <p>
                  {rows.length === 0
                    ? 'No hay credenciales en tus áreas.'
                    : 'Ninguna credencial coincide con los filtros.'}
                </p>
                {canManage && rows.length === 0 && (
                  <Button variant='link' className='mt-2' onClick={() => setCreateOpen(true)}>
                    Crear la primera credencial
                  </Button>
                )}
              </div>
            ) : viewMode === 'table' ? (
              <div className='overflow-x-auto'>
                <Table>
                  <TableHeader>
                    <TableRow>
                      {activeColumnKeys.map(key => (
                        <TableHead key={key}>
                          {COLUMN_DEFS.find(c => c.key === key)?.label ?? key}
                        </TableHead>
                      ))}
                      <TableHead className='text-right w-[220px]'>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map(entry => (
                      <TableRow key={entry.id}>
                        {activeColumnKeys.map(key => renderCell(entry, key))}
                        <TableCell className='text-right'>{renderActions(entry, true)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3 p-4'>
                {filteredData.map(entry => (
                  <Card key={entry.id}>
                    <CardHeader className='pb-2'>
                      <div className='flex items-start justify-between gap-2'>
                        <CardTitle className='text-base'>{entry.title}</CardTitle>
                        <div className='flex flex-wrap gap-1 justify-end'>
                          {entry.sharedWithMe ? (
                            <Badge variant='secondary'>Compartida contigo</Badge>
                          ) : (entry.shareCount ?? 0) > 0 ? (
                            <Badge variant='secondary'>Compartida ({entry.shareCount})</Badge>
                          ) : null}
                          <Badge variant='outline'>{entry.typeLabel}</Badge>
                        </div>
                      </div>
                      <p className='text-xs text-muted-foreground'>{entry.areaLabel}</p>
                      {entry.sharedWithLabel && entry.sharedWithLabel !== '—' ? (
                        <p className='text-xs text-muted-foreground line-clamp-2'>
                          Con: {entry.sharedWithLabel}
                        </p>
                      ) : null}
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
                      {renderActions(entry)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
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
