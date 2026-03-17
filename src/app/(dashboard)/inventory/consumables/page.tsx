'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { useToast } from '@/hooks/use-toast'
import { Textarea } from '@/components/ui/textarea'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Plus, Search, Package, AlertTriangle, ArrowDown, History,
  Trash2, Edit, Loader2, Monitor, User,
} from 'lucide-react'
import Link from 'next/link'

interface ConsumableType { id: string; code: string; name: string; icon?: string }
interface UnitOfMeasure { id: string; code: string; name: string; symbol: string }
interface EquipmentOption { id: string; code: string; brand: string; model: string; serialNumber: string }
interface UserOption { id: string; name: string; email: string }

interface Consumable {
  id: string; name: string; typeId: string; unitOfMeasureId: string
  assignedEquipmentId: string | null
  currentStock: number; minStock: number; maxStock: number
  costPerUnit: number | null; location: string | null; notes: string | null
  compatibleEquipment: string[]; createdAt: string
  consumableType: ConsumableType | null
  unitOfMeasure: UnitOfMeasure | null
  assignedEquipment: EquipmentOption | null
  movements: Array<{
    id: string; type: string; quantity: number; reason: string | null; createdAt: string
    user: { name: string } | null
    assignedToUser: { name: string } | null
    assignedToEquipment: { code: string; brand: string; model: string } | null
  }>
}

interface ConsumableSummary {
  total: number; lowStock: number; outOfStock: number
  totalValue: number; recentMovements: number; byType: Record<string, number>
}

function getStockBadge(current: number, min: number) {
  if (current === 0) return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Sin stock</Badge>
  if (current <= min) return <Badge className="bg-yellow-500 text-white"><AlertTriangle className="mr-1 h-3 w-3" />Stock bajo</Badge>
  return <Badge variant="secondary">OK</Badge>
}

