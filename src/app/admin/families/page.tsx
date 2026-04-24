'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Edit,
  Trash2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
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
import { useTableSort, SortIcon, sortableHeaderClass } from '@/hooks/common/use-table-sort'

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
}

const DEFAULT_FORM: FamilyFormData = {
  name: '',
  code: '',
  description: '',
  color: '#6B7280',
  icon: '',
}

export default function FamiliesPage() {
  const router = useRouter()
  const { toast } = useToast()

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
    sorted: sortedFamilies,
    sortKey,
    sortDir,
    toggleSort,
  } = useTableSort(filteredFamilies, 'name')

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
        <div className='flex items-center space-x-2'>
          <Button variant='outline' size='sm' onClick={loadFamilies} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recargar
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4 mr-2' />
            Nueva Familia
          </Button>
        </div>
      }
    >
      <Card>
        <CardHeader>
          <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
            <CardTitle className='flex items-center gap-2 flex-1'>
              <Layers className='h-5 w-5' />
              Familias ({filteredFamilies.length}
              {filteredFamilies.length !== families.length ? ` de ${families.length}` : ''})
            </CardTitle>
            <div className='flex items-center gap-2 flex-wrap'>
              {/* Search */}
              <div className='relative'>
                <Search className='absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground' />
                <Input
                  placeholder='Buscar por nombre o código...'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className='pl-8 h-8 w-52 text-sm'
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className='absolute right-2 top-2 text-muted-foreground hover:text-foreground'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                )}
              </div>
              {/* Status filter */}
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
            </div>
          </div>
        </CardHeader>
        <CardContent className='p-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={sortableHeaderClass} onClick={() => toggleSort('name')}>
                  Familia {SortIcon('name', sortKey, sortDir)}
                </TableHead>
                <TableHead className={sortableHeaderClass} onClick={() => toggleSort('isActive')}>
                  Estado {SortIcon('isActive', sortKey, sortDir)}
                </TableHead>
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
                    <Button className='mt-3' onClick={openCreateDialog}>
                      <Plus className='h-4 w-4 mr-2' />
                      Crear primera familia
                    </Button>
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
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
                          onClick={() => openEditDialog(family)}
                          title='Editar familia'
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
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
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                          onClick={() => openDeleteDialog(family)}
                          title='Eliminar familia'
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
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
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowFormDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Guardando...' : editingFamily ? 'Guardar cambios' : 'Crear familia'}
            </Button>
          </DialogFooter>
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
