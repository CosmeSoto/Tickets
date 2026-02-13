'use client'

import { Plus, FolderTree, RefreshCw, Search, ChevronDown, ChevronRight, List, Edit, Trash2, Ticket, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
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

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'

// Componentes comunes
import { DataTableAdvanced } from '@/components/common/data-table-advanced'
import type { ColumnConfig, ActionConfig, MassActionConfig } from '@/components/common/data-table-advanced'

// Componentes específicos del módulo
import { CategoryTree } from '@/components/ui/category-tree'
import { useCategories } from '@/hooks/categories'
import { CategoryFormDialog } from './category-form-dialog'
import { CategoryStatsPanel } from './category-stats-panel'
import { getCategoryLevelIcon } from '@/lib/constants/category-constants'

export default function CategoriesPage() {
  const {
    // Estados principales
    categories,
    availableParents,
    availableTechnicians,
    departments,
    loading,
    error,
    
    // Estados de filtros del hook
    searchTerm,
    setSearchTerm,
    levelFilter,
    setLevelFilter,
    viewMode,
    setViewMode,
    
    // Estados de formulario
    isDialogOpen,
    setIsDialogOpen,
    editingCategory,
    deletingCategory,
    setDeletingCategory,
    formData,
    setFormData,
    formErrors,
    submitting,
    deleting,
    
    // Datos procesados (ya filtrados)
    filteredCategories,
    stats,
    
    // Paginación y acciones masivas
    pagination,
    massActions,
    
    // Funciones principales
    loadCategories,
    loadAvailableParents,
    loadAvailableTechnicians,
    loadDepartments,
    handleSubmit,
    handleDelete,
    handleEdit,
    handleNew,
    resetForm,
    
    // Funciones de utilidad
    refresh,
  } = useCategories({
    cacheTTL: 5 * 60 * 1000, // 5 minutos
    enableCache: true,
    autoRefresh: false,
    enablePagination: true,
    pageSize: 20,
    enableMassActions: true,
  })

  // Obtener datos paginados
  const paginatedCategories = pagination ? pagination.currentItems : filteredCategories

  // Configuración de paginación para UnifiedDataTable
  const paginationConfig = pagination ? {
    page: pagination.currentPage,
    limit: pagination.pageSize,
    total: pagination.totalItems,
    totalPages: pagination.totalPages,
    onPageChange: (page: number) => pagination.goToPage(page),
    onLimitChange: (limit: number) => pagination.setPageSize(limit),
  } : undefined

  // Configuración de columnas para UnifiedDataTable
  const categoryColumns: ColumnConfig<any>[] = [
    {
      key: 'name',
      header: 'Categoría',
      sortable: true,
      render: (category: any) => (
        <div className="flex items-center space-x-3">
          <div
            className='w-3 h-3 rounded-full flex-shrink-0'
            style={{ backgroundColor: category.color }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              {(() => {
                const IconComponent = getCategoryLevelIcon(category.level.toString())
                return <IconComponent className="h-4 w-4" />
              })()}
              <span className="font-semibold text-sm text-foreground truncate">
                {category.name}
              </span>
              <Badge variant={category.isActive ? 'default' : 'secondary'} className="text-xs">
                {category.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
              <Badge variant='outline' className="text-xs">{category.levelName}</Badge>
            </div>
            {category.description && (
              <p className='text-xs text-muted-foreground truncate mt-1'>
                {category.description}
              </p>
            )}
            {category.parent && (
              <p className='text-xs text-muted-foreground mt-1'>
                Padre: {category.parent.name}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'tickets',
      header: 'Tickets',
      width: '100px',
      sortable: true,
      align: 'center',
      render: (category: any) => (
        <div className="flex items-center space-x-1 text-sm cursor-pointer hover:text-blue-600" 
             onClick={(e) => {
               e.stopPropagation()
               window.open(`/admin/tickets?category=${category.id}`, '_blank')
             }}
             title="Click para ver tickets de esta categoría">
          <Ticket className="h-4 w-4 text-muted-foreground" />
          <span>{category._count?.tickets || 0}</span>
        </div>
      ),
    },
    {
      key: 'technicians',
      header: 'Técnicos',
      width: '100px',
      sortable: true,
      align: 'center',
      render: (category: any) => (
        <div className="flex items-center space-x-1 text-sm cursor-pointer hover:text-green-600" 
             onClick={(e) => {
               e.stopPropagation()
               window.open(`/admin/technicians?category=${category.id}`, '_blank')
             }}
             title="Click para ver técnicos asignados">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{category.technician_assignments?.length || 0}</span>
        </div>
      ),
    },
    {
      key: 'subcategories',
      header: 'Subcategorías',
      width: '120px',
      sortable: true,
      align: 'center',
      render: (category: any) => (
        <div className="flex items-center space-x-1 text-sm cursor-pointer hover:text-purple-600" 
             onClick={(e) => {
               e.stopPropagation()
               window.open(`/admin/categories?parent=${category.id}`, '_blank')
             }}
             title="Click para ver subcategorías">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span>{category._count?.other_categories || 0}</span>
        </div>
      ),
    }
  ]

  // Configuración de acciones por fila
  const rowActions: ActionConfig<any>[] = [
    {
      key: 'edit',
      label: 'Editar',
      icon: Edit,
      onClick: (category) => handleEdit(category),
      variant: 'default',
      description: 'Modifica el nombre, descripción y configuración de esta categoría'
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      onClick: (category) => setDeletingCategory(category),
      variant: 'destructive',
      disabled: (category) => !category.canDelete,
      description: 'Elimina permanentemente esta categoría del sistema'
    }
  ]

  // Configuración de acciones masivas
  const massActionsConfig: MassActionConfig<any>[] = [
    {
      key: 'activate',
      label: 'Activar',
      onClick: async (categories) => {
        if (massActions) {
          await massActions.bulkActivate(categories)
        }
      },
      variant: 'default'
    },
    {
      key: 'deactivate',
      label: 'Desactivar',
      onClick: async (categories) => {
        if (massActions) {
          await massActions.bulkDeactivate(categories)
        }
      },
      variant: 'outline'
    },
    {
      key: 'delete',
      label: 'Eliminar',
      onClick: async (categories) => {
        if (massActions) {
          await massActions.bulkDelete(categories)
        }
      },
      variant: 'destructive',
      confirmMessage: '¿Estás seguro de que quieres eliminar las categorías seleccionadas?'
    }
  ]

  // Construir jerarquía para vista árbol
  const buildHierarchy = (cats: any[]): any[] => {
    // Crear mapa de categorías por ID con todos sus datos
    const categoryMap = new Map()
    
    // Primero, crear nodos con estructura completa
    cats.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [] // Inicializar array de hijos
      })
    })
    
    // Construir jerarquía
    const roots: any[] = []
    
    cats.forEach(cat => {
      const node = categoryMap.get(cat.id)
      if (!node) return
      
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        // Agregar como hijo al padre
        const parent = categoryMap.get(cat.parentId)
        if (parent) {
          parent.children.push(node)
        }
      } else {
        // Es raíz (nivel 1 o sin padre)
        roots.push(node)
      }
    })
    
    return roots
  }

  // Preparar datos para vista árbol
  const hierarchicalCategories = useMemo(() => {
    if (viewMode !== 'tree') return []
    
    // Para vista árbol, usar todas las categorías filtradas (sin paginación)
    const hierarchy = buildHierarchy(filteredCategories)
    console.log('🌳 Hierarchy built:', {
      totalCategories: filteredCategories.length,
      rootNodes: hierarchy.length,
      firstRoot: hierarchy[0]
    })
    return hierarchy
  }, [viewMode, filteredCategories])

  return (
    <ModuleLayout
      title='Gestión de Categorías'
      subtitle='Sistema de gestión de categorías con 4 niveles jerárquicos'
      loading={loading && categories.length === 0}
      error={error && categories.length === 0 ? error : null}
      onRetry={refresh}
      headerActions={
        <div className="flex items-center space-x-2">
          {massActions && massActions.selectedCount > 0 && (
            <Badge variant='outline'>
              {massActions.selectedCount} seleccionado{massActions.selectedCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleNew}>
                  <Plus className='h-4 w-4 mr-2' />
                  Nueva Categoría
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Crea una nueva categoría en el sistema de clasificación</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <div className='space-y-6'>
        {/* Panel de estado del sistema */}
        <CategoryStatsPanel stats={stats} loading={loading} />

        {/* Vista de Categorías - Card principal */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FolderTree className="h-5 w-5" />
                  <span>Categorías</span>
                </CardTitle>
                <CardDescription>
                  Categorías con 4 niveles jerárquicos • {filteredCategories.length} categorías
                </CardDescription>
              </div>
              <div className='flex items-center space-x-2'>
                <TooltipProvider>
                  {viewMode === 'tree' && (
                    <div className="flex items-center border rounded-md mr-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const expandEvent = new CustomEvent('expandAllCategories')
                              window.dispatchEvent(expandEvent)
                            }}
                            className="rounded-r-none border-r px-3"
                            disabled={loading}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Expandir todas las categorías para ver la jerarquía completa</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const collapseEvent = new CustomEvent('collapseAllCategories')
                              window.dispatchEvent(collapseEvent)
                            }}
                            className="rounded-l-none px-3"
                            disabled={loading}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Contraer todas las categorías para ver solo el nivel superior</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant='outline'
                        size='sm'
                        onClick={refresh}
                        disabled={loading}
                      >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Actualizar lista de categorías</p>
                    </TooltipContent>
                  </Tooltip>
                  <div className='flex items-center border rounded-md'>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === 'table' ? 'default' : 'ghost'}
                          size='sm'
                          onClick={() => setViewMode('table')}
                          className='rounded-r-none'
                        >
                          <List className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Vista de tabla con todas las categorías en lista</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === 'tree' ? 'default' : 'ghost'}
                          size='sm'
                          onClick={() => setViewMode('tree')}
                          className='rounded-l-none'
                        >
                          <FolderTree className='h-4 w-4' />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Vista de árbol jerárquico con niveles expandibles</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {/* Filtros y búsqueda en un bloque */}
            <div className='space-y-4 mb-6'>
              <div className='flex flex-col sm:flex-row gap-4'>
                <div className='flex-1'>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                    <Input
                      placeholder='Buscar categorías por nombre o descripción...'
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className='pl-10'
                    />
                  </div>
                </div>
                <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as any)}>
                  <SelectTrigger className='w-full sm:w-[200px]'>
                    <SelectValue placeholder='Nivel' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos los niveles</SelectItem>
                    <SelectItem value='1'>Nivel 1 - Principal</SelectItem>
                    <SelectItem value='2'>Nivel 2 - Secundario</SelectItem>
                    <SelectItem value='3'>Nivel 3 - Terciario</SelectItem>
                    <SelectItem value='4'>Nivel 4 - Específico</SelectItem>
                  </SelectContent>
                </Select>
                <Select value="all" onValueChange={() => {}}>
                  <SelectTrigger className='w-full sm:w-[180px]'>
                    <SelectValue placeholder='Departamento' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos los departamentos</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value="all" onValueChange={() => {}}>
                  <SelectTrigger className='w-full sm:w-[150px]'>
                    <SelectValue placeholder='Estado' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    <SelectItem value='active'>Activas</SelectItem>
                    <SelectItem value='inactive'>Inactivas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Vista condicional */}
            {viewMode === 'tree' ? (
              <>
                {(pagination ? pagination.totalItems : filteredCategories.length) === 0 ? (
                  <div className='text-center py-8'>
                    <FolderTree className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                    <p className='text-muted-foreground'>
                      {searchTerm || levelFilter !== 'all' 
                        ? 'No se encontraron categorías que coincidan con los filtros' 
                        : 'No hay categorías disponibles'}
                    </p>
                    {(searchTerm || levelFilter !== 'all') && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchTerm('')
                          setLevelFilter('all')
                        }}
                        className='mt-2'
                      >
                        Limpiar filtros
                      </Button>
                    )}
                  </div>
                ) : (
                  <CategoryTree
                    categories={hierarchicalCategories.map(cat => ({
                      ...cat,
                      _count: {
                        tickets: cat._count?.tickets || 0,
                        children: cat.children?.length || 0
                      },
                      assignedTechnicians: Array.isArray(cat.technician_assignments)
                        ? cat.technician_assignments
                            .filter((ta: any) => ta?.users?.id)
                            .map((ta: any) => ({
                              id: ta.users.id,
                              name: ta.users.name,
                              email: ta.users.email,
                              priority: ta.priority || 0,
                              maxTickets: ta.maxTickets || 0,
                              autoAssign: ta.autoAssign || false
                            }))
                        : []
                    }))}
                    onEdit={(category: any) => {
                      const originalCategory = filteredCategories.find(c => c.id === category.id)
                      if (originalCategory) handleEdit(originalCategory)
                    }}
                    onDelete={(category: any) => {
                      const originalCategory = filteredCategories.find(c => c.id === category.id)
                      if (originalCategory) setDeletingCategory(originalCategory)
                    }}
                    searchTerm={searchTerm}
                  />
                )}
              </>
            ) : (
              <DataTableAdvanced
                data={paginatedCategories}
                columns={categoryColumns}
                loading={loading}
                error={error}
                
                // Paginación
                pagination={paginationConfig}
                
                // Interacción
                onRowClick={(category) => handleEdit(category)}
                selectable={true}
                selectedItems={[]}
                onSelectionChange={(items) => {
                  console.log('Selección cambiada:', items)
                }}
                
                // Acciones
                actions={rowActions}
                massActions={massActionsConfig}
                
                // Configuración
                userRole="ADMIN"
                variant="default"
                sortable={true}
                defaultSort={{ key: 'name', direction: 'asc' }}
                
                // Callbacks
                onRefresh={refresh}
                
                // Mensajes
                emptyMessage={
                  searchTerm || levelFilter !== 'all'
                    ? 'No se encontraron categorías que coincidan con los filtros'
                    : 'No hay categorías disponibles'
                }
                showStats={false}
                exportable={false}
              />
            )}
          </CardContent>
        </Card>

        {/* Dialog para crear/editar categoría */}
        <CategoryFormDialog
          isOpen={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          editingCategory={editingCategory}
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
          submitting={submitting}
          availableParents={availableParents}
          availableTechnicians={availableTechnicians}
          departments={departments}
          onSubmit={handleSubmit}
          onLoadAvailableParents={loadAvailableParents}
          onLoadDepartments={loadDepartments}
        />

        {/* Dialog de confirmación para eliminar */}
        <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
              <AlertDialogDescription>
                {deletingCategory && (
                  <>
                    Estás a punto de eliminar:{' '}
                    <span className="font-semibold text-foreground">
                      "{deletingCategory.name}"
                    </span>
                    <br /><br />
                    <div className='mt-3 p-3 bg-muted rounded text-sm'>
                      <div className='font-medium mb-2'>Información de la categoría:</div>
                      <div>• Nivel: {deletingCategory.levelName}</div>
                      <div>• Tickets asociados: {deletingCategory._count?.tickets || 0}</div>
                      <div>• Subcategorías: {deletingCategory._count?.other_categories || 0}</div>
                      <div>• Técnicos asignados: {deletingCategory.technician_assignments?.length || 0}</div>
                      {!deletingCategory.canDelete && (
                        <div className='mt-2 text-red-600 font-medium'>
                          ⚠️ No se puede eliminar: tiene tickets asociados o subcategorías
                        </div>
                      )}
                    </div>
                    <div className='mt-2'>
                      Esta acción no se puede deshacer. Todos los datos asociados a esta categoría se perderán permanentemente.
                    </div>
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row justify-end space-x-2">
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting || !deletingCategory?.canDelete}
                className='bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
              >
                {deleting ? (
                  <>
                    <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                    Eliminando...
                  </>
                ) : (
                  'Eliminar Categoría'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </ModuleLayout>
  )
}