'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Layers,
  Users,
  Building,
  Ticket,
  Package,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FamilyIcon } from '@/components/inventory/family-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconPicker } from '@/components/inventory/icon-picker'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { ListTableToolbar } from '@/components/common/list-table-toolbar'
import { exportToCSV, exportToExcelMulti, exportToPDF } from '@/lib/utils/export'

interface Family {
  id: string
  code: string
  name: string
  description?: string | null
  color?: string | null
  icon?: string | null
  isActive: boolean
  order: number
  _count?: {
    departments?: number
    tickets?: number
    technicianFamilyAssignments?: number
    managerFamilies?: number
  }
  ticketFamilyConfig?: {
    ticketsEnabled: boolean
  } | null
  formConfig?: {
    inventoryEnabled?: boolean
  } | null
}

interface FamilyFormData {
  name: string
  code: string
  description: string
  color: string
  icon: string
  contactWhatsapp: string
}

const DEFAULT_FORM: FamilyFormData = {
  name: '',
  code: '',
  description: '',
  color: '#6B7280',
  icon: '',
  contactWhatsapp: '',
}

export default function FamiliesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true

  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [deletingFamily, setDeletingFamily] = useState<Family | null>(null)
  const [formData, setFormData] = useState<FamilyFormData>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  // Search / filter state
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')

  const filteredFamilies = families.filter(f => {
    const matchesSearch =
      search === '' ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.code.toLowerCase().includes(search.toLowerCase()) ||
      (f.description ?? '').toLowerCase().includes(search.toLowerCase())
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && f.isActive) ||
      (filterStatus === 'inactive' && !f.isActive)
    return matchesSearch && matchesStatus
  })

  const {
    sortedData: sortedFamilies,
    requestSort,
    getSortIcon,
  } = useTableSort(filteredFamilies, { key: 'name', direction: 'asc' })

  const [exporting, setExporting] = useState(false)

  const familyExportColumns = [
    { key: 'name', label: 'Nombre' },
    { key: 'code', label: 'Código' },
    {
      key: 'description',
      label: 'Descripción',
      format: (v: string | null | undefined) => v ?? '—',
    },
    {
      key: 'isActive',
      label: 'Estado',
      format: (v: boolean) => (v ? 'Activo' : 'Inactivo'),
    },
    {
      key: '_count',
      label: 'Departamentos',
      format: (_: unknown, row: Family) => String(row._count?.departments ?? 0),
    },
    {
      key: 'ticketFamilyConfig',
      label: 'Tickets',
      format: (_: unknown, row: Family) => (row.ticketFamilyConfig?.ticketsEnabled ? 'Sí' : 'No'),
    },
    {
      key: 'formConfig',
      label: 'Inventario',
      format: (_: unknown, row: Family) =>
        row.formConfig?.inventoryEnabled !== false ? 'Sí' : 'No',
    },
    {
      key: '_count',
      label: 'Técnicos',
      format: (_: unknown, row: Family) => String(row._count?.technicianFamilyAssignments ?? 0),
    },
    {
      key: '_count',
      label: 'Managers',
      format: (_: unknown, row: Family) => String(row._count?.managerFamilies ?? 0),
    },
    { key: 'color', label: 'Color', format: (v: string | null | undefined) => v ?? '—' },
    { key: 'order', label: 'Orden' },
  ]

  const departmentExportColumns = [
    { key: 'familyName', label: 'Familia' },
    { key: 'familyCode', label: 'Código familia' },
    { key: 'name', label: 'Departamento' },
    {
      key: 'description',
      label: 'Descripción',
      format: (v: string | null | undefined) => v ?? '—',
    },
    {
      key: 'isActive',
      label: 'Estado',
      format: (v: boolean) => (v ? 'Activo' : 'Inactivo'),
    },
    { key: 'usersCount', label: 'Usuarios' },
    { key: 'categoriesCount', label: 'Categorías' },
    { key: 'color', label: 'Color', format: (v: string | null | undefined) => v ?? '—' },
  ]

  const loadDepartmentsForExport = async () => {
    const res = await fetch('/api/departments')
    const data = await res.json().catch(() => ({}))
    const list = (data.data ?? data.departments ?? []) as Array<{
      name: string
      description?: string | null
      isActive: boolean
      color?: string | null
      family?: { name?: string; code?: string } | null
      _count?: { users?: number; categories?: number }
    }>
    return list.map(d => ({
      familyName: d.family?.name ?? '—',
      familyCode: d.family?.code ?? '—',
      name: d.name,
      description: d.description,
      isActive: d.isActive,
      usersCount: d._count?.users ?? 0,
      categoriesCount: d._count?.categories ?? 0,
      color: d.color,
    }))
  }

  const exportCSV = () => {
    try {
      if (sortedFamilies.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay familias para exportar con los filtros actuales',
          variant: 'destructive',
        })
        return
      }
      const date = new Date().toISOString().split('T')[0]
      exportToCSV({
        filename: `familias-${date}`,
        title: 'Informe de Familias',
        subtitle: `Generado el ${new Date().toLocaleDateString('es-EC')} · ${sortedFamilies.length} familias`,
        columns: familyExportColumns,
        rows: sortedFamilies,
      })
      toast({ title: 'CSV exportado', description: `${sortedFamilies.length} familias` })
    } catch {
      toast({ title: 'Error al exportar', variant: 'destructive' })
    }
  }

  const exportPDF = () => {
    try {
      if (sortedFamilies.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay familias para exportar',
          variant: 'destructive',
        })
        return
      }
      const date = new Date().toISOString().split('T')[0]
      exportToPDF({
        filename: `familias-${date}`,
        title: 'Informe de Familias',
        subtitle: `Generado el ${new Date().toLocaleDateString('es-EC')} · ${sortedFamilies.length} familias`,
        columns: familyExportColumns,
        rows: sortedFamilies,
      })
    } catch {
      toast({ title: 'Error al exportar PDF', variant: 'destructive' })
    }
  }

  const exportExcel = async () => {
    setExporting(true)
    try {
      if (sortedFamilies.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay familias para exportar',
          variant: 'destructive',
        })
        return
      }
      const departments = await loadDepartmentsForExport()
      const date = new Date().toISOString().split('T')[0]
      await exportToExcelMulti({
        filename: `familias-informe-${date}`,
        sheets: [
          {
            name: 'Familias',
            columns: familyExportColumns,
            rows: sortedFamilies,
          },
          {
            name: 'Departamentos',
            columns: departmentExportColumns,
            rows: departments,
          },
        ],
      })
      toast({
        title: 'Excel exportado',
        description: `${sortedFamilies.length} familias · ${departments.length} departamentos`,
      })
    } catch {
      toast({
        title: 'Error al exportar Excel',
        description: 'No se pudo generar el informe',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
    }
  }

  const loadFamilies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/families?includeInactive=true')
      const data = await res.json()
      if (data.success) {
        setFamilies(data.data)
      } else {
        setError(data.message || 'Error al cargar familias')
      }
    } catch {
      setError('Error de conexión al cargar familias')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFamilies()
  }, [loadFamilies])

  const openCreateDialog = () => {
    setEditingFamily(null)
    setFormData(DEFAULT_FORM)
    setShowFormDialog(true)
  }

  const openEditDialog = (family: Family) => {
    setEditingFamily(family)
    setFormData({
      name: family.name,
      code: family.code,
      description: family.description || '',
      color: family.color || '#6B7280',
      icon: family.icon || '',
      contactWhatsapp: (family as any).contactWhatsapp || '',
    })
    setShowFormDialog(true)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        title: 'Error',
        description: 'Nombre y código son requeridos',
        variant: 'destructive',
      })
      return
    }
    setSubmitting(true)
    try {
      const url = editingFamily ? `/api/families/${editingFamily.id}` : '/api/families'
      const method = editingFamily ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        setShowFormDialog(false)
        loadFamilies()
      } else {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleActive = async (family: Family) => {
    setToggling(family.id)
    try {
      const res = await fetch(`/api/families/${family.id}/toggle`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        loadFamilies()
      } else {
        toast({ title: 'Error', description: data.message, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setToggling(null)
    }
  }

  const openDeleteDialog = (family: Family) => {
    setDeletingFamily(family)
    setShowDeleteDialog(true)
  }

  const handleDelete = async () => {
    if (!deletingFamily) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/families/${deletingFamily.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast({ title: 'Éxito', description: data.message })
        setShowDeleteDialog(false)
        loadFamilies()
      } else {
        toast({ title: 'No se puede eliminar', description: data.message, variant: 'destructive' })
        setShowDeleteDialog(false)
      }
    } catch {
      toast({ title: 'Error', description: 'Error de conexión', variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ModuleLayout
      title='Familias'
      subtitle='Gestiona las familias que agrupan departamentos, tickets e inventario'
      loading={loading && families.length === 0}
      error={error && families.length === 0 ? error : null}
      onRetry={loadFamilies}
      headerActions={
        isSuperAdmin ? (
          <Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4 mr-2' />
            Nueva Familia
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <ListTableToolbar
            title={
              <CardTitle className='flex items-center gap-2 text-base'>
                <Layers className='h-5 w-5' />
                Familias ({filteredFamilies.length}
                {filteredFamilies.length !== families.length ? ` de ${families.length}` : ''})
              </CardTitle>
            }
            subtitle='Excel incluye hoja Familias + Departamentos. CSV/PDF exportan la tabla visible.'
            loading={loading}
            onRefresh={loadFamilies}
            showViewToggle={false}
            export={{
              onExportCSV: exportCSV,
              onExportExcel: exportExcel,
              onExportPDF: exportPDF,
              loading: exporting,
              disabled: sortedFamilies.length === 0,
            }}
            endActions={
              <>
                <div className='relative flex-1 min-w-0 sm:flex-initial sm:w-52'>
                  <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
                  <Input
                    placeholder='Buscar por nombre o código...'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className='pl-8 h-8 w-full text-sm'
                  />
                  {search && (
                    <button
                      type='button'
                      onClick={() => setSearch('')}
                      className='absolute right-2 top-2 text-muted-foreground hover:text-foreground'
                    >
                      <X className='h-3.5 w-3.5' />
                    </button>
                  )}
                </div>
                <Select
                  value={filterStatus}
                  onValueChange={v => setFilterStatus(v as typeof filterStatus)}
                >
                  <SelectTrigger className='h-8 w-32 text-sm'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    <SelectItem value='active'>Activos</SelectItem>
                    <SelectItem value='inactive'>Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </>
            }
          />
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto -mx-px'>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey='name'
                    currentSort={getSortIcon('name')}
                    onSort={requestSort}
                  >
                    Familia
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey='isActive'
                    currentSort={getSortIcon('isActive')}
                    onSort={requestSort}
                  >
                    Estado
                  </SortableTableHead>
                  <TableHead className='text-center'>Depts</TableHead>
                  <TableHead className='text-center'>Tickets</TableHead>
                  <TableHead className='text-center'>Inventario</TableHead>
                  <TableHead className='text-center'>Técnicos</TableHead>
                  <TableHead className='text-center'>Managers</TableHead>
                  <TableHead className='text-right'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {families.length === 0 && !loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className='text-center py-12 text-muted-foreground'>
                      <Layers className='h-10 w-10 mx-auto mb-3 opacity-30' />
                      <p>No hay familias registradas</p>
                      {isSuperAdmin && (
                        <Button className='mt-3' onClick={openCreateDialog}>
                          <Plus className='h-4 w-4 mr-2' />
                          Crear primera familia
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : filteredFamilies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className='text-center py-12 text-muted-foreground'>
                      <Search className='h-8 w-8 mx-auto mb-2 opacity-30' />
                      <p className='text-sm'>Sin resultados para la búsqueda</p>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='mt-2'
                        onClick={() => {
                          setSearch('')
                          setFilterStatus('all')
                        }}
                      >
                        Limpiar filtros
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedFamilies.map(family => (
                    <TableRow
                      key={family.id}
                      className='cursor-pointer hover:bg-muted/50'
                      onClick={() => router.push(`/admin/families/${family.id}`)}
                    >
                      <TableCell>
                        <div className='flex items-center gap-3'>
                          <div
                            className='w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0'
                            style={{ backgroundColor: family.color || '#6B7280' }}
                          >
                            <FamilyIcon
                              icon={family.icon}
                              color={family.color}
                              code={family.code}
                              className='w-4 h-4'
                            />
                          </div>
                          <div>
                            <p className='font-medium'>{family.name}</p>
                            <Badge variant='outline' className='text-xs mt-0.5'>
                              {family.code}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={family.isActive ? 'default' : 'secondary'}>
                          {family.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <div className='flex items-center justify-center gap-1 text-sm'>
                          <Building className='h-3.5 w-3.5 text-muted-foreground' />
                          {family._count?.departments ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge
                          variant={
                            family.ticketFamilyConfig?.ticketsEnabled ? 'default' : 'secondary'
                          }
                          className='text-xs'
                        >
                          <Ticket className='h-3 w-3 mr-1' />
                          {family.ticketFamilyConfig?.ticketsEnabled ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <Badge variant='outline' className='text-xs'>
                          <Package className='h-3 w-3 mr-1' />
                          {family.formConfig?.inventoryEnabled !== false ? 'Sí' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className='text-center'>
                        <div className='flex items-center justify-center gap-1 text-sm'>
                          <Users className='h-3.5 w-3.5 text-muted-foreground' />
                          {family._count?.technicianFamilyAssignments ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className='text-center'>
                        <div className='flex items-center justify-center gap-1 text-sm'>
                          <Users className='h-3.5 w-3.5 text-muted-foreground' />
                          {family._count?.managerFamilies ?? 0}
                        </div>
                      </TableCell>
                      <TableCell className='text-right'>
                        <div
                          className='flex items-center justify-end gap-1'
                          onClick={e => e.stopPropagation()}
                        >
                          {isSuperAdmin && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation'
                              onClick={() => openEditDialog(family)}
                              title='Editar familia'
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation'
                              onClick={() => handleToggleActive(family)}
                              disabled={toggling === family.id}
                              title={family.isActive ? 'Desactivar' : 'Activar'}
                            >
                              {family.isActive ? (
                                <ToggleRight className='h-4 w-4 text-primary' />
                              ) : (
                                <ToggleLeft className='h-4 w-4 text-muted-foreground' />
                              )}
                            </Button>
                          )}
                          {isSuperAdmin && (
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-10 w-10 sm:h-8 sm:w-8 p-0 text-destructive hover:text-destructive touch-manipulation'
                              onClick={() => openDeleteDialog(family)}
                              title='Eliminar familia'
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          )}
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-10 w-10 sm:h-8 sm:w-8 p-0 touch-manipulation'
                            onClick={() => router.push(`/admin/families/${family.id}`)}
                            title='Ver detalle'
                          >
                            <ChevronRight className='h-4 w-4' />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Crear/Editar */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className='sm:max-w-md' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Editar Familia' : 'Nueva Familia'}</DialogTitle>
            <DialogDescription>
              {editingFamily
                ? 'Modifica los datos base de la familia'
                : 'Crea una nueva familia para agrupar departamentos y configuraciones'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={e => {
              e.preventDefault()
              void handleSubmit()
            }}
          >
            <div className='space-y-4 py-2'>
              <div className='grid grid-cols-2 gap-4'>
                <div className='col-span-2'>
                  <Label htmlFor='family-name'>Nombre *</Label>
                  <Input
                    id='family-name'
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder='Ej: Tecnología'
                  />
                </div>
                <div>
                  <Label htmlFor='family-code'>
                    Código * <span className='text-xs text-muted-foreground'>(máx. 10 chars)</span>
                  </Label>
                  <Input
                    id='family-code'
                    value={formData.code}
                    onChange={e =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase().slice(0, 10) })
                    }
                    placeholder='Ej: TECH'
                    disabled={!!editingFamily}
                    maxLength={10}
                  />
                </div>
                <div>
                  <Label htmlFor='family-color'>Color</Label>
                  <div className='flex gap-2'>
                    <Input
                      id='family-color'
                      type='color'
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      className='w-12 h-9 p-1 cursor-pointer'
                    />
                    <Input
                      value={formData.color}
                      onChange={e => setFormData({ ...formData, color: e.target.value })}
                      placeholder='#6B7280'
                      className='flex-1'
                    />
                  </div>
                </div>
                <div className='col-span-2'>
                  <IconPicker
                    value={formData.icon}
                    onChange={v => setFormData({ ...formData, icon: v })}
                  />
                </div>
                <div className='col-span-2'>
                  <Label htmlFor='family-description'>Descripción</Label>
                  <Textarea
                    id='family-description'
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder='Descripción opcional de la familia'
                    rows={3}
                  />
                </div>
                <div className='col-span-2'>
                  <Label htmlFor='family-whatsapp'>
                    WhatsApp de contacto{' '}
                    <span className='text-xs text-muted-foreground'>(opcional)</span>
                  </Label>
                  <Input
                    id='family-whatsapp'
                    value={formData.contactWhatsapp}
                    onChange={e => setFormData({ ...formData, contactWhatsapp: e.target.value })}
                    placeholder='Ej: 593987654321 (sin + ni espacios)'
                    maxLength={30}
                  />
                  <p className='text-xs text-muted-foreground mt-1'>
                    Número con código de país (ej. 593987654321). Catálogo público de equipos en
                    desuso de esta familia; si está vacío, se usa el WhatsApp del landing.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => setShowFormDialog(false)}>
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting}>
                {submitting ? 'Guardando...' : editingFamily ? 'Guardar cambios' : 'Crear familia'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar familia?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingFamily && (
                <>
                  Estás a punto de eliminar la familia{' '}
                  <span className='font-semibold text-foreground'>
                    &quot;{deletingFamily.name}&quot;
                  </span>{' '}
                  (código: <span className='font-mono'>{deletingFamily.code}</span>).
                  <div className='mt-3 p-3 bg-muted border rounded-md text-sm text-muted-foreground'>
                    <p className='font-medium mb-1'>Registros asociados:</p>
                    <ul className='list-disc list-inside space-y-0.5'>
                      <li>{deletingFamily._count?.departments ?? 0} departamentos</li>
                      <li>{deletingFamily._count?.tickets ?? 0} tickets</li>
                      <li>
                        {deletingFamily._count?.technicianFamilyAssignments ?? 0} asignaciones de
                        técnicos
                      </li>
                    </ul>
                  </div>
                  <p className='mt-2 text-sm'>
                    Si hay tickets o registros de inventario asociados, la eliminación será
                    rechazada.
                  </p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
