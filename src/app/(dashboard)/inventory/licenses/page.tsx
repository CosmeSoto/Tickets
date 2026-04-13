'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox, type ComboboxOption } from '@/components/ui/combobox'
import { useToast } from '@/hooks/use-toast'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { RenewalAlert } from '@/components/inventory/licenses/RenewalAlert'
import { LicenseAttachments } from '@/components/inventory/license-attachments'
import {
  Plus, Search, Key, AlertTriangle, CheckCircle, Clock, Trash2, Edit, Unlink, Loader2, ChevronDown, ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

interface LicenseType {
  id: string
  code: string
  name: string
  icon?: string
}

interface License {
  id: string
  name: string
  typeId: string
  key: string | null
  purchaseDate: string | null
  expirationDate: string | null
  cost: number | null
  vendor: string | null
  notes: string | null
  assignedToEquipment: string | null
  assignedToUser: string | null
  assignedToDepartment: string | null
  licenseType: LicenseType | null
  equipment: { id: string; code: string; brand: string; model: string } | null
  user: { id: string; name: string; email: string } | null
  department: { id: string; name: string } | null
  createdAt: string
}

interface LicenseSummary {
  total: number
  active: number
  expired: number
  expiringSoon: number
  unassigned: number
  totalCost: number
  byType: Record<string, number>
}

interface SimpleEntity {
  id: string
  name: string
  email?: string
  code?: string
}

function getExpirationBadge(date: string | null) {
  if (!date) return <Badge variant="secondary">Sin vencimiento</Badge>
  const exp = new Date(date)
  const now = new Date()
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Expirada</Badge>
  if (diffDays <= 30) return <Badge className="bg-yellow-500 text-white"><Clock className="mr-1 h-3 w-3" />Expira en {diffDays}d</Badge>
  return <Badge variant="secondary"><CheckCircle className="mr-1 h-3 w-3" />Vigente</Badge>
}

export default function LicensesPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventory?subtype=LICENSE') }, [router])

  const { data: session } = useSession()
  const { toast } = useToast()

  const [licenses, setLicenses] = useState<License[]>([])
  const [summary, setSummary] = useState<LicenseSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 10

  // Catálogos
  const [licenseTypes, setLicenseTypes] = useState<LicenseType[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [users, setUsers] = useState<SimpleEntity[]>([])
  const [departments, setDepartments] = useState<SimpleEntity[]>([])
  const [equipmentList, setEquipmentList] = useState<SimpleEntity[]>([])

  // Filtros
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expiredFilter, setExpiredFilter] = useState<string>('all')

  // Modal crear/editar
  const [showForm, setShowForm] = useState(false)
  const [editingLicense, setEditingLicense] = useState<License | null>(null)
  const [formData, setFormData] = useState({
    name: '', typeId: '', key: '', purchaseDate: '', expirationDate: '',
    cost: '', vendor: '', notes: '',
    assignedToUser: '', assignedToDepartment: '', assignedToEquipment: '',
  })
  const [saving, setSaving] = useState(false)
  const [deletingLicense, setDeletingLicense] = useState<License | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [expandedLicenseId, setExpandedLicenseId] = useState<string | null>(null)

  const canManage = session?.user?.role === 'ADMIN' || session?.user?.role === 'TECHNICIAN'

  // Cargar catálogos
  useEffect(() => {
    async function loadCatalogs() {
      try {
        const [typesRes, usersRes, deptsRes, equipRes] = await Promise.all([
          fetch('/api/inventory/license-types'),
          fetch('/api/users?limit=500'),
          fetch('/api/departments'),
          fetch('/api/inventory/equipment?limit=100'),
        ])
        if (typesRes.ok) setLicenseTypes(await typesRes.json())
        if (usersRes.ok) {
          const data = await usersRes.json()
          setUsers(data.data || [])
        }
        if (deptsRes.ok) {
          const data = await deptsRes.json()
          setDepartments(data.data || [])
        }
        if (equipRes.ok) {
          const data = await equipRes.json()
          const items = data.equipment || []
          setEquipmentList(items.map((e: any) => ({ id: e.id, name: `${e.code} - ${e.brand} ${e.model}` })))
        }
      } catch {
        // silenciar errores de catálogos
      } finally {
        setLoadingTypes(false)
      }
    }
    loadCatalogs()
  }, [])

  const loadLicenses = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (typeFilter !== 'all') params.append('typeId', typeFilter)
      if (expiredFilter !== 'all') params.append('expired', expiredFilter)
      params.append('page', page.toString())
      params.append('limit', limit.toString())

      const res = await fetch(`/api/inventory/licenses?${params}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setLicenses(data.licenses)
      setTotal(data.total)
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las licencias', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, expiredFilter, page, toast])

  const loadSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/inventory/licenses/summary')
      if (res.ok) setSummary(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { loadLicenses() }, [loadLicenses])
  useEffect(() => { loadSummary() }, [loadSummary])

  const openCreateForm = () => {
    setEditingLicense(null)
    setFormData({
      name: '', typeId: '', key: '', purchaseDate: '', expirationDate: '',
      cost: '', vendor: '', notes: '',
      assignedToUser: '', assignedToDepartment: '', assignedToEquipment: '',
    })
    setShowForm(true)
  }

  const openEditForm = (license: License) => {
    setEditingLicense(license)
    // Detectar si era contrato corporativo (guardado en notes)
    const isEmpresa = license.notes?.includes('[Contrato corporativo:') && !license.assignedToDepartment
    setFormData({
      name: license.name,
      typeId: license.typeId,
      key: '',
      purchaseDate: license.purchaseDate?.split('T')[0] || '',
      expirationDate: license.expirationDate?.split('T')[0] || '',
      cost: license.cost?.toString() || '',
      vendor: license.vendor || '',
      notes: license.notes?.replace(/\[Contrato corporativo:[^\]]*\]\n?/g, '').trim() || '',
      assignedToUser: license.assignedToUser || '',
      assignedToDepartment: isEmpresa ? 'EMPRESA' : (license.assignedToDepartment || ''),
      assignedToEquipment: license.assignedToEquipment || '',
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.typeId) {
      toast({ title: 'Error', description: 'Nombre y tipo son requeridos', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      const body: any = {
        name: formData.name,
        typeId: formData.typeId,
      }
      if (formData.key) body.key = formData.key
      if (formData.purchaseDate) body.purchaseDate = formData.purchaseDate
      if (formData.expirationDate) body.expirationDate = formData.expirationDate
      if (formData.cost) body.cost = parseFloat(formData.cost)
      if (formData.vendor) body.vendor = formData.vendor

      // Manejar asignación según modo
      // 'EMPRESA' es un valor especial — se guarda en notas, no en FK
      if (formData.assignedToDepartment === 'EMPRESA') {
        body.assignedToDepartment = null
        body.assignedToUser = null
        body.assignedToEquipment = null
        const empresaNote = '[Contrato corporativo: aplica a toda la empresa]'
        const existingNotes = formData.notes?.replace(/\[Contrato corporativo:[^\]]*\]/g, '').trim() || ''
        body.notes = [empresaNote, existingNotes].filter(Boolean).join('\n')
      } else {
        body.assignedToUser = formData.assignedToUser || null
        body.assignedToDepartment = formData.assignedToDepartment || null
        body.assignedToEquipment = formData.assignedToEquipment || null
        // Limpiar nota de empresa si existía
        body.notes = (formData.notes || '').replace(/\[Contrato corporativo:[^\]]*\]\n?/g, '').trim() || null
      }

      const url = editingLicense
        ? `/api/inventory/licenses/${editingLicense.id}`
        : '/api/inventory/licenses'
      const method = editingLicense ? 'PUT' : 'POST'

      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar')
      }

      toast({ title: 'Éxito', description: editingLicense ? 'Licencia actualizada' : 'Licencia creada' })
      setShowForm(false)
      loadLicenses()
      loadSummary()
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (license: License) => {
    setDeletingLicense(license)
  }

  const confirmDelete = async () => {
    if (!deletingLicense) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/inventory/licenses/${deletingLicense.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast({ title: 'Éxito', description: 'Licencia eliminada' })
      loadLicenses()
      loadSummary()
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeletingLicense(null)
    }
  }

  const handleUnassign = async (license: License) => {
    try {
      const res = await fetch(`/api/inventory/licenses/${license.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unassign' }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Éxito', description: 'Licencia desasignada' })
      loadLicenses()
    } catch {
      toast({ title: 'Error', description: 'No se pudo desasignar', variant: 'destructive' })
    }
  }

  const getAssignedTo = (license: License) => {
    const parts: string[] = []
    if (license.notes?.includes('[Contrato corporativo:') && !license.assignedToDepartment) {
      parts.push('🏢 Toda la empresa')
    }
    if (license.user) parts.push(license.user.name)
    if (license.department) parts.push(license.department.name)
    if (license.equipment) parts.push(`${license.equipment.code}`)
    return parts.length > 0 ? parts.join(' · ') : null
  }

  return (
    <RoleDashboardLayout title="Licencias y Contratos" subtitle="Gestión de licencias de software y contratos">
      <div className="space-y-6">
        {/* Resumen */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold">{summary.total}</div><p className="text-xs text-muted-foreground">Total licencias</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-green-600">{summary.active}</div><p className="text-xs text-muted-foreground">Activas</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-red-600">{summary.expired}</div><p className="text-xs text-muted-foreground">Expiradas</p></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-2xl font-bold text-yellow-600">{summary.expiringSoon}</div><p className="text-xs text-muted-foreground">Por expirar (30d)</p></CardContent></Card>
          </div>
        )}

        {/* Tabla */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Licencias</CardTitle><CardDescription>{total} registro{total !== 1 ? 's' : ''}</CardDescription></div>
              {canManage && (
                <Button onClick={openCreateForm} size="sm"><Plus className="mr-2 h-4 w-4" />Nueva Licencia</Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre, proveedor o notas..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
              </div>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  {licenseTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={expiredFilter} onValueChange={v => { setExpiredFilter(v); setPage(1) }}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activas</SelectItem>
                  <SelectItem value="expired">Expiradas</SelectItem>
                  <SelectItem value="expiring">Por expirar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : licenses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Key className="mx-auto h-12 w-12 mb-3 opacity-50" />
                <p>No se encontraron licencias</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-6"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Clave</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Asignada a</TableHead>
                      <TableHead>Costo</TableHead>
                      {canManage && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {licenses.map(license => (
                      <>
                        <TableRow key={license.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedLicenseId(expandedLicenseId === license.id ? null : license.id)}>
                          <TableCell className="pr-0">
                            {expandedLicenseId === license.id
                              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{license.name}</span>
                              {(license as any).renewalAlertStatus && (license as any).renewalAlertStatus !== 'none' && (
                                <RenewalAlert
                                  renewalAlertStatus={(license as any).renewalAlertStatus}
                                  renewalDate={(license as any).renewalDate}
                                />
                              )}
                            </div>
                            {license.vendor && <span className="text-xs text-muted-foreground">{license.vendor}</span>}
                          </TableCell>
                          <TableCell><Badge variant="outline">{license.licenseType?.name || 'Sin tipo'}</Badge></TableCell>
                          <TableCell>
                            {license.key ? (
                              <code className="text-xs bg-muted px-2 py-1 rounded">{license.key}</code>
                            ) : (
                              <span className="text-xs text-muted-foreground">Sin clave</span>
                            )}
                          </TableCell>
                          <TableCell>{getExpirationBadge(license.expirationDate)}</TableCell>
                          <TableCell>
                            {getAssignedTo(license) || <span className="text-xs text-muted-foreground">Sin asignar</span>}
                          </TableCell>
                          <TableCell>{license.cost ? `${license.cost.toLocaleString()}` : '-'}</TableCell>
                          {canManage && (
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditForm(license)} title="Editar"><Edit className="h-4 w-4" /></Button>
                                {(license.assignedToEquipment || license.assignedToUser || license.assignedToDepartment) && (
                                  <Button variant="ghost" size="icon" onClick={() => handleUnassign(license)} title="Desasignar"><Unlink className="h-4 w-4" /></Button>
                                )}
                                {session?.user?.role === 'ADMIN' && (
                                  <Button variant="ghost" size="icon" onClick={() => handleDelete(license)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                        {expandedLicenseId === license.id && (
                          <TableRow key={`${license.id}-attachments`}>
                            <TableCell colSpan={canManage ? 8 : 7} className="bg-muted/30 px-6 py-4">
                              <LicenseAttachments licenseId={license.id} canManage={canManage} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
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
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editingLicense ? 'Editar Licencia' : 'Nueva Licencia / Contrato'}</DialogTitle>
              <DialogDescription>{editingLicense ? 'Modifica los datos de la licencia' : 'Registra una nueva licencia de software o contrato'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Windows 11 Pro, Office 365 Business" />
              </div>

              <div>
                <Label>Tipo de Licencia *</Label>
                {loadingTypes ? (
                  <div className="flex items-center justify-center h-10 border rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Combobox
                        options={licenseTypes.map((t): ComboboxOption => ({ value: t.id, label: t.name }))}
                        value={formData.typeId}
                        onValueChange={v => setFormData(f => ({ ...f, typeId: v }))}
                        placeholder="Buscar tipo de licencia..."
                        searchPlaceholder="Escriba para buscar..."
                        emptyText="No se encontró el tipo"
                      />
                    </div>
                    <Link href="/inventory/license-types" target="_blank">
                      <Button type="button" variant="outline" size="icon" title="Gestionar tipos de licencia">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              <div>
                <Label>Clave de licencia {editingLicense ? '(dejar vacío para no cambiar)' : '(opcional)'}</Label>
                <Input value={formData.key} onChange={e => setFormData(f => ({ ...f, key: e.target.value }))} placeholder="XXXXX-XXXXX-XXXXX o dejar vacío" />
                <p className="text-xs text-muted-foreground mt-1">Opcional. Algunas licencias se gestionan por correo electrónico.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Fecha de compra</Label>
                  <Input type="date" value={formData.purchaseDate} onChange={e => setFormData(f => ({ ...f, purchaseDate: e.target.value }))} />
                </div>
                <div>
                  <Label>Vencimiento</Label>
                  <Input type="date" value={formData.expirationDate} onChange={e => setFormData(f => ({ ...f, expirationDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Costo</Label>
                  <Input type="number" step="0.01" value={formData.cost} onChange={e => setFormData(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" />
                </div>
                <div>
                  <Label>Proveedor</Label>
                  <Input value={formData.vendor} onChange={e => setFormData(f => ({ ...f, vendor: e.target.value }))} placeholder="Microsoft, Google, etc." />
                </div>
              </div>

              {/* Asignaciones */}
              <div className="border-t pt-4">
                <Label className="text-base font-semibold">Asignación</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Define a quién aplica esta licencia o contrato
                </p>

                {/* Selector de modo de asignación */}
                <div className="mb-4">
                  <Label className="text-sm">Tipo de asignación</Label>
                  <Select
                    value={
                      formData.assignedToEquipment && formData.assignedToUser ? 'user-equipment' :
                      formData.assignedToEquipment && !formData.assignedToUser ? 'equipment-only' :
                      formData.assignedToUser && !formData.assignedToDepartment ? 'user-only' :
                      formData.assignedToDepartment ? 'department' :
                      'none'
                    }
                    onValueChange={(v) => {
                      // Limpiar campos al cambiar modo
                      setFormData(f => ({
                        ...f,
                        assignedToUser: '',
                        assignedToDepartment: '',
                        assignedToEquipment: '',
                      }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar (disponible)</SelectItem>
                      <SelectItem value="user-only">Usuario — licencia personal (ej: Adobe CC, suscripción)</SelectItem>
                      <SelectItem value="user-equipment">Usuario + Equipo — instalada en equipo específico (ej: Windows OEM, Office)</SelectItem>
                      <SelectItem value="equipment-only">Solo Equipo — licencia OEM del equipo</SelectItem>
                      <SelectItem value="department">Departamento — contrato o licencia compartida (ej: antivirus, ERP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Campos según modo */}
                {(formData.assignedToUser !== undefined) && (() => {
                  const mode =
                    formData.assignedToEquipment && formData.assignedToUser ? 'user-equipment' :
                    formData.assignedToEquipment && !formData.assignedToUser ? 'equipment-only' :
                    formData.assignedToUser && !formData.assignedToDepartment ? 'user-only' :
                    formData.assignedToDepartment ? 'department' :
                    'none'

                  return (
                    <div className="space-y-3">
                      {(mode === 'user-only' || mode === 'user-equipment') && (
                        <div>
                          <Label>Usuario *</Label>
                          <Combobox
                            options={users.map(u => ({ value: u.id, label: u.name + (u.email ? ` (${u.email})` : '') }))}
                            value={formData.assignedToUser}
                            onValueChange={v => setFormData(f => ({ ...f, assignedToUser: v }))}
                            placeholder="Buscar usuario..."
                            searchPlaceholder="Nombre o correo..."
                            emptyText="No se encontró el usuario"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            El departamento del usuario se registra automáticamente en los reportes.
                          </p>
                        </div>
                      )}

                      {(mode === 'user-equipment' || mode === 'equipment-only') && (
                        <div>
                          <Label>Equipo *</Label>
                          <Combobox
                            options={equipmentList.map(e => ({ value: e.id, label: e.name }))}
                            value={formData.assignedToEquipment}
                            onValueChange={v => setFormData(f => ({ ...f, assignedToEquipment: v }))}
                            placeholder="Buscar equipo..."
                            searchPlaceholder="Código, marca o modelo..."
                            emptyText="No se encontró el equipo"
                          />
                        </div>
                      )}

                      {mode === 'department' && (
                        <div>
                          <Label>Departamento *</Label>
                          <Combobox
                            options={[
                              { value: 'EMPRESA', label: '🏢 Toda la empresa (contrato corporativo)' },
                              ...departments.map(d => ({ value: d.id, label: d.name }))
                            ]}
                            value={formData.assignedToDepartment}
                            onValueChange={v => setFormData(f => ({ ...f, assignedToDepartment: v }))}
                            placeholder="Seleccionar departamento..."
                            searchPlaceholder="Buscar departamento..."
                            emptyText="No se encontró el departamento"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Para contratos que cubren múltiples departamentos, usa &quot;Toda la empresa&quot; y detalla en las notas.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}
              </div>

              <div>
                <Label>Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Observaciones, detalles del contrato, correo asociado, etc."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deletingLicense} onOpenChange={(open) => !open && setDeletingLicense(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar licencia?</AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de eliminar la licencia{' '}
                <span className="font-semibold text-foreground">"{deletingLicense?.name}"</span>.
                <br /><br />
                Esta acción es permanente y no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </div>
    </RoleDashboardLayout>
  )
}
