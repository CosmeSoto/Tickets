'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Loader2,
  Play,
  Download,
  RefreshCw,
  Filter,
  Columns3,
  ChevronLeft,
  ChevronRight,
  Search,
  Bookmark,
  BookmarkPlus,
  Trash2,
  Pin,
  PinOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilyOptions } from '@/hooks/use-family-options'
import type { InventorySavedReport, ReportDatasetDef } from '@/lib/inventory/reports/types'
import {
  ALL_FILTER,
  getDefaultFilterValues,
  getDefaultVisibleColumns,
  getDatasetById,
} from '@/lib/inventory/reports/catalog'
import { getGroupedColumnDefs } from '@/lib/inventory/reports/group-by'
import { ReportGroupChart } from './report-group-chart'
import type { ReportResponse } from '@/lib/inventory/reports/types'
import { getReportIcon } from './report-icon-map'

interface CatalogCategory {
  id: string
  name: string
  description: string
  datasets: ReportDatasetDef[]
}

interface CatalogResponse {
  categories: CatalogCategory[]
  datasets: ReportDatasetDef[]
}

const PAGE_SIZE = 50

export function ReportExplorer({
  initialDatasetId,
  initialSavedId,
}: {
  initialDatasetId?: string
  initialSavedId?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { families } = useFamilyOptions()
  const skipDatasetResetRef = useRef(false)
  const initialSavedLoadedRef = useRef(false)

  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [selectedDatasetId, setSelectedDatasetId] = useState(initialDatasetId ?? '')
  const [familyId, setFamilyId] = useState<string | null>(searchParams.get('familyId'))
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [reportData, setReportData] = useState<ReportResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [tableSearch, setTableSearch] = useState('')

  const [savedReports, setSavedReports] = useState<InventorySavedReport[]>([])
  const [activeSavedId, setActiveSavedId] = useState<string | null>(initialSavedId ?? null)
  const [activeSavedName, setActiveSavedName] = useState<string | null>(null)
  const [pinned, setPinned] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveAsNew, setSaveAsNew] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const selectedDataset = useMemo(
    () => getDatasetById(selectedDatasetId) ?? catalog?.datasets.find(d => d.id === selectedDatasetId),
    [selectedDatasetId, catalog]
  )

  const isGroupedView =
    !!filterValues.groupBy && filterValues.groupBy !== ALL_FILTER

  const groupByLabel = useMemo(() => {
    if (!isGroupedView || !selectedDataset) return undefined
    return selectedDataset.filters.find(f => f.key === 'groupBy')?.options?.find(
      o => o.value === filterValues.groupBy
    )?.label
  }, [isGroupedView, selectedDataset, filterValues.groupBy])

  const activeColumnDefs = useMemo(() => {
    if (isGroupedView && selectedDatasetId) {
      return getGroupedColumnDefs(selectedDatasetId)
    }
    return selectedDataset?.columns ?? []
  }, [isGroupedView, selectedDatasetId, selectedDataset])

  const applySavedReport = useCallback(
    (saved: InventorySavedReport) => {
      if (saved.kind !== 'DATASET') return
      skipDatasetResetRef.current = true
      setSelectedDatasetId(saved.targetId)
      setFamilyId(saved.familyId)
      setFilterValues(saved.filterValues)
      const ds = getDatasetById(saved.targetId)
      setVisibleColumns(
        saved.visibleColumns.length
          ? saved.visibleColumns
          : ds
            ? getDefaultVisibleColumns(ds)
            : []
      )
      setActiveSavedId(saved.id)
      setActiveSavedName(saved.name)
      setPinned(saved.pinned)
      setPage(1)
      router.replace(`/inventory/reports/explore?saved=${saved.id}`, { scroll: false })
    },
    [router]
  )

  useEffect(() => {
    fetch('/api/inventory/reports/catalog')
      .then(r => r.json())
      .then(data => {
        setCatalog(data)
        if (!selectedDatasetId && !initialSavedId && data.datasets?.[0]?.id) {
          setSelectedDatasetId(data.datasets[0].id)
        }
      })
      .catch(() => setError('No se pudo cargar el catálogo de reportes'))
      .finally(() => setCatalogLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/inventory/reports/saved?kind=DATASET')
      .then(r => (r.ok ? r.json() : { savedReports: [] }))
      .then(data => setSavedReports(data.savedReports ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!initialSavedId || catalogLoading || initialSavedLoadedRef.current) return
    initialSavedLoadedRef.current = true
    fetch(`/api/inventory/reports/saved/${initialSavedId}`)
      .then(r => {
        if (!r.ok) throw new Error('No se pudo cargar el reporte guardado')
        return r.json()
      })
      .then((saved: InventorySavedReport) => applySavedReport(saved))
      .catch(err => setError(err instanceof Error ? err.message : 'Error al cargar reporte guardado'))
  }, [initialSavedId, catalogLoading, applySavedReport])

  useEffect(() => {
    if (!selectedDataset) return
    if (skipDatasetResetRef.current) {
      skipDatasetResetRef.current = false
      return
    }
    setFilterValues(getDefaultFilterValues(selectedDataset.filters))
    setVisibleColumns(getDefaultVisibleColumns(selectedDataset))
    setPage(1)
    setActiveSavedId(null)
    setActiveSavedName(null)
    setPinned(false)
  }, [selectedDataset?.id])

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    params.set('dataset', selectedDatasetId)
    params.set('page', String(page))
    params.set('limit', String(PAGE_SIZE))
    if (familyId) params.set('familyId', familyId)
    if (!isGroupedView && visibleColumns.length) {
      params.set('columns', visibleColumns.join(','))
    }
    Object.entries(filterValues).forEach(([key, value]) => {
      if (value && value !== ALL_FILTER) params.set(key, value)
    })
    return params
  }, [selectedDatasetId, familyId, filterValues, visibleColumns, page, isGroupedView])

  const runReport = useCallback(async () => {
    if (!selectedDatasetId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inventory/reports/run?${buildParams()}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Error ${res.status}`)
      }
      setReportData(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al ejecutar reporte')
      setReportData(null)
    } finally {
      setLoading(false)
    }
  }, [buildParams, selectedDatasetId])

  useEffect(() => {
    if (selectedDatasetId && !catalogLoading) {
      runReport()
    }
  }, [selectedDatasetId, page, catalogLoading, familyId, filterValues, visibleColumns])

  const handleExportCsv = () => {
    const params = buildParams()
    params.set('format', 'csv')
    window.open(`/api/inventory/reports/run?${params}`, '_blank')
  }

  const persistSavedReport = async (name: string, asNew: boolean) => {
    if (!name.trim() || !selectedDatasetId) return
    setSaving(true)
    setSaveError(null)
    try {
      const payload = {
        name: name.trim(),
        kind: 'DATASET' as const,
        targetId: selectedDatasetId,
        familyId,
        filterValues,
        visibleColumns,
      }

      const shouldPatch = activeSavedId && !asNew
      const res = await fetch(
        shouldPatch ? `/api/inventory/reports/saved/${activeSavedId}` : '/api/inventory/reports/saved',
        {
          method: shouldPatch ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'No se pudo guardar')
      }

      const saved: InventorySavedReport = await res.json()
      setActiveSavedId(saved.id)
      setActiveSavedName(saved.name)
      setPinned(saved.pinned)
      setSavedReports(prev => {
        const rest = prev.filter(r => r.id !== saved.id)
        return [saved, ...rest]
      })
      setSaveDialogOpen(false)
      router.replace(`/inventory/reports/explore?saved=${saved.id}`, { scroll: false })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveReport = () => persistSavedReport(saveName, saveAsNew)

  const handleUpdateSaved = () => {
    if (activeSavedName) persistSavedReport(activeSavedName, false)
  }

  const handleDeleteSaved = async () => {
    if (!activeSavedId) return
    const res = await fetch(`/api/inventory/reports/saved/${activeSavedId}`, { method: 'DELETE' })
    if (!res.ok) return
    setSavedReports(prev => prev.filter(r => r.id !== activeSavedId))
    setActiveSavedId(null)
    setActiveSavedName(null)
    setPinned(false)
    router.replace(`/inventory/reports/explore?dataset=${selectedDatasetId}`, { scroll: false })
  }

  const handleTogglePin = async () => {
    if (!activeSavedId) return
    const nextPinned = !pinned
    const res = await fetch(`/api/inventory/reports/saved/${activeSavedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: nextPinned }),
    })
    if (!res.ok) return
    const saved: InventorySavedReport = await res.json()
    setPinned(saved.pinned)
    setSavedReports(prev => prev.map(r => (r.id === saved.id ? saved : r)))
  }

  const openSaveDialog = (asNew: boolean) => {
    setSaveError(null)
    setSaveAsNew(asNew)
    setSaveName(asNew ? '' : activeSavedName ?? '')
    setSaveDialogOpen(true)
  }

  const toggleColumn = (key: string) => {
    setVisibleColumns(prev =>
      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
    )
  }

  const filteredRows = useMemo(() => {
    if (!reportData?.data.length) return []
    if (!tableSearch.trim()) return reportData.data
    const q = tableSearch.toLowerCase()
    return reportData.data.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [reportData, tableSearch])

  const columnKeys = useMemo(() => {
    if (isGroupedView) return activeColumnDefs.map(c => c.key)
    if (visibleColumns.length) return visibleColumns
    if (reportData?.data[0]) return Object.keys(reportData.data[0])
    return selectedDataset?.columns.map(c => c.key) ?? []
  }, [isGroupedView, activeColumnDefs, visibleColumns, reportData, selectedDataset])

  if (catalogLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className='grid gap-4 lg:grid-cols-[280px_1fr]'>
        {/* Panel lateral: datasets */}
        <Card className='h-fit lg:sticky lg:top-4'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Fuente de datos</CardTitle>
            <CardDescription>Selecciona qué quieres analizar</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            {savedReports.length > 0 && (
              <div className='space-y-2 pb-3 border-b'>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5'>
                  <Bookmark className='h-3.5 w-3.5' />
                  Guardados
                </p>
                <div className='space-y-1'>
                  {savedReports.map(saved => (
                    <button
                      key={saved.id}
                      type='button'
                      onClick={() => applySavedReport(saved)}
                      className={`w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                        activeSavedId === saved.id
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'hover:bg-muted/60'
                      }`}
                    >
                      <span className='font-medium block truncate'>{saved.name}</span>
                      <span className='text-xs text-muted-foreground truncate'>
                        {getDatasetById(saved.targetId)?.name ?? saved.targetId}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {catalog?.categories.map(category => (
              category.datasets.length > 0 && (
                <div key={category.id} className='space-y-2'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    {category.name}
                  </p>
                  <div className='space-y-1'>
                    {category.datasets.map(ds => {
                      const Icon = getReportIcon(ds.icon)
                      const active = ds.id === selectedDatasetId
                      return (
                        <button
                          key={ds.id}
                          type='button'
                          onClick={() => {
                            setSelectedDatasetId(ds.id)
                            setPage(1)
                            router.replace(`/inventory/reports/explore?dataset=${ds.id}`, {
                              scroll: false,
                            })
                          }}
                          className={`w-full flex items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                            active
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'hover:bg-muted/60'
                          }`}
                        >
                          <Icon className='h-4 w-4 mt-0.5 shrink-0' />
                          <span>
                            <span className='font-medium block'>{ds.name}</span>
                            <span className='text-xs text-muted-foreground line-clamp-2'>
                              {ds.description}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            ))}
          </CardContent>
        </Card>

        {/* Panel principal */}
        <div className='space-y-4'>
          {selectedDataset && (
            <>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <h2 className='text-lg font-semibold'>{selectedDataset.name}</h2>
                    {activeSavedName && (
                      <Badge variant='secondary' className='gap-1'>
                        <Bookmark className='h-3 w-3' />
                        {activeSavedName}
                      </Badge>
                    )}
                    {isGroupedView && (
                      <Badge variant='outline'>Vista agrupada</Badge>
                    )}
                  </div>
                  <p className='text-sm text-muted-foreground'>{selectedDataset.description}</p>
                </div>
                <div className='flex flex-wrap gap-2'>
                  {activeSavedId ? (
                    <>
                      <Button variant='outline' size='sm' onClick={handleTogglePin}>
                        {pinned ? (
                          <PinOff className='h-4 w-4 mr-1.5' />
                        ) : (
                          <Pin className='h-4 w-4 mr-1.5' />
                        )}
                        {pinned ? 'Desanclar' : 'Anclar'}
                      </Button>
                      <Button variant='outline' size='sm' onClick={handleUpdateSaved} disabled={saving}>
                        {saving ? (
                          <Loader2 className='h-4 w-4 animate-spin mr-1.5' />
                        ) : (
                          <Bookmark className='h-4 w-4 mr-1.5' />
                        )}
                        Actualizar
                      </Button>
                      <Button variant='outline' size='sm' onClick={() => openSaveDialog(true)}>
                        <BookmarkPlus className='h-4 w-4 mr-1.5' />
                        Guardar como
                      </Button>
                      <Button variant='outline' size='sm' onClick={handleDeleteSaved}>
                        <Trash2 className='h-4 w-4 mr-1.5' />
                        Eliminar
                      </Button>
                    </>
                  ) : (
                    <Button variant='outline' size='sm' onClick={() => openSaveDialog(true)}>
                      <BookmarkPlus className='h-4 w-4 mr-1.5' />
                      Guardar consulta
                    </Button>
                  )}
                  <Button variant='outline' size='sm' onClick={runReport} disabled={loading}>
                    {loading ? (
                      <Loader2 className='h-4 w-4 animate-spin mr-1.5' />
                    ) : (
                      <RefreshCw className='h-4 w-4 mr-1.5' />
                    )}
                    Actualizar
                  </Button>
                  <Button size='sm' onClick={runReport} disabled={loading}>
                    <Play className='h-4 w-4 mr-1.5' />
                    Ejecutar
                  </Button>
                  <Button variant='outline' size='sm' onClick={handleExportCsv} disabled={!reportData?.data.length}>
                    <Download className='h-4 w-4 mr-1.5' />
                    CSV
                  </Button>
                </div>
              </div>

              {/* Filtros */}
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm flex items-center gap-2'>
                    <Filter className='h-4 w-4' />
                    Filtros
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                    {families.length > 1 && (
                      <div className='space-y-1'>
                        <Label>Área / Familia</Label>
                        <FamilyCombobox
                          families={families.map(f => ({
                            id: f.id,
                            name: f.name,
                            code: f.name.slice(0, 3).toUpperCase(),
                            color: f.color,
                          }))}
                          value={familyId ?? 'all'}
                          onValueChange={v => setFamilyId(v === 'all' ? null : v)}
                          allowAll
                          allowClear
                          popoverWidth='260px'
                        />
                      </div>
                    )}
                    {selectedDataset.filters.map(filter => (
                      <div key={filter.key} className='space-y-1'>
                        <Label>{filter.label}</Label>
                        {filter.type === 'date' ? (
                          <Input
                            type='date'
                            value={filterValues[filter.key] ?? ''}
                            onChange={e =>
                              setFilterValues(prev => ({ ...prev, [filter.key]: e.target.value }))
                            }
                          />
                        ) : filter.type === 'select' ? (
                          <Select
                            value={filterValues[filter.key] ?? filter.options?.[0]?.value ?? ALL_FILTER}
                            onValueChange={v =>
                              setFilterValues(prev => ({ ...prev, [filter.key]: v }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filter.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            placeholder={filter.placeholder}
                            value={filterValues[filter.key] ?? ''}
                            onChange={e =>
                              setFilterValues(prev => ({ ...prev, [filter.key]: e.target.value }))
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Columnas — ocultas en vista agrupada */}
              {!isGroupedView && (
              <Card>
                <CardHeader className='pb-3'>
                  <CardTitle className='text-sm flex items-center gap-2'>
                    <Columns3 className='h-4 w-4' />
                    Columnas visibles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='flex flex-wrap gap-2'>
                    {selectedDataset.columns.map(col => {
                      const active = visibleColumns.includes(col.key)
                      return (
                        <Badge
                          key={col.key}
                          variant={active ? 'default' : 'outline'}
                          className='cursor-pointer'
                          onClick={() => toggleColumn(col.key)}
                        >
                          {col.label}
                        </Badge>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
              )}

              {/* KPIs */}
              {reportData?.summary?.length ? (
                <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
                  {reportData.summary.map(item => (
                    <Card key={item.title}>
                      <CardContent className='pt-4'>
                        <p className='text-xs text-muted-foreground'>{item.title}</p>
                        <p className='text-2xl font-semibold'>{item.value}</p>
                        <p className='text-xs text-muted-foreground mt-1'>{item.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {isGroupedView && reportData?.data?.length ? (
                <ReportGroupChart
                  datasetId={selectedDatasetId}
                  rows={reportData.data as Record<string, unknown>[]}
                  groupByLabel={groupByLabel}
                />
              ) : null}

              {/* Tabla */}
              <Card>
                <CardHeader className='pb-3 flex-row items-center justify-between space-y-0'>
                  <CardTitle className='text-sm'>Resultados</CardTitle>
                  <div className='relative w-full max-w-xs'>
                    <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input
                      className='pl-8'
                      placeholder='Buscar en resultados...'
                      value={tableSearch}
                      onChange={e => setTableSearch(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {error && <p className='text-sm text-destructive'>{error}</p>}
                  {loading && !reportData ? (
                    <div className='flex justify-center py-12'>
                      <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
                    </div>
                  ) : filteredRows.length === 0 ? (
                    <p className='text-sm text-muted-foreground text-center py-8'>
                      No hay registros con los filtros actuales.
                    </p>
                  ) : (
                    <>
                      <div className='overflow-x-auto rounded-md border'>
                        <table className='w-full text-sm'>
                          <thead>
                            <tr className='border-b bg-muted/40'>
                              {columnKeys.map(key => (
                                <th
                                  key={key}
                                  className='px-3 py-2 text-left font-medium whitespace-nowrap'
                                >
                                  {activeColumnDefs.find(c => c.key === key)?.label ??
                                    selectedDataset.columns.find(c => c.key === key)?.label ??
                                    key}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row, idx) => (
                              <tr key={idx} className='border-b last:border-0 hover:bg-muted/20'>
                                {columnKeys.map(key => (
                                  <td key={key} className='px-3 py-2 whitespace-nowrap'>
                                    {String(row[key] ?? '—')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {reportData && reportData.totalCount > PAGE_SIZE && (
                        <div className='flex items-center justify-between text-sm'>
                          <span className='text-muted-foreground'>
                            {reportData.totalCount} registros totales
                          </span>
                          <div className='flex items-center gap-2'>
                            <Button
                              variant='outline'
                              size='sm'
                              disabled={page <= 1}
                              onClick={() => setPage(p => p - 1)}
                            >
                              <ChevronLeft className='h-4 w-4' />
                            </Button>
                            <span>Página {page}</span>
                            <Button
                              variant='outline'
                              size='sm'
                              disabled={page * PAGE_SIZE >= reportData.totalCount}
                              onClick={() => setPage(p => p + 1)}
                            >
                              <ChevronRight className='h-4 w-4' />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{saveAsNew ? 'Guardar como nueva consulta' : 'Guardar consulta'}</DialogTitle>
            <DialogDescription>
              Guarda los filtros y columnas actuales para reutilizarlos después.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='saved-report-name'>Nombre</Label>
            <Input
              id='saved-report-name'
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder='Ej. Equipos en mantenimiento — TI'
              maxLength={200}
            />
            {saveError && <p className='text-sm text-destructive'>{saveError}</p>}
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveReport} disabled={saving || !saveName.trim()}>
              {saving && <Loader2 className='h-4 w-4 animate-spin mr-1.5' />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
