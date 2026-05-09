/**
 * Component: SupplierTypesSection
 * Sección para gestión de tipos de proveedor (globales y por familia)
 */

import { useState } from 'react'
import {
  useSupplierTypeManagement,
  SupplierType,
} from '@/hooks/inventory/use-supplier-type-management'
import { useExport } from '@/hooks/common/use-export'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable, type Column } from '@/components/ui/data-table'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Truck,
  Edit,
  Trash2,
  Globe,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
} from 'lucide-react'

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

  // Estado para paginación
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Export configuration
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    getData: () => supplierTypes,
    columns: [
      { header: 'Nombre', accessor: (t: SupplierType) => t.name },
      { header: 'Descripción', accessor: (t: SupplierType) => t.description || '' },
      { header: 'Ámbito', accessor: (t: SupplierType) => t.family?.name || 'Global' },
      { header: 'Proveedores', accessor: (t: SupplierType) => String(t._count?.suppliers || 0) },
      { header: 'Estado', accessor: (t: SupplierType) => (t.isActive ? 'Activo' : 'Inactivo') },
    ],
    filename: `tipos-proveedor`,
    title: 'Tipos de Proveedor',
    subtitle: `${supplierTypes.length} tipo${supplierTypes.length !== 1 ? 's' : ''}`,
  })

  // Configuración de columnas para DataTable
  const columns: Column<SupplierType>[] = [
    {
      key: 'name',
      label: 'Nombre',
      sortable: true,
      render: (type: SupplierType) => (
        <div className='flex items-start gap-2'>
          <Truck className='h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0' />
          <span className='font-medium text-sm break-words'>{type.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Descripción',
      sortable: true,
      render: (type: SupplierType) => (
        <span className='text-sm text-muted-foreground break-words'>{type.description || '—'}</span>
      ),
    },
    {
      key: 'family',
      label: 'Ámbito',
      sortable: true,
      width: '180px',
      render: (type: SupplierType) =>
        type.family ? (
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
        ),
    },
    {
      key: 'suppliers',
      label: 'Proveedores',
      sortable: true,
      width: '120px',
      render: (type: SupplierType) => (
        <div className='text-center'>
          <Badge variant='secondary' className='font-mono'>
            {type._count?.suppliers || 0}
          </Badge>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      width: '100px',
      render: (type: SupplierType) =>
        type.isActive ? (
          <div className='flex items-center justify-center gap-1.5 text-green-600 dark:text-green-500'>
            <CheckCircle className='h-4 w-4' />
          </div>
        ) : (
          <div className='flex items-center justify-center gap-1.5 text-muted-foreground'>
            <XCircle className='h-4 w-4' />
          </div>
        ),
    },
  ]

  return (
    <>
      <DataTable
        title='Tipos de Proveedor'
        description='Define tipos de proveedor globales o específicos por área'
        data={supplierTypes}
        columns={columns}
        loading={loading}
        searchable={true}
        searchPlaceholder='Buscar por nombre...'
        externalSearch={false}
        onExport={
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
        }
        pagination={{
          page,
          limit,
          total: supplierTypes.length,
          onPageChange: setPage,
          onLimitChange: newLimit => {
            setLimit(newLimit)
            setPage(1)
          },
        }}
        actions={
          <Button onClick={handleCreate} disabled={loading || saving} size='sm'>
            <Plus className='h-4 w-4 mr-2' />
            Nuevo Tipo
          </Button>
        }
        rowActions={(type: SupplierType) => (
          <div className='flex items-center justify-end gap-1'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => handleEdit(type)}
              disabled={saving}
              title='Editar tipo'
            >
              <Edit className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => updateSupplierType(type.id, { isActive: !type.isActive })}
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
              onClick={() => handleDelete(type)}
              disabled={saving}
              title='Eliminar tipo'
            >
              <Trash2 className='h-4 w-4 text-destructive' />
            </Button>
          </div>
        )}
        emptyState={{
          icon: <Truck className='h-12 w-12 text-muted-foreground/30 mb-4' />,
          title: 'No hay tipos de proveedor',
          description: 'Crea el primer tipo de proveedor',
          action: (
            <Button onClick={handleCreate} size='sm'>
              <Plus className='h-4 w-4 mr-2' />
              Crear Tipo
            </Button>
          ),
        }}
      />

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
                    Este tipo de proveedor tiene <strong>{totalItems} proveedores asignados</strong>{' '}
                    y no puede ser eliminado.
                  </p>
                  <p>Se desactivará para que no aparezca en los formularios.</p>
                  <p className='text-sm text-muted-foreground'>
                    Los proveedores existentes mantendrán su tipo.
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
