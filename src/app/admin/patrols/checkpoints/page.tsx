'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  MapPin,
  Monitor,
  Copy,
  ExternalLink,
  Pencil,
  Download,
  PowerOff,
  Power,
  Loader2,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { ExportButton } from '@/components/common/export-button'
import { useModuleData } from '@/hooks/common/use-module-data'
import { usePagination } from '@/hooks/common/use-pagination'
import { useExport } from '@/hooks/common/use-export'
import { createCheckpointColumns } from '@/components/patrols/patrol-columns'
import { PATROL_CHECKPOINTS_EXPORT_COLUMNS } from '@/lib/utils/patrol-utils'

interface Checkpoint {
  id: string
  familyId: string
  name: string
  description: string | null
  location: string
  latitude: number | null
  longitude: number | null
  geofenceRadiusMeters: number | null
  hasConnectivity: boolean
  isSensitive: boolean
  isActive: boolean
  qrType: 'DYNAMIC' | 'STATIC'
  createdAt: string
  updatedAt: string
}

interface Family {
  id: string
  name: string
  code: string
}

const EMPTY_FORM = {
  familyId: '',
  name: '',
  description: '',
  location: '',
  latitude: '',
  longitude: '',
  geofenceRadiusMeters: '',
  hasConnectivity: true,
  isSensitive: false,
}

