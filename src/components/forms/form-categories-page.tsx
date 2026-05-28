'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus,
  RefreshCw,
  Search,
  Edit,
  Trash2,
  FileText,
  Settings,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Label } from '@/components/ui/label'
import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import type { ColumnConfig } from '@/components/ui/data-table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface FormCategory {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: {
    forms: number
  }
}

export default function FormCategoriesPage() {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [categories, setCategories] = useState<FormCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FormCategory | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<FormCategory | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/form-categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data.categories || [])
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (category.description && category.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleNew = () => {
    setEditingCategory(null)
    setFormData({ name: '', description: '', isActive: true })
    setShowCreateDialog(true)
  }

  const handleEdit = (category: FormCategory) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      description: category.description || '',
      isActive: category.isActive,
    })
    setShowCreateDialog(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      const url = editingCategory
        ? `/api/admin/form-categories/${editingCategory.id}`
        : '/api/admin/form-categories'
      const method = editingCategory ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: editingCategory
            ? 'Categoría actualizada correctamente'
            : 'Categoría creada correctamente',
        })
        setShowCreateDialog(false)
        await loadCategories()
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar la categoría',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCategory) return
    try {
      setDeleting(true)
      const response = await fetch(`/api/admin/form-categories/${deletingCategory.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Categoría eliminada correctamente',
        })
        setDeletingCategory(null)
        await loadCategories()
      } else {
        const data = await response.json()
        toast({
          title: 'Error',
          description: data.error || 'No se pudo eliminar la categoría',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const columns: ColumnConfig<FormCategory>[] = [
    {
      key: 'name',
      label: 'Categoría',
      sortable: true,
      render: (category) => (
        <div className='flex items-center gap-2'>
          <FileText className='h-4 w-4 text-muted-foreground' />
          <div>
            <div className='font-medium'>{category.name}</div>
            {category.description && (
              <div className='text-xs text-muted-foreground'>{category.description}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      sortable: true,
      render: (category) => (
        <Badge variant={category.isActive ? 'default' : 'secondary'}>
          {category.isActive ? 'Activa' : 'Inactiva'}
        </Badge>
      ),
    },
    {
      key: 'forms',
      label: 'Documentos',
      sortable: true,
      render: (category) => (
        <span className='text-sm text-muted-foreground'>
          {category._count?.forms || 0}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Creado',
      sortable: true,
      render: (category) => (
        <span className='text-sm text-muted-foreground'>
          {new Date(category.createdAt).toLocaleDateString('es-EC')}
        </span>
      ),
    },
  ]

  return (
    <ModuleLayout
      title='Gestión de Categorías de Documentos'
      subtitle='Organiza tus documentos en categorías'
      loading={loading && categories.length === 0}
      headerActions={
        <Button onClick={handleNew}>
          <Plus className='h-4 w-4 mr-2' />
          Nueva Categoría
        </Button>
      }
    >
      <div className='space-y-4'>
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <Settings className='h-5 w-5' />
                  Categorías de Documentos
                </CardTitle>
                <CardDescription>
                  {filteredCategories.length} categorías
                  {searchTerm && ' (filtradas)'}
                </CardDescription>
              </div>
              <Button variant='outline' size='sm' onClick={loadCategories} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className='mb-4'>
              <Input
                placeholder='Buscar categorías...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                prefix={<Search className='h-4 w-4 text-muted-foreground' />}
              />
            </div>

            <DataTable
              data={filteredCategories}
              columns={columns}
              loading={loading}
              actions={(category) => [
                {
                  label: 'Editar',
                  icon: Edit,
                  onClick: () => handleEdit(category),
                },
                {
                  label: 'Eliminar',
                  icon: Trash2,
                  variant: 'destructive',
                  onClick: () => setDeletingCategory(category),
                  disabled: (category._count?.forms || 0) > 0,
                },
              ]}
              emptyMessage={
                searchTerm
                  ? 'No se encontraron categorías que coincidan con la búsqueda'
                  : 'No hay categorías disponibles'
              }
            />
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? 'Actualiza la información de la categoría'
                : 'Crea una nueva categoría para organizar tus documentos'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='name'>Nombre</Label>
              <Input
                id='name'
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='Ej: Formularios de registro'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='description'>Descripción (opcional)</Label>
              <Input
                id='description'
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder='Breve descripción de la categoría'
              />
            </div>
            <div className='flex items-center gap-2'>
              <input
                type='checkbox'
                id='isActive'
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className='h-4 w-4'
              />
              <Label htmlFor='isActive'>Categoría activa</Label>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setShowCreateDialog(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type='submit' disabled={submitting || !formData.name}>
                {submitting ? 'Guardando...' : 'Guardar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingCategory && (
                <div>
                  <p className='mb-3'>
                    Estás a punto de eliminar{' '}
                    <span className='font-semibold'>{deletingCategory.name}</span>
                  </p>
                  {(deletingCategory._count?.forms || 0) > 0 ? (
                    <div className='p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400'>
                      ⚠️ No se puede eliminar esta categoría porque tiene{' '}
                      {deletingCategory._count?.forms} documento(s) asociado(s).
                    </div>
                  ) : (
                    <p className='text-sm text-muted-foreground'>
                      Esta acción no se puede deshacer.
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting || (deletingCategory?._count?.forms || 0) > 0}
              className='bg-red-600 hover:bg-red-700'
            >
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
