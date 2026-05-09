/**
 * Component: SupplierTypesSection
 * Sección para gestión de tipos de proveedor (globales y por familia)
 */

import { useState } from 'react'
import {
  useSupplierTypeManagement,
  SupplierType,
} from '@/hooks/inventory/use-supplier-type-management'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  RefreshCw,
  Truck,
  Edit,
  Trash2,
  Globe,
  AlertTriangle,
  Download,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { useTableSort } from '@/hooks/common/use-table-sort'
import { SortableTableHead } from '@/components/ui/sortable-table-head'
import { useExport } from '@/hooks/common/use-export'

interface SupplierTypesSectionProps {
  families: Array<{ id: string; name: string; code: string; color: string | null }>
}

export function SupplierTypesSection({ families }: SupplierTypesSectionProps) {
  const {
    supplierTypes,
    loading,
    saving,
    createSupplierType,
    updateSupplierType,
    deleteSupplierType,
  } = useSupplierTypeManagement(null, true) // Cargar todos (globales + por familia)

  const [formOpen, setFormOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<SupplierType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [typeToDelete, setTypeToDelete] = useState<SupplierType | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [familyId, setFamilyId] = useState<string>('global')
  const [isActive, setIsActive] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = !!selectedType

  // Sorting
  const { sortedData, requestSort, getSortIcon } = useTableSort(supplierTypes, {
    key: 'name',
    direction: 'asc',
  })

  // Export configuration
  const exportColumns = [
    { header: 'Nombre', accessor: (t: SupplierType) => t.name },
    { header: 'Descripción', accessor: (t: SupplierType) => t.description || '' },
    { header: 'Ámbito', accessor: (t: SupplierType) => t.family?.name || 'Global' },
    { header: 'Proveedores', accessor: (t: SupplierType) => t._count?.suppliers || 0 },
    { header: 'Estado', accessor: (t: SupplierType) => (t.isActive ? 'Activo' : 'Inactivo') },
  ]

  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => supplierTypes,
    columns: exportColumns,
    filename: 'tipos-proveedor',
    title: 'Tipos de Proveedor',
    subtitle: `${supplierTypes.length} tipo${supplierTypes.length !== 1 ? 's' : ''}`,
  })

  const handleCreate = () => {
    setSelectedType(null)
    setName('')
    setDescription('')
    setFamilyId('global')
    setIsActive(true)
    setErrors({})
    setFormOpen(true)
  }

  const handleEdit = (type: SupplierType) => {
    setSelectedType(type)
    setName(type.name)
    setDescription(type.description || '')
    setFamilyId(type.familyId || 'global')
    setIsActive(type.isActive)
    setErrors({})
    setFormOpen(true)
  }

  const handleDelete = (type: SupplierType) => {
    setTypeToDelete(type)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    if (!typeToDelete) return

    const success = await deleteSupplierType(typeToDelete.id)
    if (success) {
      setDeleteDialogOpen(false)
      setTypeToDelete(null)
    }
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'El nombre es requerido'
    } else if (name.length < 2) {
      newErrors.name = 'El nombre debe tener al menos 2 caracteres'
    } else if (name.length > 100) {
      newErrors.name = 'El nombre no puede exceder 100 caracteres'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      familyId: familyId === 'global' ? null : familyId,
      isActive,
    }

    let success = false

    if (selectedType) {
      success = await updateSupplierType(selectedType.id, data)
    } else {
      const result = await createSupplierType(data)
      success = !!result
    }

    if (success) {
      setFormOpen(false)
      setSelectedType(null)
    }
  }

  const totalItems = typeToDelete ? typeToDelete._count?.suppliers || 0 : 0

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-start justify-between gap-4'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <Truck className='h-5 w-5' />
                Tipos de Proveedor
              </CardTitle>
              <CardDescription>
                Define tipos de proveedor globales o específicos por área
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              {supplierTypes.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='outline' size='sm' disabled={exporting || loading}>
                      <Download className='h-4 w-4 mr-2' />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align='end'>
                    <DropdownMenuLabel>Formato</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={exportCSV}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportExcel}>Excel</DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPDF}>PDF</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
                <Plus className='h-4 w-4 mr-1.5' />
                Nuevo Tipo
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className='flex items-center justify-center py-12'>
              <RefreshCw className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
          ) : supplierTypes.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-12 text-center'>
              <Truck className='h-12 w-12 text-muted-foreground/30 mb-4' />
              <p className='text-base font-medium text-muted-foreground'>
                No hay tipos de proveedor
              </p>
              <p className='text-sm text-muted-foreground mt-1 mb-4'>
                Crea el primer tipo de proveedor
              </p>
              <Button onClick={handleCreate} size='sm'>
                <Plus className='h-4 w-4 mr-1.5' />
                Crear Tipo
              </Button>
            </div>
          ) : (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      sortKey='name'
                      currentSort={getSortIcon('name')}
                      onSort={requestSort}
                      className='w-[25%]'
                    >
                      Nombre
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey='description'
                      currentSort={getSortIcon('description')}
                      onSort={requestSort}
                      className='w-[30%]'
                    >
                      Descripción
                    </SortableTableHead>
                    <SortableTableHead
                      sortKey='family.name'
                      currentSort={getSortIcon('family.name')}
                      onSort={requestSort}
                      className='w-[20%]'
                    >
                      Ámbito
                    </SortableTableHead>
                    <TableHead className='text-center w-[15%]'>Proveedores</TableHead>
                    <TableHead className='text-right w-[10%]'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.map(type => {
                    const totalTypeItems = type._count?.suppliers || 0

                    return (
                      <TableRow key={type.id}>
                        <TableCell className='align-top'>
                          <div className='flex items-start gap-2'>
                            <Truck className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
                            <span className='font-medium text-sm break-words'>{type.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className='text-sm text-muted-foreground align-top'>
                          <span className='break-words'>{type.description || '—'}</span>
                        </TableCell>
                        <TableCell className='align-top'>
                          {type.family ? (
                            <div className='flex items-start gap-2'>
                              <div
                                className='w-3 h-3 rounded-full flex-shrink-0 mt-0.5'
                                style={{ backgroundColor: type.family.color || '#6B7280' }}
                              />
                              <span className='text-sm break-words'>{type.family.name}</span>
                            </div>
                          ) : (
                            <div className='flex items-center gap-1.5 text-muted-foreground'>
                              <Globe className='h-3.5 w-3.5' />
                              <span className='text-sm'>Global</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className='text-center align-top'>
                          <Badge variant='secondary' className='font-mono'>
                            {totalTypeItems}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right align-top'>
                          <div className='flex items-center justify-end gap-1'>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0'
                              onClick={() => handleEdit(type)}
                              disabled={saving}
                              title='Editar tipo'
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0'
                              onClick={() =>
                                updateSupplierType(type.id, { isActive: !type.isActive })
                              }
                              disabled={saving}
                              title={type.isActive ? 'Desactivar tipo' : 'Activar tipo'}
                            >
                              {type.isActive ? (
                                <CheckCircle className='h-4 w-4 text-green-600 dark:text-green-500' />
                              ) : (
                                <XCircle className='h-4 w-4 text-muted-foreground' />
                              )}
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0'
                              onClick={() => handleDelete(type)}
                              disabled={saving}
                              title='Eliminar tipo'
                            >
                              <Trash2 className='h-4 w-4 text-destructive' />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de formulario */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Editar Tipo de Proveedor' : 'Nuevo Tipo de Proveedor'}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? 'Modifica los datos del tipo de proveedor'
                  : 'Completa los datos para crear un nuevo tipo de proveedor'}
              </DialogDescription>
            </DialogHeader>

            <div className='space-y-4 py-4'>
              {/* Nombre */}
              <div className='space-y-2'>
                <Label htmlFor='name'>
                  Nombre <span className='text-destructive'>*</span>
                </Label>
                <Input
                  id='name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder='Ej: Proveedor Nacional'
                  maxLength={100}
                  disabled={saving}
                  className={errors.name ? 'border-destructive' : ''}
                />
                {errors.name && <p className='text-xs text-destructive'>{errors.name}</p>}
              </div>

              {/* Descripción */}
              <div className='space-y-2'>
                <Label htmlFor='description'>Descripción</Label>
                <Textarea
                  id='description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder='Descripción opcional del tipo de proveedor'
                  rows={3}
                  disabled={saving}
                />
              </div>

              {/* Ámbito (Familia) */}
              <div className='space-y-2'>
                <Label htmlFor='family'>Ámbito</Label>
                <Select value={familyId || 'global'} onValueChange={setFamilyId} disabled={saving}>
                  <SelectTrigger id='family'>
                    <SelectValue placeholder='Global (todas las áreas)' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='global'>
                      <div className='flex items-center gap-2'>
                        <Globe className='h-3.5 w-3.5' />
                        Global (todas las áreas)
                      </div>
                    </SelectItem>
                    {families.map(family => (
                      <SelectItem key={family.id} value={family.id}>
                        <div className='flex items-center gap-2'>
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: family.color || '#6B7280' }}
                          />
                          {family.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className='text-xs text-muted-foreground'>
                  Los tipos globales están disponibles en todas las áreas
                </p>
              </div>

              {/* Estado */}
              {isEditing && (
                <div className='flex items-center justify-between p-3 border rounded-lg'>
                  <div>
                    <Label htmlFor='isActive' className='cursor-pointer'>
                      Tipo activo
                    </Label>
                    <p className='text-xs text-muted-foreground'>
                      Los tipos inactivos no aparecen en los formularios
                    </p>
                  </div>
                  <Switch
                    id='isActive'
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    disabled={saving}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setFormOpen(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={saving}>
                {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Crear Tipo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className='flex items-center gap-2'>
              <AlertTriangle className='h-5 w-5 text-destructive' />
              {totalItems > 0 ? 'Desactivar Tipo de Proveedor' : 'Eliminar Tipo de Proveedor'}
            </AlertDialogTitle>
            <AlertDialogDescription className='space-y-2'>
              {totalItems > 0 ? (
                <>
                  <p>
                    Este tipo de proveedor tiene <strong>{totalItems} items asignados</strong> y no
                    puede ser eliminado.
                  </p>
                  <p>Se desactivará para que no aparezca en los formularios.</p>
                  <p className='text-sm text-muted-foreground'>
                    Los items existentes mantendrán su tipo de proveedor.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    ¿Estás seguro de que deseas eliminar el tipo de proveedor{' '}
                    <strong>{typeToDelete?.name}</strong>?
                  </p>
                  <p className='text-sm text-muted-foreground'>Esta acción no se puede deshacer.</p>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={saving}>
              {saving
                ? 'Procesando...'
                : totalItems > 0
                  ? 'Desactivar'
                  : 'Eliminar Definitivamente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