export default function CheckpointsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [includeInactive, setIncludeInactive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null)
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null)
  const [displayModalOpen, setDisplayModalOpen] = useState(false)
  const [selectedCheckpointForDisplay, setSelectedCheckpointForDisplay] =
    useState<Checkpoint | null>(null)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // Build endpoint with params
  const endpoint = useMemo(() => {
    const params = new URLSearchParams()
    params.append('limit', '100')
    if (includeInactive) params.append('includeInactive', 'true')
    if (debouncedSearch) params.append('search', debouncedSearch)
    return `/api/patrols/checkpoints?${params.toString()}`
  }, [debouncedSearch, includeInactive])

  // Fetch data with useModuleData
  const {
    data: checkpointsRaw,
    loading,
    error,
    reload,
  } = useModuleData<Checkpoint>({
    endpoint,
    initialLoad: true,
  })

  const checkpoints = checkpointsRaw || []

  // Pagination
  const pagination = usePagination(checkpoints, { pageSize: 20 })

  // Export
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'checkpoints-patrullas',
    title: 'Checkpoints',
    subtitle: `Exportado el ${new Date().toLocaleDateString('es-EC')} • ${checkpoints.length} checkpoints`,
    getData: () => checkpoints,
    columns: PATROL_CHECKPOINTS_EXPORT_COLUMNS,
  })

  const fetchFamilies = useCallback(async () => {
    try {
      const res = await fetch('/api/families?includeInactive=false')
      const data = await res.json()
      if (data.success) setFamilies(data.data)
    } catch {
      // silencioso
    }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    fetchFamilies()
  }, [session, status, router, fetchFamilies])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, familyId: families[0]?.id ?? '' })
    setDialogOpen(true)
  }

  const openEdit = (cp: Checkpoint) => {
    setEditingId(cp.id)
    setForm({
      familyId: cp.familyId,
      name: cp.name,
      description: cp.description ?? '',
      location: cp.location,
      latitude: cp.latitude != null ? String(cp.latitude) : '',
      longitude: cp.longitude != null ? String(cp.longitude) : '',
      geofenceRadiusMeters: cp.geofenceRadiusMeters != null ? String(cp.geofenceRadiusMeters) : '',
      hasConnectivity: cp.hasConnectivity,
      isSensitive: cp.isSensitive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.familyId) {
      toast({
        title: 'Campos requeridos',
        description: 'Nombre, ubicación y área son obligatorios',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const body = {
        familyId: form.familyId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        location: form.location.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : undefined,
        longitude: form.longitude ? parseFloat(form.longitude) : undefined,
        geofenceRadiusMeters: form.geofenceRadiusMeters
          ? parseInt(form.geofenceRadiusMeters)
          : undefined,
        hasConnectivity: form.hasConnectivity,
        isSensitive: form.isSensitive,
      }

      const res = editingId
        ? await fetch(`/api/patrols/checkpoints/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/patrols/checkpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')

      toast({ title: editingId ? 'Checkpoint actualizado' : 'Checkpoint creado' })
      setDialogOpen(false)
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al guardar',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/checkpoints/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al desactivar')
      toast({ title: 'Checkpoint desactivado' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setDeactivatingId(null)
    }
  }

  const handleReactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/checkpoints/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al reactivar')
      toast({ title: 'Checkpoint reactivado' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setReactivatingId(null)
    }
  }

  const handlePermanentDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/patrols/checkpoints/${id}?permanent=true`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al eliminar permanentemente')
      toast({ title: 'Checkpoint eliminado permanentemente' })
      reload()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setPermanentlyDeletingId(null)
    }
  }

  const handleDownloadQR = async (cp: Checkpoint) => {
    setDownloadingQrId(cp.id)
    try {
      const res = await fetch(`/api/patrols/checkpoints/${cp.id}/qr`)
      if (!res.ok) throw new Error('Error al generar QR')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qr-${cp.name.replace(/\s+/g, '-').toLowerCase()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Error al descargar QR',
        variant: 'destructive',
      })
    } finally {
      setDownloadingQrId(null)
    }
  }

  const openDisplayModal = (cp: Checkpoint) => {
    setSelectedCheckpointForDisplay(cp)
    setDisplayModalOpen(true)
  }

  const copyDisplayUrl = () => {
    if (!selectedCheckpointForDisplay) return
    const url = `${window.location.origin}/patrol-checkpoint-display/${selectedCheckpointForDisplay.id}`
    navigator.clipboard.writeText(url)
    toast({ title: 'URL copiada al portapapeles' })
  }

  if (status === 'loading' || !session) return null

  // Create columns with callbacks
  const columns = createCheckpointColumns({
    onEdit: openEdit,
    onDownloadQR: handleDownloadQR,
    onDeactivate: id => setDeactivatingId(id),
    onReactivate: id => setReactivatingId(id),
    onPermanentDelete: id => setPermanentlyDeletingId(id),
    onOpenDisplay: openDisplayModal,
    downloadingQrId,
    isSuperAdmin,
  })

  // Pagination config
  const paginationConfig = {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: checkpoints.length,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  }

  return (
    <ModuleLayout
      title='Checkpoints'
      subtitle='Puntos de control físicos para patrullaje'
      loading={loading && checkpoints.length === 0}
      error={error}
      onRetry={reload}
      headerActions={
        <Button size='sm' onClick={openCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Nuevo Checkpoint</span>
        </Button>
      }
    >
      {/* Filtros custom */}
      <div className='flex flex-col sm:flex-row gap-3 mb-4'>
        <div className='relative flex-1'>
          <Input
            placeholder='Buscar checkpoints...'
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive-cp'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              pagination.goToPage(1)
            }}
          />
          <Label htmlFor='show-inactive-cp' className='text-sm cursor-pointer'>
            Mostrar inactivos
          </Label>
        </div>
      </div>

      {/* DataTable */}
      <DataTable
        title='Checkpoints'
        description={`Gestión de puntos de control (${checkpoints.length} checkpoints)`}
        data={checkpoints}
        columns={columns}
        loading={loading}
        error={error}
        pagination={paginationConfig}
        onRefresh={reload}
        externalSearch={true}
        hideInternalFilters={true}
        rowActions={(cp: Checkpoint) => (
          <div className='flex items-center gap-1'>
            <Button size='sm' variant='ghost' onClick={() => openEdit(cp)}>
              <Pencil className='h-3.5 w-3.5' />
            </Button>
            {cp.qrType === 'DYNAMIC' && cp.isActive && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => openDisplayModal(cp)}
                title='Ver pantalla'
              >
                <Monitor className='h-3.5 w-3.5' />
              </Button>
            )}
            <Button
              size='sm'
              variant='ghost'
              onClick={() => handleDownloadQR(cp)}
              disabled={downloadingQrId === cp.id}
              title='Descargar QR'
            >
              {downloadingQrId === cp.id ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Download className='h-3.5 w-3.5' />
              )}
            </Button>
            {cp.isActive ? (
              <Button
                size='sm'
                variant='ghost'
                className='text-destructive hover:text-destructive'
                onClick={() => setDeactivatingId(cp.id)}
                title='Desactivar'
              >
                <PowerOff className='h-3.5 w-3.5' />
              </Button>
            ) : (
              <Button
                size='sm'
                variant='ghost'
                className='text-green-600 hover:text-green-700 dark:text-green-400'
                onClick={() => setReactivatingId(cp.id)}
                title='Reactivar'
              >
                <Power className='h-3.5 w-3.5' />
              </Button>
            )}
            {isSuperAdmin && (
              <Button
                size='sm'
                variant='ghost'
                className='text-red-700 hover:text-red-800 dark:text-red-500'
                onClick={() => setPermanentlyDeletingId(cp.id)}
                title='Eliminar permanentemente'
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            )}
          </div>
        )}
        actions={
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={checkpoints.length === 0}
          />
        }
        emptyState={{
          icon: <MapPin className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
          title: 'No hay checkpoints',
          description: 'Crea el primer checkpoint con el botón de arriba',
        }}
      />

      {/* ── Dialog crear/editar ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Checkpoint' : 'Nuevo Checkpoint'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Modifica los datos del checkpoint.'
                : 'Crea un nuevo punto de control físico.'}
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1'>
            {/* Área */}
            <div className='space-y-1.5'>
              <Label htmlFor='cp-family' className='text-sm'>
                Área <span className='text-destructive'>*</span>
              </Label>
              <select
                id='cp-family'
                value={form.familyId}
                onChange={e => setForm(f => ({ ...f, familyId: e.target.value }))}
                className='w-full h-9 rounded-md border border-input bg-background px-3 text-sm'
                disabled={saving || !!editingId}
              >
                <option value=''>Selecciona un área</option>
                {families.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Nombre */}
            <div className='space-y-1.5'>
              <Label htmlFor='cp-name' className='text-sm'>
                Nombre <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='cp-name'
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder='Ej: Entrada Principal'
                disabled={saving}
                maxLength={200}
              />
            </div>

            {/* Ubicación */}
            <div className='space-y-1.5'>
              <Label htmlFor='cp-location' className='text-sm'>
                Descripción de ubicación <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='cp-location'
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                placeholder='Ej: Planta baja, junto a ascensores'
                disabled={saving}
                maxLength={500}
              />
            </div>

            {/* Descripción */}
            <div className='space-y-1.5'>
              <Label htmlFor='cp-desc' className='text-sm'>
                Descripción (opcional)
              </Label>
              <Textarea
                id='cp-desc'
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder='Notas adicionales sobre este checkpoint...'
                disabled={saving}
                rows={2}
              />
            </div>

            {/* GPS */}
            <div className='grid grid-cols-2 gap-3'>
              <div className='space-y-1.5'>
                <Label htmlFor='cp-lat' className='text-sm'>
                  Latitud (opcional)
                </Label>
                <Input
                  id='cp-lat'
                  type='number'
                  step='any'
                  value={form.latitude}
                  onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                  placeholder='-0.1234'
                  disabled={saving}
                />
              </div>
              <div className='space-y-1.5'>
                <Label htmlFor='cp-lng' className='text-sm'>
                  Longitud (opcional)
                </Label>
                <Input
                  id='cp-lng'
                  type='number'
                  step='any'
                  value={form.longitude}
                  onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                  placeholder='-78.5678'
                  disabled={saving}
                />
              </div>
            </div>

            {/* Radio geofence */}
            <div className='space-y-1.5'>
              <Label htmlFor='cp-radius' className='text-sm'>
                Radio de geofence (metros, opcional)
              </Label>
              <Input
                id='cp-radius'
                type='number'
                min={1}
                max={10000}
                value={form.geofenceRadiusMeters}
                onChange={e => setForm(f => ({ ...f, geofenceRadiusMeters: e.target.value }))}
                placeholder='Deja vacío para usar el default del área'
                disabled={saving}
              />
            </div>

            {/* Switches */}
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <div>
                  <Label className='text-sm font-medium'>Tiene conectividad</Label>
                  <p className='text-xs text-muted-foreground'>
                    ON = QR Dinámico (cambia constantemente, máxima seguridad)
                    <br />
                    OFF = QR Estático (permanente, ideal para imprimir)
                  </p>
                </div>
                <Switch
                  checked={form.hasConnectivity}
                  onCheckedChange={v => setForm(f => ({ ...f, hasConnectivity: v }))}
                  disabled={saving}
                />
              </div>
              <div className='flex items-center justify-between'>
                <div>
                  <Label className='text-sm font-medium'>Punto sensible</Label>
                  <p className='text-xs text-muted-foreground'>
                    Requiere foto obligatoria en cada check-in
                  </p>
                </div>
                <Switch
                  checked={form.isSensitive}
                  onCheckedChange={v => setForm(f => ({ ...f, isSensitive: v }))}
                  disabled={saving}
                />
              </div>
            </div>

            {!form.hasConnectivity && (
              <div className='p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 text-xs text-orange-700 dark:text-orange-400'>
                Sin conectividad → QR Estático.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className='h-4 w-4 mr-2 animate-spin' /> : null}
              {editingId ? 'Guardar cambios' : 'Crear checkpoint'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm deactivate ── */}
      <AlertDialog open={!!deactivatingId} onOpenChange={() => setDeactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              El checkpoint no podrá agregarse a nuevas rutas, pero se preservará el historial de
              check-ins.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={() => deactivatingId && handleDeactivate(deactivatingId)}
            >
              Desactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm reactivate ── */}
      <AlertDialog open={!!reactivatingId} onOpenChange={() => setReactivatingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Reactivar checkpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              El checkpoint podrá agregarse a nuevas rutas nuevamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-green-700 text-white hover:bg-green-800'
              onClick={() => reactivatingId && handleReactivate(reactivatingId)}
            >
              Reactivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Confirm permanent delete ── */}
      <AlertDialog
        open={!!permanentlyDeletingId}
        onOpenChange={() => setPermanentlyDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar checkpoint PERMANENTEMENTE?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El checkpoint se eliminará completamente de la base
              de datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className='bg-red-700 text-white hover:bg-red-800'
              onClick={() => permanentlyDeletingId && handlePermanentDelete(permanentlyDeletingId)}
            >
              Eliminar Permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Modal de pantalla QR ── */}
      <Dialog open={displayModalOpen} onOpenChange={setDisplayModalOpen}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>Pantalla de Visualización QR</DialogTitle>
            <DialogDescription>
              Abre esta URL en la pantalla física donde los guardias escanearán el QR.
            </DialogDescription>
          </DialogHeader>

          {selectedCheckpointForDisplay && (
            <div className='space-y-4 py-2'>
              <div className='space-y-2'>
                <Label className='text-sm'>Checkpoint</Label>
                <p className='font-medium'>{selectedCheckpointForDisplay.name}</p>
                <p className='text-sm text-muted-foreground'>
                  {selectedCheckpointForDisplay.location}
                </p>
              </div>

              <div className='space-y-2'>
                <Label className='text-sm'>URL de la pantalla</Label>
                <div className='flex gap-2'>
                  <Input
                    readOnly
                    value={`${window.location.origin}/patrol-checkpoint-display/${selectedCheckpointForDisplay.id}`}
                    className='font-mono text-xs'
                  />
                  <Button variant='outline' onClick={copyDisplayUrl}>
                    <Copy className='h-4 w-4' />
                  </Button>
                </div>
              </div>

              <div className='pt-2'>
                <Button
                  className='w-full'
                  onClick={() => {
                    window.open(
                      `/patrol-checkpoint-display/${selectedCheckpointForDisplay.id}`,
                      '_blank'
                    )
                  }}
                >
                  <ExternalLink className='h-4 w-4 mr-2' />
                  Abrir en nueva pestaña
                </Button>
              </div>

              <div className='p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400'>
                <strong>Nota:</strong> Esta página está diseñada para mostrarse en una pantalla
                física (tableta, monitor, etc.) donde los guardias pueden escanear el QR. Solo los
                administradores pueden acceder a esta configuración.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant='outline' onClick={() => setDisplayModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleLayout>
  )
}