function StockBar({ current, min, max }: { current: number; min: number; max: number }) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const color = current === 0 ? 'bg-red-500' : current <= min ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="w-full bg-muted rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function ConsumablesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [consumables, setConsumables] = useState<Consumable[]>([])
  const [summary, setSummary] = useState<ConsumableSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 10

  const [consumableTypes, setConsumableTypes] = useState<ConsumableType[]>([])
  const [unitsOfMeasure, setUnitsOfMeasure] = useState<UnitOfMeasure[]>([])
  const [equipmentList, setEquipmentList] = useState<EquipmentOption[]>([])
  const [usersList, setUsersList] = useState<UserOption[]>([])
  const [loadingCatalogs, setLoadingCatalogs] = useState(true)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const [showForm, setShowForm] = useState(false)
  const [editingItem, setEditingItem] = useState<Consumable | null>(null)
  const [formData, setFormData] = useState({
    name: '', typeId: '', unitOfMeasureId: '', assignedEquipmentId: '',
    currentStock: '', minStock: '', maxStock: '', costPerUnit: '',
    location: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const [showMovement, setShowMovement] = useState(false)
  const [movementTarget, setMovementTarget] = useState<Consumable | null>(null)
  const [movementData, setMovementData] = useState({
    type: 'ENTRY', quantity: '', reason: '',
    assignedToUserId: '', assignedToEquipmentId: '',
  })

  const [showHistory, setShowHistory] = useState(false)
  const [historyTarget, setHistoryTarget] = useState<Consumable | null>(null)
  const [movements, setMovements] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const [deletingItem, setDeletingItem] = useState<Consumable | null>(null)
  const [deleting, setDeleting] = useState(false)

  const canManage = session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'

  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [typesRes, unitsRes, equipRes, usersRes] = await Promise.all([
          fetch('/api/inventory/consumable-types'),
          fetch('/api/inventory/units-of-measure'),
          fetch('/api/inventory/equipment?page=1&limit=100'),
          fetch('/api/users'),
        ])
        if (typesRes.ok) setConsumableTypes(await typesRes.json())
        if (unitsRes.ok) setUnitsOfMeasure(await unitsRes.json())
        if (equipRes.ok) {
          const eData = await equipRes.json()
          setEquipmentList(eData.equipment || eData.data || [])
        }
        if (usersRes.ok) {
          const uData = await usersRes.json()
          setUsersList(uData.data || uData || [])
        }
      } catch { /* silenciar */ }
      finally { setLoadingCatalogs(false) }
    }
    loadCatalogs()
  }, [])

  const loadConsumables = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (typeFilter !== 'all') params.append('typeId', typeFilter)
      params.append('page', page.toString())
      params.append('limit', limit.toString())
      const res = await fetch(`/api/inventory/consumables?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConsumables(data.consumables)
      setTotal(data.total)
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar los consumibles', variant: 'destructive' })
    } finally { setLoading(false) }
  }, [search, typeFilter, page, toast])

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/consumables/summary')
      if (res.ok) setSummary(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadConsumables() }, [loadConsumables])
  useEffect(() => { loadSummary() }, [loadSummary])

  const openCreateForm = () => {
    setEditingItem(null)
    setFormData({ name: '', typeId: '', unitOfMeasureId: '', assignedEquipmentId: '', currentStock: '', minStock: '', maxStock: '', costPerUnit: '', location: '', notes: '' })
    setShowForm(true)
  }

  const openEditForm = (item: Consumable) => {
    setEditingItem(item)
    setFormData({
      name: item.name, typeId: item.typeId, unitOfMeasureId: item.unitOfMeasureId,
      assignedEquipmentId: item.assignedEquipmentId || '',
      currentStock: '', minStock: item.minStock.toString(), maxStock: item.maxStock.toString(),
      costPerUnit: item.costPerUnit?.toString() || '',
      location: item.location || '', notes: item.notes || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.typeId || !formData.unitOfMeasureId) {
      toast({ title: 'Error', description: 'Nombre, tipo y unidad de medida son requeridos', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      const body: any = {
        name: formData.name, typeId: formData.typeId, unitOfMeasureId: formData.unitOfMeasureId,
        minStock: parseFloat(formData.minStock), maxStock: parseFloat(formData.maxStock),
      }
      if (formData.assignedEquipmentId) body.assignedEquipmentId = formData.assignedEquipmentId
      else body.assignedEquipmentId = null
      if (formData.costPerUnit) body.costPerUnit = parseFloat(formData.costPerUnit)
      if (formData.location) body.location = formData.location
      if (formData.notes) body.notes = formData.notes
      if (!editingItem) body.currentStock = parseFloat(formData.currentStock || '0')
      const url = editingItem ? `/api/inventory/consumables/${editingItem.id}` : '/api/inventory/consumables'
      const method = editingItem ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error al guardar') }
      toast({ title: 'Éxito', description: editingItem ? 'Consumible actualizado' : 'Consumible creado' })
      setShowForm(false)
      loadConsumables()
      loadSummary()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (!deletingItem) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${deletingItem.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Éxito', description: 'Consumible eliminado' })
      loadConsumables(); loadSummary()
    } catch { toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' }) }
    finally { setDeleting(false); setDeletingItem(null) }
  }

  const openMovement = (item: Consumable) => {
    setMovementTarget(item)
    setMovementData({ type: 'ENTRY', quantity: '', reason: '', assignedToUserId: '', assignedToEquipmentId: '' })
    setShowMovement(true)
  }

  const handleMovement = async () => {
    if (!movementTarget) return
    try {
      setSaving(true)
      const body: any = {
        type: movementData.type,
        quantity: parseFloat(movementData.quantity),
        reason: movementData.reason || undefined,
      }
      if (movementData.type === 'EXIT') {
        if (movementData.assignedToUserId) body.assignedToUserId = movementData.assignedToUserId
        if (movementData.assignedToEquipmentId) body.assignedToEquipmentId = movementData.assignedToEquipmentId
      }
      const res = await fetch(`/api/inventory/consumables/${movementTarget.id}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Error') }
      toast({ title: 'Éxito', description: 'Movimiento registrado' })
      setShowMovement(false); loadConsumables(); loadSummary()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const openHistory = async (item: Consumable) => {
    setHistoryTarget(item); setShowHistory(true); setLoadingHistory(true)
    try {
      const res = await fetch(`/api/inventory/consumables/${item.id}/movements?limit=30`)
      if (res.ok) { const data = await res.json(); setMovements(data.movements) }
    } catch { /* ignore */ }
    finally { setLoadingHistory(false) }
  }

  const equipmentOptions: ComboboxOption[] = equipmentList.map(e => ({
    value: e.id, label: `${e.code} - ${e.brand} ${e.model} (S/N: ${e.serialNumber})`,
  }))

  const userOptions: ComboboxOption[] = usersList.map(u => ({
    value: u.id, label: `${u.name} (${u.email})`,
  }))

  return (
    <RoleDashboardLayout title="Consumibles" subtitle="Control de stock y movimientos">
      <div className="space-y-6">
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.total}</div><p className="text-xs text-muted-foreground">Total consumibles</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{summary.lowStock}</div><p className="text-xs text-muted-foreground">Stock bajo</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{summary.outOfStock}</div><p className="text-xs text-muted-foreground">Sin stock</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">${summary.totalValue.toLocaleString()}</div><p className="text-xs text-muted-foreground">Valor total</p></CardContent></Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Consumibles</CardTitle><CardDescription>{total} item{total !== 1 ? 's' : ''}</CardDescription></div>
              {canManage && <Button onClick={openCreateForm} size="sm"><Plus className="mr-2 h-4 w-4" />Nuevo Consumible</Button>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
              </div>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {consumableTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : consumables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p>No se encontraron consumibles</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Equipo asignado</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Costo/u</TableHead>
                      {canManage && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consumables.map(item => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.name}</div>
                          <span className="text-xs text-muted-foreground">{item.unitOfMeasure?.name || ''} ({item.unitOfMeasure?.symbol || ''})</span>
                          {item.location && <div className="text-xs text-muted-foreground">📍 {item.location}</div>}
                        </TableCell>
                        <TableCell><Badge variant="outline">{item.consumableType?.name || 'Sin tipo'}</Badge></TableCell>
                        <TableCell>
                          {item.assignedEquipment ? (
                            <div className="text-sm">
                              <div className="flex items-center gap-1"><Monitor className="h-3 w-3" />{item.assignedEquipment.code}</div>
                              <span className="text-xs text-muted-foreground">{item.assignedEquipment.brand} {item.assignedEquipment.model}</span>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">Sin asignar</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.currentStock}</span>
                            {getStockBadge(item.currentStock, item.minStock)}
                          </div>
                          <span className="text-xs text-muted-foreground">Min: {item.minStock} / Max: {item.maxStock}</span>
                        </TableCell>
                        <TableCell className="w-[120px]"><StockBar current={item.currentStock} min={item.minStock} max={item.maxStock} /></TableCell>
                        <TableCell>{item.costPerUnit ? `${item.costPerUnit.toLocaleString()}` : '-'}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openMovement(item)} title="Movimiento de stock"><ArrowDown className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openHistory(item)} title="Historial"><History className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditForm(item)} title="Editar"><Edit className="h-4 w-4" /></Button>
                              {session?.user?.role === 'ADMIN' && (
                                <Button variant="ghost" size="icon" onClick={() => setDeletingItem(item)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {total > limit && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Mostrando {(page - 1) * limit + 1} a {Math.min(page * limit, total)} de {total}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Anterior</Button>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * limit >= total}>Siguiente</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal crear/editar */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Editar Consumible' : 'Nuevo Consumible'}</DialogTitle>
              <DialogDescription>{editingItem ? 'Modifica los datos del consumible' : 'Registra un nuevo consumible'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Tóner HP 85A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo de Consumible *</Label>
                  {loadingCatalogs ? (
                    <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Combobox options={consumableTypes.map((t): ComboboxOption => ({ value: t.id, label: t.name }))} value={formData.typeId} onValueChange={v => setFormData(f => ({ ...f, typeId: v }))} placeholder="Buscar tipo..." searchPlaceholder="Escriba para buscar..." emptyText="No se encontró" />
                      </div>
                      <Link href="/inventory/consumable-types" target="_blank"><Button type="button" variant="outline" size="icon" title="Gestionar tipos"><Plus className="h-4 w-4" /></Button></Link>
                    </div>
                  )}
                </div>
                <div>
                  <Label>Unidad de Medida *</Label>
                  {loadingCatalogs ? (
                    <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Combobox options={unitsOfMeasure.map((u): ComboboxOption => ({ value: u.id, label: `${u.name} (${u.symbol})` }))} value={formData.unitOfMeasureId} onValueChange={v => setFormData(f => ({ ...f, unitOfMeasureId: v }))} placeholder="Buscar unidad..." searchPlaceholder="Escriba para buscar..." emptyText="No se encontró" />
                      </div>
                      <Link href="/inventory/units-of-measure" target="_blank"><Button type="button" variant="outline" size="icon" title="Gestionar unidades"><Plus className="h-4 w-4" /></Button></Link>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <Label>Equipo asignado (opcional)</Label>
                <p className="text-xs text-muted-foreground mb-1">Vincula este consumible a un equipo específico (ej: tóner para impresora X)</p>
                <Combobox
                  options={[{ value: '', label: '— Sin asignar —' }, ...equipmentOptions]}
                  value={formData.assignedEquipmentId}
                  onValueChange={v => setFormData(f => ({ ...f, assignedEquipmentId: v }))}
                  placeholder="Buscar equipo..."
                  searchPlaceholder="Código, marca o modelo..."
                  emptyText="No se encontró equipo"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {!editingItem && (
                  <div>
                    <Label>Stock inicial</Label>
                    <Input type="number" value={formData.currentStock} onChange={e => setFormData(f => ({ ...f, currentStock: e.target.value }))} placeholder="0" />
                  </div>
                )}
                <div>
                  <Label>Stock mínimo *</Label>
                  <Input type="number" value={formData.minStock} onChange={e => setFormData(f => ({ ...f, minStock: e.target.value }))} placeholder="0" />
                </div>
                <div>
                  <Label>Stock máximo *</Label>
                  <Input type="number" value={formData.maxStock} onChange={e => setFormData(f => ({ ...f, maxStock: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Costo por unidad</Label>
                  <Input type="number" value={formData.costPerUnit} onChange={e => setFormData(f => ({ ...f, costPerUnit: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Ubicación</Label>
                  <Input value={formData.location} onChange={e => setFormData(f => ({ ...f, location: e.target.value }))} placeholder="Ej: Bodega A, Estante 3" />
                </div>
              </div>
              <div>
                <Label>Notas</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones adicionales..." rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{saving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal movimiento de stock */}
        <Dialog open={showMovement} onOpenChange={setShowMovement}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Movimiento de Stock</DialogTitle>
              <DialogDescription>{movementTarget?.name} — Stock actual: {movementTarget?.currentStock} {movementTarget?.unitOfMeasure?.symbol || ''}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Tipo de movimiento *</Label>
                <Select value={movementData.type} onValueChange={v => setMovementData(d => ({ ...d, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ENTRY">Entrada (agregar stock)</SelectItem>
                    <SelectItem value="EXIT">Salida (entregar a usuario/equipo)</SelectItem>
                    <SelectItem value="ADJUSTMENT">Ajuste (establecer cantidad)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad *</Label>
                <Input type="number" value={movementData.quantity} onChange={e => setMovementData(d => ({ ...d, quantity: e.target.value }))} placeholder="0" />
              </div>
              {movementData.type === 'EXIT' && (
                <>
                  <div>
                    <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" />Entregado a (usuario)</Label>
                    <Combobox
                      options={[{ value: '', label: '— No especificar —' }, ...userOptions]}
                      value={movementData.assignedToUserId}
                      onValueChange={v => setMovementData(d => ({ ...d, assignedToUserId: v }))}
                      placeholder="Buscar usuario..."
                      searchPlaceholder="Nombre o email..."
                      emptyText="No se encontró usuario"
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" />Para equipo</Label>
                    <Combobox
                      options={[{ value: '', label: '— No especificar —' }, ...equipmentOptions]}
                      value={movementData.assignedToEquipmentId}
                      onValueChange={v => setMovementData(d => ({ ...d, assignedToEquipmentId: v }))}
                      placeholder="Buscar equipo..."
                      searchPlaceholder="Código, marca o modelo..."
                      emptyText="No se encontró equipo"
                    />
                  </div>
                </>
              )}
              <div>
                <Label>Motivo</Label>
                <Textarea value={movementData.reason} onChange={e => setMovementData(d => ({ ...d, reason: e.target.value }))} placeholder="Razón del movimiento..." rows={2} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowMovement(false)}>Cancelar</Button>
                <Button onClick={handleMovement} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{saving ? 'Registrando...' : 'Registrar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal historial de movimientos */}
        <Dialog open={showHistory} onOpenChange={setShowHistory}>
          <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Historial de Movimientos</DialogTitle>
              <DialogDescription>{historyTarget?.name} — Stock actual: {historyTarget?.currentStock} {historyTarget?.unitOfMeasure?.symbol || ''}</DialogDescription>
            </DialogHeader>
            {loadingHistory ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : movements.length === 0 ? (
              <p className="text-center py-6 text-muted-foreground">No hay movimientos registrados</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Entregado a</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{new Date(m.createdAt).toLocaleString('es-MX')}</TableCell>
                      <TableCell>
                        <Badge variant={m.type === 'ENTRY' ? 'default' : m.type === 'EXIT' ? 'destructive' : 'secondary'}>
                          {m.type === 'ENTRY' ? 'Entrada' : m.type === 'EXIT' ? 'Salida' : 'Ajuste'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.quantity}</TableCell>
                      <TableCell className="text-sm">{m.user?.name || '-'}</TableCell>
                      <TableCell className="text-sm">
                        {m.assignedToUser ? (
                          <span className="flex items-center gap-1"><User className="h-3 w-3" />{m.assignedToUser.name}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {m.assignedToEquipment ? (
                          <span className="flex items-center gap-1"><Monitor className="h-3 w-3" />{m.assignedToEquipment.code} - {m.assignedToEquipment.brand} {m.assignedToEquipment.model}</span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">{m.reason || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        {/* AlertDialog eliminar */}
        <AlertDialog open={!!deletingItem} onOpenChange={(open) => { if (!open) setDeletingItem(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar consumible?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminará permanentemente &quot;{deletingItem?.name}&quot; junto con todo su historial de movimientos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </RoleDashboardLayout>
  )
}
