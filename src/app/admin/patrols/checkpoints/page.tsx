'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  MapPin,
  QrCode,
  Download,
  Pencil,
  PowerOff,
  Loader2,
  Wifi,
  WifiOff,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
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
import { useDebounce } from '@/hooks/common/use-debounce'
import { QR_TYPE_LABELS_ES } from '@/lib/utils/patrol-utils'

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

interface Pagination {
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
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

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [downloadingQrId, setDownloadingQrId] = useState<string | null>(null)

  const fetchCheckpoints = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(includeInactive ? { includeInactive: 'true' } : {}),
      })
      const res = await fetch(`/api/patrols/checkpoints?${params}`)
      const data = await res.json()
      setCheckpoints(data.data ?? [])
      setPagination(data.pagination ?? null)
    } catch {
      toast({ title: 'Error', description: 'Error al cargar checkpoints', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, debouncedSearch, includeInactive, toast])

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

  useEffect(() => {
    if (session) fetchCheckpoints()
  }, [session, fetchCheckpoints])

  // Reset page on search change
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

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
      fetchCheckpoints()
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
      fetchCheckpoints()
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

  if (status === 'loading' || !session) return null

  return (
    <ModuleLayout
      title='Checkpoints'
      subtitle='Puntos de control físicos para patrullaje'
      loading={loading && checkpoints.length === 0}
      headerActions={
        <Button size='sm' onClick={openCreate}>
          <Plus className='h-4 w-4 sm:mr-2' />
          <span className='hidden sm:inline'>Nuevo Checkpoint</span>
        </Button>
      }
    >
      {/* Filtros */}
      <div className='flex flex-col sm:flex-row gap-3 mb-4'>
        <div className='relative flex-1'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='Buscar checkpoints...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='pl-9'
          />
        </div>
        <div className='flex items-center gap-2'>
          <Switch
            id='show-inactive'
            checked={includeInactive}
            onCheckedChange={v => {
              setIncludeInactive(v)
              setPage(1)
            }}
          />
          <Label htmlFor='show-inactive' className='text-sm cursor-pointer'>
            Mostrar inactivos
          </Label>
        </div>
        <Button variant='outline' size='sm' onClick={fetchCheckpoints} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Tabla / Cards */}
      {loading ? (
        <div className='flex items-center justify-center py-16'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </div>
      ) : checkpoints.length === 0 ? (
        <Card>
          <CardContent className='flex flex-col items-center justify-center py-16 text-center'>
            <MapPin className='h-12 w-12 text-muted-foreground/30 mb-4' />
            <p className='text-sm font-medium text-muted-foreground'>No hay checkpoints</p>
            <p className='text-xs text-muted-foreground mt-1'>
              Crea el primer checkpoint con el botón de arriba
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className='space-y-3 sm:hidden'>
            {checkpoints.map(cp => (
              <Card key={cp.id} className={!cp.isActive ? 'opacity-60' : ''}>
                <CardContent className='p-4 space-y-2'>
                  <div className='flex items-start justify-between gap-2'>
                    <div className='min-w-0'>
                      <p className='font-medium text-sm truncate'>{cp.name}</p>
                      <p className='text-xs text-muted-foreground truncate'>{cp.location}</p>
                    </div>
                    <div className='flex gap-1 flex-shrink-0'>
                      <Badge variant='outline' className='text-xs'>
                        {QR_TYPE_LABELS_ES[cp.qrType] ?? cp.qrType}
                      </Badge>
                      {!cp.isActive && (
                        <Badge variant='secondary' className='text-xs'>
                          Inactivo
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                    {cp.hasConnectivity ? (
                      <Wifi className='h-3 w-3' />
                    ) : (
                      <WifiOff className='h-3 w-3' />
                    )}
                    <span>{cp.hasConnectivity ? 'Con conectividad' : 'Sin conectividad'}</span>
                    {cp.isSensitive && (
                      <>
                        <ShieldAlert className='h-3 w-3 text-orange-500' />
                        <span className='text-orange-600 dark:text-orange-400'>Sensible</span>
                      </>
                    )}
                  </div>
                  <div className='flex gap-2 pt-1'>
                    <Button
                      size='sm'
                      variant='outline'
                      className='flex-1'
                      onClick={() => openEdit(cp)}
                    >
                      <Pencil className='h-3 w-3 mr-1' /> Editar
                    </Button>
                    <Button
                      size='sm'
                      variant='outline'
                      onClick={() => handleDownloadQR(cp)}
                      disabled={downloadingQrId === cp.id}
                    >
                      {downloadingQrId === cp.id ? (
                        <Loader2 className='h-3 w-3 animate-spin' />
                      ) : (
                        <Download className='h-3 w-3' />
                      )}
                    </Button>
                    {cp.isActive && (
                      <Button
                        size='sm'
                        variant='outline'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setDeactivatingId(cp.id)}
                      >
                        <PowerOff className='h-3 w-3' />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className='hidden sm:block rounded-lg border overflow-hidden'>
            <table className='w-full text-sm'>
              <thead className='bg-muted/50'>
                <tr>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Nombre</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell'>
                    Ubicación
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Tipo QR</th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell'>
                    Conectividad
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell'>
                    Sensible
                  </th>
                  <th className='text-left px-4 py-3 font-medium text-muted-foreground'>Estado</th>
                  <th className='w-32' />
                </tr>
              </thead>
              <tbody className='divide-y'>
                {checkpoints.map(cp => (
                  <tr
                    key={cp.id}
                    className={`hover:bg-muted/30 transition-colors ${!cp.isActive ? 'opacity-60' : ''}`}
                  >
                    <td className='px-4 py-3 font-medium'>{cp.name}</td>
                    <td className='px-4 py-3 text-muted-foreground hidden md:table-cell max-w-[200px] truncate'>
                      {cp.location}
                    </td>
                    <td className='px-4 py-3'>
                      <Badge variant='outline' className='text-xs'>
                        <QrCode className='h-3 w-3 mr-1' />
                        {QR_TYPE_LABELS_ES[cp.qrType] ?? cp.qrType}
                      </Badge>
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell'>
                      {cp.hasConnectivity ? (
                        <span className='flex items-center gap-1 text-xs'>
                          <Wifi className='h-3 w-3 text-green-500' /> Sí
                        </span>
                      ) : (
                        <span className='flex items-center gap-1 text-xs'>
                          <WifiOff className='h-3 w-3 text-muted-foreground' /> No
                        </span>
                      )}
                    </td>
                    <td className='px-4 py-3 hidden lg:table-cell text-xs'>
                      {cp.isSensitive ? (
                        <span className='text-orange-600 dark:text-orange-400'>Sí</span>
                      ) : (
                        'No'
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <Badge variant={cp.isActive ? 'default' : 'secondary'} className='text-xs'>
                        {cp.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-1 justify-end'>
                        <Button size='sm' variant='ghost' onClick={() => openEdit(cp)}>
                          <Pencil className='h-3.5 w-3.5' />
                        </Button>
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
                        {cp.isActive && (
                          <Button
                            size='sm'
                            variant='ghost'
                            className='text-destructive hover:text-destructive'
                            onClick={() => setDeactivatingId(cp.id)}
                            title='Desactivar'
                          >
                            <PowerOff className='h-3.5 w-3.5' />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <p className='text-xs text-muted-foreground'>
                {pagination.total} checkpoint{pagination.total !== 1 ? 's' : ''}
              </p>
              <div className='flex gap-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasPrev}
                  onClick={() => setPage(p => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasNext}
                  onClick={() => setPage(p => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}

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
                    Determina si usa QR dinámico o estático
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
                Sin conectividad → QR Estático. Se requerirá foto en cada check-in.
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
    </ModuleLayout>
  )
}
