'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import {
  Plus,
  FolderTree,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronRight,
  List,
  Upload,
  Edit,
  Trash2,
  Ticket,
  Users,
} from 'lucide-react'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
import { BackToTickets } from '@/components/tickets/back-to-tickets'

// Componentes comunes
import { DataTableAdvanced } from '@/components/common/data-table-advanced'
import type {
  ColumnConfig,
  ActionConfig,
  MassActionConfig,
} from '@/components/common/data-table-advanced'

// Componentes específicos del módulo
import { CategoryTree } from '@/components/ui/category-tree'
import { useCategories } from '@/hooks/categories'
import { CategoryFormDialog } from './category-form-dialog'
import { CategoryStatsPanel } from './category-stats-panel'
import { CategoryImportModal } from './category-import-modal'
import { getCategoryLevelIcon } from '@/lib/constants/category-constants'
import { ExportButton } from '@/components/common/export-button'
import { useExport } from '@/hooks/common/use-export'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { useFamilies } from '@/contexts/families-context'

export default function CategoriesPage() {
  const { data: session } = useSession()
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin === true
  const [familyFilter, setFamilyFilter] = useState('all')
  const [showImportModal, setShowImportModal] = useState(false)
  // Familias que el admin tiene asignadas (para validar permisos en UI)
  const [adminFamilyIds, setAdminFamilyIds] = useState<Set<string> | null>(null)

  // Familias desde el contexto global (cache Redis, sin peticion extra)
  const { families } = useFamilies()

  // Familias ya disponibles desde el contexto global

  // Cargar familias asignadas al admin (para mostrar/ocultar acciones)
  useEffect(() => {
    if (isSuperAdmin) {
      setAdminFamilyIds(null) // null = sin restricción
      return
    }
    fetch('/api/families?includeInactive=false')
      .then(r => r.json())
      .then(data => {
        // La API ya filtra por admin_family_assignments para admin normal
        // Si devuelve familias, esas son las que tiene asignadas
        if (data.success && Array.isArray(data.data)) {
          setAdminFamilyIds(new Set(data.data.map((f: any) => f.id)))
        }
      })
      .catch(() => setAdminFamilyIds(null))
  }, [isSuperAdmin])

  const canManageCat = (category: any): boolean => {
    if (isSuperAdmin) return true
    if (adminFamilyIds === null) return true // sin restricciones cargadas aún
    const catFamilyId = category.departments?.familyId ?? category.departments?.family?.id
    if (!catFamilyId) return true // sin familia → cualquier admin
    if (adminFamilyIds.size === 0) return true // sin asignaciones → acceso total
    return adminFamilyIds.has(catFamilyId)
  }

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
    statusFilter,
    setStatusFilter,
    departmentFilter,
    setDepartmentFilter,
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
  // Apply family filter on top of existing filters
  const familyFilteredCategories = useMemo(() => {
    let result = filteredCategories

    // Filtro de familia
    if (familyFilter !== 'all') {
      result = result.filter((cat: any) => {
        const deptFamilyId = cat.departments?.familyId ?? cat.department?.familyId
        return deptFamilyId === familyFilter
      })
    }

    // Filtro de departamento (solo si hay familia seleccionada)
    if (departmentFilter !== 'all') {
      result = result.filter((cat: any) => cat.departmentId === departmentFilter)
    }

    return result
  }, [filteredCategories, familyFilter, departmentFilter])

  const paginatedCategories = pagination
    ? familyFilteredCategories.slice(
        (pagination.currentPage - 1) * pagination.pageSize,
        pagination.currentPage * pagination.pageSize
      )
    : familyFilteredCategories

  // Exportación — DESPUÉS de familyFilteredCategories para evitar error de inicialización
  // subtitle usa función para ser dinámico
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'categorias',
    title: 'Gestión de Categorías',
    getData: () => familyFilteredCategories,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'levelName', label: 'Nivel' },
      { key: 'departments', label: 'Departamento', format: v => v?.name ?? '' },
      { key: 'departments', label: 'Área', format: v => v?.family?.name ?? '' },
      { key: 'isActive', label: 'Estado', format: v => (v ? 'Activa' : 'Inactiva') },
      { key: 'description', label: 'Descripción', format: v => v ?? '' },
      { key: '_count', label: 'Tickets', format: v => String(v?.tickets ?? 0) },
      { key: '_count', label: 'Subcategorías', format: v => String(v?.other_categories ?? 0) },
    ],
  })
  // Configuración de paginación para DataTableAdvanced
  // IMPORTANTE: usar familyFilteredCategories.length como total, no pagination.totalItems
  // porque pagination viene del hook sin filtro de familia
  const paginationConfig = pagination
    ? {
        page: pagination.currentPage,
        limit: pagination.pageSize,
        total: familyFilteredCategories.length,
        totalPages: Math.ceil(familyFilteredCategories.length / pagination.pageSize),
        onPageChange: pagination.goToPage,
        onLimitChange: pagination.setPageSize,
      }
    : undefined

  // Configuración de columnas — responsivas, sin scroll horizontal
  const categoryColumns: ColumnConfig<any>[] = [
    {
      key: 'name',
      header: 'Categoría',
      sortable: true,
      render: (category: any) => (
        <div className='flex items-center gap-3 min-w-0'>
          <div
            className='w-2.5 h-2.5 rounded-full flex-shrink-0'
            style={{ backgroundColor: category.color }}
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              {(() => {
                const IconComponent = getCategoryLevelIcon(category.level.toString())
                return <IconComponent className='h-3.5 w-3.5 text-muted-foreground flex-shrink-0' />
              })()}
              <span className='font-medium text-sm text-foreground truncate'>{category.name}</span>
              <Badge
                variant={category.isActive ? 'default' : 'secondary'}
                className='text-xs h-5 px-1.5'
              >
                {category.isActive ? 'Activa' : 'Inactiva'}
              </Badge>
              <Badge variant='outline' className='text-xs h-5 px-1.5 hidden sm:inline-flex'>
                {category.levelName}
              </Badge>
            </div>
            {category.description && (
              <p className='text-xs text-muted-foreground truncate mt-0.5'>
                {category.description}
              </p>
            )}
            {/* En mobile: mostrar área y padre inline */}
            <div className='flex items-center gap-2 mt-0.5 sm:hidden'>
              {category.departments?.family && (
                <span className='text-xs text-muted-foreground truncate'>
                  {category.departments.family.name}
                </span>
              )}
              {category.parent && (
                <span className='text-xs text-muted-foreground truncate'>
                  ↳ {category.parent.name}
                </span>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'family',
      header: 'Área',
      className: 'hidden sm:table-cell',
      render: (category: any) => {
        const family = category.departments?.family
        if (!family) return <span className='text-xs text-muted-foreground'>—</span>
        return (
          <div className='flex items-center gap-1.5'>
            {family.color && (
              <span
                className='w-2 h-2 rounded-full flex-shrink-0'
                style={{ backgroundColor: family.color }}
              />
            )}
            <span className='text-sm truncate'>{family.name}</span>
          </div>
        )
      },
    },
    {
      key: 'tickets',
      header: 'Tickets',
      className: 'hidden md:table-cell',
      align: 'center' as const,
      render: (category: any) => (
        <button
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto'
          onClick={e => {
            e.stopPropagation()
            window.open(`/admin/tickets?category=${category.id}`, '_blank')
          }}
          title='Ver tickets de esta categoría'
        >
          <Ticket className='h-3.5 w-3.5' />
          <span className='font-medium'>{category._count?.tickets || 0}</span>
        </button>
      ),
    },
    {
      key: 'technicians',
      header: 'Técnicos',
      className: 'hidden md:table-cell',
      align: 'center' as const,
      render: (category: any) => (
        <button
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto'
          onClick={e => {
            e.stopPropagation()
            window.open(`/admin/technicians?category=${category.id}`, '_blank')
          }}
          title='Ver técnicos asignados'
        >
          <Users className='h-3.5 w-3.5' />
          <span className='font-medium'>{category.technician_assignments?.length || 0}</span>
        </button>
      ),
    },
    {
      key: 'subcategories',
      header: 'Subcats.',
      className: 'hidden lg:table-cell',
      align: 'center' as const,
      render: (category: any) => (
        <button
          className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto'
          onClick={e => {
            e.stopPropagation()
            window.open(`/admin/categories?parent=${category.id}`, '_blank')
          }}
          title='Ver subcategorías'
        >
          <FolderTree className='h-3.5 w-3.5' />
          <span className='font-medium'>{category._count?.other_categories || 0}</span>
        </button>
      ),
    },
  ]

  // Configuración de acciones por fila
  const rowActions: ActionConfig<any>[] = [
    {
      key: 'edit',
      label: 'Editar',
      icon: Edit,
      onClick: category => handleEdit(category),
      variant: 'default',
      disabled: category => !canManageCat(category),
    },
    {
      key: 'delete',
      label: 'Eliminar',
      icon: Trash2,
      onClick: category => setDeletingCategory(category),
      variant: 'destructive',
      disabled: category => !category.canDelete || !canManageCat(category),
    },
  ]

  // Construir jerarquía para vista árbol
  const buildHierarchy = (cats: any[]): any[] => {
    // Crear mapa de categorías por ID con todos sus datos
    const categoryMap = new Map()

    // Primero, crear nodos con estructura completa
    cats.forEach(cat => {
      categoryMap.set(cat.id, {
        ...cat,
        children: [], // Inicializar array de hijos
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
    // Para vista árbol, usar categorías filtradas incluyendo filtro de familia
    const hierarchy = buildHierarchy(familyFilteredCategories)
    return hierarchy
  }, [viewMode, familyFilteredCategories])

  return (
    <ModuleLayout
      title='Gestión de Categorías'
      subtitle='Sistema de gestión de categorías con 4 niveles jerárquicos'
      loading={loading && categories.length === 0}
      error={error && categories.length === 0 ? error : null}
      onRetry={refresh}
      headerActions={
        <div className='flex items-center gap-2'>
          <Button variant='outline' size='sm' onClick={() => setShowImportModal(true)}>
            <Upload className='h-4 w-4 mr-2' />
            Importar CSV
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleNew}
                  disabled={adminFamilyIds !== null && adminFamilyIds.size === 0 && !isSuperAdmin}
                >
                  <Plus className='h-4 w-4 mr-2' />
                  Nueva Categoría
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {adminFamilyIds !== null && adminFamilyIds.size === 0 && !isSuperAdmin
                    ? 'No tienes áreas asignadas para crear categorías'
                    : 'Crea una nueva categoría en el sistema de clasificación'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <div className='space-y-6'>
        <BackToTickets />
        {/* Panel de estado del sistema */}
        <CategoryStatsPanel stats={stats} loading={loading} />

        {/* Vista de Categorías - Card principal */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='flex items-center space-x-2'>
                  <FolderTree className='h-5 w-5' />
                  <span>Categorías</span>
                </CardTitle>
                <CardDescription>
                  Categorías con 4 niveles jerárquicos • {familyFilteredCategories.length}{' '}
                  categorías
                  {familyFilter !== 'all' && ` (filtradas por área)`}
                </CardDescription>
              </div>
              <div className='flex items-center space-x-2'>
                <TooltipProvider>
                  {viewMode === 'tree' && (
                    <div className='flex items-center border rounded-md mr-2'>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => {
                              const expandEvent = new CustomEvent('expandAllCategories')
                              window.dispatchEvent(expandEvent)
                            }}
                            className='rounded-r-none border-r px-3'
                            disabled={loading}
                          >
                            <ChevronDown className='h-4 w-4' />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Expandir todas las categorías para ver la jerarquía completa</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant='ghost'
                            size='sm'
                            onClick={() => {
                              const collapseEvent = new CustomEvent('collapseAllCategories')
                              window.dispatchEvent(collapseEvent)
                            }}
                            className='rounded-l-none px-3'
                            disabled={loading}
                          >
                            <ChevronRight className='h-4 w-4' />
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
                      <Button variant='outline' size='sm' onClick={refresh} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Actualizar lista de categorías</p>
                    </TooltipContent>
                  </Tooltip>
                  {/* Exportar — junto a la tabla para que el usuario sepa qué exporta */}
                  <ExportButton
                    onExportCSV={exportCSV}
                    onExportExcel={exportExcel}
                    onExportPDF={exportPDF}
                    loading={exporting}
                    disabled={familyFilteredCategories.length === 0}
                  />
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
            {/* Filtros y búsqueda */}
            <div className='space-y-3 mb-6'>
              {/* Búsqueda — ancho completo */}
              <div className='relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4 pointer-events-none' />
                <Input
                  placeholder='Buscar categorías por nombre o descripción...'
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className='pl-10'
                />
              </div>

              {/* Filtros secundarios — área, nivel, departamento, estado */}
              <div className='flex flex-wrap gap-2'>
                {/* Área (familia) — combobox con buscador */}
                {families.length > 1 && (
                  <FamilyCombobox
                    families={families.map(f => ({ ...f, color: f.color ?? null }))}
                    value={familyFilter}
                    onValueChange={v => {
                      setFamilyFilter(v)
                      setDepartmentFilter('all')
                    }}
                    allowAll
                    allowClear
                    popoverWidth='260px'
                    className='min-w-[180px]'
                  />
                )}{' '}
                <Select value={levelFilter} onValueChange={value => setLevelFilter(value as any)}>
                  <SelectTrigger className='w-auto min-w-[160px]'>
                    <SelectValue placeholder='Nivel' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos los niveles</SelectItem>
                    <SelectItem value='1'>Principal</SelectItem>
                    <SelectItem value='2'>Subcategoría</SelectItem>
                    <SelectItem value='3'>Especialidad</SelectItem>
                    <SelectItem value='4'>Detalle</SelectItem>
                  </SelectContent>
                </Select>
                {/* Departamento — solo visible cuando hay familia seleccionada y tiene múltiples departamentos */}
                {familyFilter !== 'all' &&
                  departments.filter(
                    (d: any) => d.familyId === familyFilter || d.family?.id === familyFilter
                  ).length > 1 && (
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className='w-auto min-w-[180px]'>
                        <SelectValue placeholder='Departamento' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>Todos los departamentos</SelectItem>
                        {departments
                          .filter(
                            (d: any) => d.familyId === familyFilter || d.family?.id === familyFilter
                          )
                          .map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                <Select
                  value={statusFilter}
                  onValueChange={value => setStatusFilter(value as 'all' | 'active' | 'inactive')}
                >
                  <SelectTrigger className='w-auto min-w-[120px]'>
                    <SelectValue placeholder='Estado' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    <SelectItem value='active'>Activas</SelectItem>
                    <SelectItem value='inactive'>Inactivas</SelectItem>
                  </SelectContent>
                </Select>
                {/* Limpiar filtros */}
                {(searchTerm ||
                  levelFilter !== 'all' ||
                  statusFilter !== 'all' ||
                  departmentFilter !== 'all' ||
                  familyFilter !== 'all') && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setSearchTerm('')
                      setLevelFilter('all')
                      setStatusFilter('all')
                      setDepartmentFilter('all')
                      setFamilyFilter('all')
                    }}
                    className='flex items-center gap-1.5'
                  >
                    <Search className='h-3.5 w-3.5' />
                    Limpiar
                  </Button>
                )}
              </div>
            </div>

            {/* Vista condicional */}
            {viewMode === 'tree' ? (
              <>
                {(pagination
                  ? familyFilteredCategories.length
                  : familyFilteredCategories.length) === 0 ? (
                  <div className='text-center py-8'>
                    <FolderTree className='h-12 w-12 text-muted-foreground mx-auto mb-4' />
                    <p className='text-muted-foreground'>
                      {searchTerm ||
                      levelFilter !== 'all' ||
                      statusFilter !== 'all' ||
                      departmentFilter !== 'all' ||
                      familyFilter !== 'all'
                        ? 'No se encontraron categorías que coincidan con los filtros'
                        : 'No hay categorías disponibles'}
                    </p>
                    {(searchTerm ||
                      levelFilter !== 'all' ||
                      statusFilter !== 'all' ||
                      departmentFilter !== 'all' ||
                      familyFilter !== 'all') && (
                      <Button
                        variant='outline'
                        onClick={() => {
                          setSearchTerm('')
                          setLevelFilter('all')
                          setStatusFilter('all')
                          setDepartmentFilter('all')
                          setFamilyFilter('all')
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
                        children: cat.children?.length || 0,
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
                              autoAssign: ta.autoAssign || false,
                            }))
                        : [],
                    }))}
                    onEdit={(category: any) => {
                      const originalCategory = familyFilteredCategories.find(
                        c => c.id === category.id
                      )
                      if (originalCategory) handleEdit(originalCategory)
                    }}
                    onDelete={(category: any) => {
                      const originalCategory = familyFilteredCategories.find(
                        c => c.id === category.id
                      )
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
                onRowClick={category => handleEdit(category)}
                selectable={false}
                // Acciones
                actions={rowActions}
                // Configuración
                userRole='ADMIN'
                variant='default'
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
        <CategoryImportModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onSuccess={refresh}
          familyId={familyFilter !== 'all' ? familyFilter : undefined}
        />

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
          onLoadTechnicians={loadAvailableTechnicians}
          families={families.map(f => ({ ...f, color: f.color ?? null }))}
        />

        {/* Dialog de confirmación para eliminar */}
        <AlertDialog open={!!deletingCategory} onOpenChange={() => setDeletingCategory(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  {deletingCategory &&
                    (() => {
                      const c = deletingCategory
                      const tickets = c._count?.tickets ?? 0
                      const subcats = c._count?.other_categories ?? 0
                      const articles = (c._count as any)?.knowledge_articles ?? 0
                      const slas = (c._count as any)?.sla_policies ?? 0
                      const technicians = c.technician_assignments?.length ?? 0
                      const canDel = c.canDelete

                      return (
                        <>
                          <p className='mb-3'>
                            Estás a punto de eliminar:{' '}
                            <span className='font-semibold text-foreground'>
                              &quot;{c.name}&quot;
                            </span>
                          </p>

                          <div className='p-3 bg-muted rounded text-sm space-y-1.5'>
                            <p className='font-medium mb-2'>Información de la categoría:</p>

                            <div className='flex items-center justify-between'>
                              <span>Nivel:</span>
                              <span className='font-medium'>{c.levelName}</span>
                            </div>

                            {/* Bloqueantes */}
                            <div className='flex items-center justify-between'>
                              <span>Tickets asociados:</span>
                              <span
                                className={`font-medium ${tickets > 0 ? 'text-red-600' : 'text-green-600'}`}
                              >
                                {tickets} {tickets > 0 ? '⛔' : '✓'}
                              </span>
                            </div>
                            <div className='flex items-center justify-between'>
                              <span>Subcategorías:</span>
                              <span
                                className={`font-medium ${subcats > 0 ? 'text-red-600' : 'text-green-600'}`}
                              >
                                {subcats} {subcats > 0 ? '⛔' : '✓'}
                              </span>
                            </div>

                            {/* Se eliminan automáticamente */}
                            <div className='flex items-center justify-between'>
                              <span>Técnicos asignados:</span>
                              <span className='font-medium text-amber-600'>
                                {technicians} {technicians > 0 ? '(se desvinculan)' : '✓'}
                              </span>
                            </div>
                            <div className='flex items-center justify-between'>
                              <span>Artículos de conocimiento:</span>
                              <span className='font-medium text-amber-600'>
                                {articles} {articles > 0 ? '(se eliminan)' : '✓'}
                              </span>
                            </div>
                            <div className='flex items-center justify-between'>
                              <span>Políticas SLA:</span>
                              <span className='font-medium text-amber-600'>
                                {slas} {slas > 0 ? '(se eliminan)' : '✓'}
                              </span>
                            </div>
                          </div>

                          {/* Bloqueado */}
                          {!canDel && (
                            <div className='mt-3 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-600 dark:text-red-400 space-y-1'>
                              <p className='font-medium'>⚠️ No se puede eliminar esta categoría</p>
                              {tickets > 0 && (
                                <p>• Reasigna o cierra los {tickets} ticket(s) asociado(s)</p>
                              )}
                              {subcats > 0 && (
                                <p>• Elimina o reasigna las {subcats} subcategoría(s)</p>
                              )}
                            </div>
                          )}

                          {/* Advertencia de cascade */}
                          {canDel && (articles > 0 || slas > 0 || technicians > 0) && (
                            <div className='mt-3 p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-400'>
                              ⚠️ Se eliminarán automáticamente los datos vinculados indicados
                              arriba.
                            </div>
                          )}

                          {canDel && (
                            <p className='mt-3 text-sm text-muted-foreground'>
                              Esta acción no se puede deshacer.
                            </p>
                          )}
                        </>
                      )
                    })()}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className='flex flex-row justify-end space-x-2'>
              <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting || !deletingCategory?.canDelete}
                className={cn(
                  'bg-red-600 hover:bg-red-700',
                  !deletingCategory?.canDelete && 'opacity-50 cursor-not-allowed'
                )}
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
