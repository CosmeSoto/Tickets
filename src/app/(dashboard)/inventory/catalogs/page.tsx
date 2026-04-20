'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, Loader2, Boxes, Warehouse, FileSignature, Tag, Ruler, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { useFetch } from '@/hooks/common/use-fetch'
import { useFormSubmit } from '@/hooks/common/use-form-submit'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CatalogItem {
  id: string; code?: string; name: string; symbol?: string
  description?: string; isActive: boolean; order?: number
  familyId?: string | null; family?: { name: string; color?: string | null } | null
  location?: string | null; manager?: { name: string } | null
}

interface Family { id: string; name: string; color?: string | null }

// ── Configuración de cada catálogo ────────────────────────────────────────────

interface CatalogConfig {
  key: string
  label: string
  icon: React.ElementType
  apiGet: string
  apiPost: string
  apiPut: (id: string) => string
  apiDelete: (id: string) => string
  hasFamily: boolean
  hasSymbol: boolean
  hasLocation: boolean
  hasCode: boolean
  deleteVerb: string   // 'eliminar' | 'desactivar'
}

const CATALOGS: CatalogConfig[] = [
  {
    key: 'equipment-types', label: 'Tipos de Equipo', icon: Boxes,
    apiGet: '/api/admin/equipment-types?includeInactive=true',
    apiPost: '/api/admin/equipment-types',
    apiPut: (id) => `/api/admin/equipment-types/${id}`,
    apiDelete: (id) => `/api/admin/equipment-types/${id}`,
    hasFamily: true, hasSymbol: false, hasLocation: false, hasCode: true, deleteVerb: 'eliminar',
  },
  {
    key: 'consumable-types', label: 'Tipos de Material MRO', icon: Tag,
    apiGet: '/api/inventory/consumable-types?includeInactive=true',
    apiPost: '/api/inventory/consumable-types',
    apiPut: (id) => `/api/inventory/consumable-types/${id}`,
    apiDelete: (id) => `/api/inventory/consumable-types/${id}`,
    hasFamily: true, hasSymbol: false, hasLocation: false, hasCode: true, deleteVerb: 'eliminar',
  },
  {
    key: 'license-types', label: 'Tipos de Licencia', icon: FileSignature,
    apiGet: '/api/inventory/license-types?includeInactive=true',
    apiPost: '/api/inventory/license-types',
    apiPut: (id) => `/api/inventory/license-types/${id}`,
    apiDelete: (id) => `/api/inventory/license-types/${id}`,
    hasFamily: true, hasSymbol: false, hasLocation: false, hasCode: true, deleteVerb: 'eliminar',
  },
  {
    key: 'supplier-types', label: 'Tipos de Proveedor', icon: Building2,
    apiGet: '/api/inventory/supplier-types?includeInactive=true',
    apiPost: '/api/inventory/supplier-types',
    apiPut: (id) => `/api/inventory/supplier-types/${id}`,
    apiDelete: (id) => `/api/inventory/supplier-types/${id}`,
    hasFamily: true, hasSymbol: false, hasLocation: false, hasCode: true, deleteVerb: 'eliminar',
  },
  {
    key: 'units-of-measure', label: 'Unidades de Medida', icon: Ruler,
    apiGet: '/api/inventory/units-of-measure?includeInactive=true',
    apiPost: '/api/inventory/units-of-measure',
    apiPut: (id) => `/api/inventory/units-of-measure/${id}`,
    apiDelete: (id) => `/api/inventory/units-of-measure/${id}`,
    hasFamily: false, hasSymbol: true, hasLocation: false, hasCode: true, deleteVerb: 'eliminar',
  },
  {
    key: 'warehouses', label: 'Bodegas', icon: Warehouse,
    apiGet: '/api/inventory/warehouses?includeInactive=true',
    apiPost: '/api/inventory/warehouses',
    apiPut: (id) => `/api/inventory/warehouses/${id}`,
    apiDelete: (id) => `/api/inventory/warehouses/${id}`,
    hasFamily: true, hasSymbol: false, hasLocation: true, hasCode: false, deleteVerb: 'desactivar',
  },
]

// ── Componente principal ──────────────────────────────────────────────────────

function CatalogsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const activeTab = searchParams.get('tab') ?? CATALOGS[0].key
  const catalog = CATALOGS.find(c => c.key === activeTab) ?? CATALOGS[0]

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', symbol: '', description: '', order: 999, familyId: '', location: '' })

  const isAdmin = session?.user?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'loading') return
    if (!session) { router.push('/login'); return }
    if (!isAdmin && session.user.role !== 'TECHNICIAN') { router.push('/unauthorized'); return }
  }, [session, status, router, isAdmin])

  // Cargar familias con useFetch
  const { data: families } = useFetch<Family>('/api/inventory/families', {
    transform: (d) => d.families ?? [],
    enabled: status === 'authenticated',
  })

  // Cargar items del catálogo activo con useFetch
  const { data: items, loading, reload: fetchItems } = useFetch<CatalogItem>(catalog.apiGet, {
    transform: (d) => Array.isArray(d) ? d : (d.types ?? d.warehouses ?? d.units ?? []),
    enabled: status === 'authenticated',
  })

  // Submit de formulario (crear/editar) — endpoint dinámico según editingItem
  const { submit: submitCatalogForm, loading: submitting } = useFormSubmit(
    editingItem ? catalog.apiPut(editingItem.id) : catalog.apiPost,
    {
      method: editingItem ? 'PUT' : 'POST',
      successMessage: editingItem ? 'Actualizado' : 'Creado',
      successDescription: form.name,
      onSuccess: () => { setDialogOpen(false); fetchItems() },
    }
  )

  const openCreate = () => {
    setEditingItem(null)
    setForm({ code: '', name: '', symbol: '', description: '', order: 999, familyId: '', location: '' })
    setDialogOpen(true)
  }

  const openEdit = (item: CatalogItem) => {
    setEditingItem(item)
    setForm({
      code: item.code ?? '',
      name: item.name,
      symbol: item.symbol ?? '',
      description: item.description ?? '',
      order: item.order ?? 999,
      familyId: item.familyId ?? '',
      location: item.location ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { name: form.name, description: form.description || undefined, order: form.order }
    if (!editingItem && catalog.hasCode) body.code = form.code
    if (catalog.hasSymbol) body.symbol = form.symbol
    if (catalog.hasFamily) body.familyId = form.familyId || null
    if (catalog.hasLocation) body.location = form.location || undefined
    await submitCatalogForm(body)
  }

  const confirmDelete = async () => {
    if (!deletingItem) return
    setDeleting(true)
    try {
      const method = catalog.deleteVerb === 'desactivar' ? 'PATCH' : 'DELETE'
      const res = await fetch(catalog.apiDelete(deletingItem.id), { method })
      if (res.ok) {
        toast({ title: catalog.deleteVerb === 'desactivar' ? 'Desactivado' : 'Eliminado', description: deletingItem.name })
        setDeletingItem(null)
        fetchItems()
      } else {
        const err = await res.json()
        toast({ title: 'Error', description: err.error || 'No se pudo completar la acción', variant: 'destructive' })
      }
    } catch { toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' }) }
    finally { setDeleting(false) }
  }

  const setTab = (key: string) => router.push(`/inventory/catalogs?tab=${key}`)

  // Export del catálogo activo
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: `catalogo-${catalog.key}`,
    title: catalog.label,
    getData: () => items,
    columns: [
      ...(catalog.hasCode ? [{ key: 'code', label: 'Código', format: (v: any) => v ?? '' }] : []),
      { key: 'name', label: 'Nombre' },
      ...(catalog.hasSymbol ? [{ key: 'symbol', label: 'Símbolo', format: (v: any) => v ?? '' }] : []),
      ...(catalog.hasFamily ? [{ key: 'family', label: 'Área', format: (v: any) => v?.name ?? 'Global' }] : []),
      ...(catalog.hasLocation ? [{ key: 'location', label: 'Ubicación', format: (v: any) => v ?? '' }] : []),
      { key: 'isActive', label: 'Estado', format: (v: any) => v ? 'Activo' : 'Inactivo' },
    ],
  })

  return (
    <ModuleLayout title="Catálogos" subtitle="Gestiona los tipos y configuraciones del inventario">
      <div className="space-y-6">

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-border pb-0">
          {CATALOGS.map(c => {
            const Icon = c.icon
            const isActive = c.key === activeTab
            return (
              <button
                key={c.key}
                onClick={() => setTab(c.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{c.label}</span>
              </button>
            )
          })}
        </div>

        {/* Header de la tab activa */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-base font-semibold">{catalog.label}</h2>
          <div className="flex items-center gap-2">
            <ExportButton
              onExportCSV={exportCSV}
              onExportExcel={exportExcel}
              onExportPDF={exportPDF}
              loading={exporting}
              disabled={items.length === 0}
              size="sm"
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo
            </Button>
          </div>
        </div>

        {/* Tabla */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {catalog.hasCode && <TableHead>Código</TableHead>}
                <TableHead>Nombre</TableHead>
                {catalog.hasSymbol && <TableHead>Símbolo</TableHead>}
                {catalog.hasFamily && <TableHead>Familia</TableHead>}
                {catalog.hasLocation && <TableHead>Ubicación</TableHead>}
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Cargando...</TableCell></TableRow>
              ) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No hay elementos. Crea el primero.</TableCell></TableRow>
              ) : items.map(item => (
                <TableRow
                  key={item.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => openEdit(item)}
                >
                  {catalog.hasCode && <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>}
                  <TableCell className="font-medium">
                    {item.name}
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                  </TableCell>
                  {catalog.hasSymbol && <TableCell className="font-mono">{item.symbol}</TableCell>}
                  {catalog.hasFamily && (
                    <TableCell>
                      {item.family ? (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{item.family.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Global</span>
                      )}
                    </TableCell>
                  )}
                  {catalog.hasLocation && <TableCell className="text-sm text-muted-foreground">{item.location ?? '—'}</TableCell>}
                  <TableCell>
                    <Badge variant={item.isActive ? 'default' : 'secondary'}>
                      {item.isActive ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost" size="icon"
                          title={catalog.deleteVerb === 'desactivar' ? (item.isActive ? 'Desactivar' : 'Activar') : 'Eliminar'}
                          onClick={() => setDeletingItem(item)}
                          className={catalog.deleteVerb === 'eliminar' ? 'text-destructive hover:text-destructive' : ''}
                        >
                          {catalog.deleteVerb === 'desactivar'
                            ? (item.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />)
                            : <Trash2 className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog crear/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingItem ? `Editar ${catalog.label.slice(0, -1)}` : `Nuevo en ${catalog.label}`}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {catalog.hasCode && !editingItem && (
              <div className="space-y-1">
                <Label>Código <span className="text-destructive">*</span></Label>
                <Input
                  value={form.code}
                  onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') }))}
                  placeholder="Ej: LAPTOP"
                  maxLength={20}
                  required
                />
                <p className="text-xs text-muted-foreground">No se puede cambiar después de creado.</p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Nombre <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required autoFocus={!!editingItem} />
            </div>
            {catalog.hasSymbol && (
              <div className="space-y-1">
                <Label>Símbolo <span className="text-destructive">*</span></Label>
                <Input value={form.symbol} onChange={e => setForm(p => ({ ...p, symbol: e.target.value }))} placeholder="Ej: kg, L, u" maxLength={10} required={!editingItem} />
              </div>
            )}
            {catalog.hasLocation && (
              <div className="space-y-1">
                <Label>Ubicación</Label>
                <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="Ej: Piso 2, Edificio A" />
              </div>
            )}
            {catalog.hasFamily && (
              <div className="space-y-1">
                <Label>Familia <span className="text-xs font-normal text-muted-foreground">(opcional)</span></Label>
                <SearchableSelect
                  options={families}
                  value={form.familyId}
                  onChange={v => setForm(p => ({ ...p, familyId: v }))}
                  placeholder="Global — disponible para todas las familias"
                />
                <p className="text-xs text-muted-foreground">
                  Sin familia: visible en todas las familias. Con familia: aparece solo en esa familia.
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Descripción</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Descripción opcional" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Guardar cambios' : 'Crear'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar eliminar/desactivar */}
      <AlertDialog open={!!deletingItem} onOpenChange={o => !o && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {catalog.deleteVerb === 'desactivar' ? '¿Cambiar estado?' : `¿Eliminar "${deletingItem?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {catalog.deleteVerb === 'desactivar'
                ? `La bodega "${deletingItem?.name}" será ${deletingItem?.isActive ? 'desactivada' : 'activada'}.`
                : `Se eliminará "${deletingItem?.name}". Si tiene elementos asociados, se desactivará en su lugar.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleting}
              className={catalog.deleteVerb === 'eliminar' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {deleting ? 'Procesando...' : catalog.deleteVerb === 'desactivar' ? 'Confirmar' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}

export default function CatalogsPage() {
  return <Suspense><CatalogsContent /></Suspense>
}
