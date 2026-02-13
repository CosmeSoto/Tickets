'use client'

import { Plus, Building, Edit, Trash2, Users, FolderTree } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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
import { DataTable } from '@/components/ui/data-table'
import type { Column } from '@/components/ui/data-table'

// Componentes específicos del módulo
import { useDepartments } from '@/hooks/use-departments'
import { DepartmentFilters } from './department-filters'
import { DepartmentStats } from './department-stats'
import { DepartmentFormDialog } from './department-form-dialog'
import { DepartmentMassActionsToolbar } from './mass-actions-toolbar'

// Constantes centralizadas
import { 
  DEPARTMENT_STATUS_FILTER_OPTIONS,
  getDepartmentStatusColor,
  type DepartmentStatus
} from '@/lib/constants/department-constants'

export default function DepartmentsPage() {
  const {
    // Estados principales
    departments,
    loading,
    error,
    
    // Estados de filtros
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    
    // Estados de formulario
    showDialog,
    showDeleteDialog,
    editingDepartment,
    deletingDepartment,
    formData,
    setFormData,
    submitting,
    deleting,
    
    // Datos procesados
    filteredDepartments,
    stats,
    
    // Paginación y acciones masivas
    pagination,
    massActions,
    
    // Funciones principales
    handleSubmit,
    handleDelete,
    handleOpenDialog,
    handleCloseDialog,
    handleOpenDeleteDialog,
    
    // Funciones de utilidad
    refresh,
  } = useDepartments({
    cacheTTL: 5 * 60 * 1000, // 5 minutos
    enableCache: true,
    autoRefresh: false,
    enablePagination: true,
    pageSize: 20,
    enableMassActions: true,
  })

  // Obtener datos paginados
  const paginatedDepartments = pagination ? pagination.currentItems : filteredDepartments

  // Adaptador de paginación para DataTable
  const paginationConfig = {
    page: pagination?.currentPage || 1,
    limit: pagination?.pageSize || 20,
    total: pagination?.totalItems || filteredDepartments.length,
    onPageChange: (page: number) => pagination?.goToPage(page),
    onLimitChange: (limit: number) => pagination?.setPageSize(limit),
  }

  // Configuración de columnas para DataTable
  const departmentColumns: Column<any>[] = [
    {
      key: 'name',
      label: 'Nombre',
      render: (dept: any) => (
        <div className="flex items-center space-x-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: dept.color }}
          />
          <span className="font-medium">{dept.name}</span>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Descripción',
      render: (dept: any) => (
        <span className="text-sm text-muted-foreground">
          {dept.description || 'Sin descripción'}
        </span>
      ),
    },
    {
      key: 'isActive',
      label: 'Estado',
      width: '100px',
      render: (dept: any) => (
        <Badge variant={dept.isActive ? 'default' : 'secondary'} className="text-xs">
          {dept.isActive ? 'Activo' : 'Inactivo'}
        </Badge>
      ),
    },
    {
      key: 'users',
      label: 'Técnicos Asignados',
      width: '140px',
      render: (dept: any) => (
        <div className="flex items-center space-x-1 text-sm cursor-pointer hover:text-blue-600" 
             onClick={(e) => {
               e.stopPropagation()
               window.open(`/admin/technicians?department=${dept.id}`, '_blank')
             }}
             title="Click para ver técnicos del departamento">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{dept._count?.users || 0}</span>
          <span className="text-xs text-muted-foreground">técnicos</span>
        </div>
      ),
    },
    {
      key: 'categories',
      label: 'Categorías Asociadas',
      width: '140px',
      render: (dept: any) => (
        <div className="flex items-center space-x-1 text-sm cursor-pointer hover:text-purple-600" 
             onClick={(e) => {
               e.stopPropagation()
               window.open(`/admin/categories?department=${dept.id}`, '_blank')
             }}
             title="Click para ver categorías del departamento">
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span>{dept._count?.categories || 0}</span>
          <span className="text-xs text-muted-foreground">categorías</span>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Acciones',
      width: '100px',
      render: (dept: any) => (
        <div 
          className="flex items-center justify-end space-x-1"
          onClick={(e) => e.stopPropagation()}
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenDialog(dept)
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Editar información del departamento</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenDeleteDialog(dept)
                  }}
                  disabled={(dept._count?.users || 0) > 0 || (dept._count?.categories || 0) > 0}
                  className="h-8 w-8 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {(dept._count?.users || 0) > 0 || (dept._count?.categories || 0) > 0
                    ? 'No se puede eliminar: tiene técnicos o categorías asignadas'
                    : 'Eliminar departamento permanentemente'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ]

  // Card renderer for departments
  const DepartmentCard = ({ department }: { department: any }) => {
    
    const handleManageTechnicians = (e: React.MouseEvent, dept: any) => {
      e.stopPropagation()
      // TODO: Abrir modal para gestionar técnicos del departamento
      console.log('Gestionar técnicos del departamento:', dept.name)
      // Por ahora, redirigir al módulo de técnicos con filtro
      window.open(`/admin/technicians?department=${dept.id}`, '_blank')
    }

    const handleManageCategories = (e: React.MouseEvent, dept: any) => {
      e.stopPropagation()
      // TODO: Abrir modal para gestionar categorías del departamento
      console.log('Gestionar categorías del departamento:', dept.name)
      // Por ahora, redirigir al módulo de categorías con filtro
      window.open(`/admin/categories?department=${dept.id}`, '_blank')
    }

    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleOpenDialog(department)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className='h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0'
                style={{ backgroundColor: department.color }}
              >
                {department.name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <CardTitle className="text-lg">{department.name}</CardTitle>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant={department.isActive ? 'default' : 'secondary'} className="text-xs">
                    {department.isActive ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className='flex items-center space-x-1'>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDialog(department)
                      }}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar información del departamento</p>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={(e) => {
                        e.stopPropagation()
                        handleOpenDeleteDialog(department)
                      }}
                      disabled={(department._count?.users || 0) > 0 || (department._count?.categories || 0) > 0}
                      className="h-7 w-7 p-0"
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {(department._count?.users || 0) > 0 || (department._count?.categories || 0) > 0
                        ? 'No se puede eliminar: tiene técnicos o categorías asignadas'
                        : 'Eliminar departamento permanentemente'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {department.description && (
            <p className='text-sm text-muted-foreground'>{department.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div 
              className="text-center p-3 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
              onClick={(e) => handleManageTechnicians(e, department)}
              title="Click para gestionar técnicos asignados"
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <Users className="h-4 w-4 text-blue-600" />
              </div>
              <div className="text-lg font-bold text-blue-900">{department._count?.users || 0}</div>
              <div className="text-xs text-blue-700">Técnicos Asignados</div>
              <div className="text-xs text-blue-600 mt-1">Click para gestionar</div>
            </div>
            
            <div 
              className="text-center p-3 bg-purple-50 rounded-lg cursor-pointer hover:bg-purple-100 transition-colors"
              onClick={(e) => handleManageCategories(e, department)}
              title="Click para gestionar categorías asociadas"
            >
              <div className="flex items-center justify-center space-x-1 mb-1">
                <FolderTree className="h-4 w-4 text-purple-600" />
              </div>
              <div className="text-lg font-bold text-purple-900">{department._count?.categories || 0}</div>
              <div className="text-xs text-purple-700">Categorías Asociadas</div>
              <div className="text-xs text-purple-600 mt-1">Click para gestionar</div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <ModuleLayout
      title='Gestión de Departamentos'
      subtitle='Administra los departamentos de tu organización'
      loading={loading && departments.length === 0}
      error={error && departments.length === 0 ? error : null}
      onRetry={refresh}
      headerActions={
        <div className='flex items-center space-x-2'>
          {massActions && massActions.selectedCount > 0 && (
            <Badge variant='outline'>
              {massActions.selectedCount} seleccionado{massActions.selectedCount !== 1 ? 's' : ''}
            </Badge>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={() => handleOpenDialog()} disabled={loading}>
                  <Plus className='h-4 w-4 mr-2' />
                  Nuevo Departamento
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Crea un nuevo departamento en tu organización</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <div className='space-y-6'>
        {/* Estadísticas */}
        <DepartmentStats stats={stats} />

        {/* Filtros y Búsqueda */}
        <DepartmentFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter as DepartmentStatus}
          setStatusFilter={setStatusFilter as (status: DepartmentStatus) => void}
          loading={loading}
          onRefresh={refresh}
        />

        {/* Toolbar de Acciones Masivas */}
        {massActions && massActions.hasSelection && (
          <DepartmentMassActionsToolbar
            selectedCount={massActions.selectedCount}
            onBulkDelete={() => massActions.bulkDelete(filteredDepartments)}
            onBulkActivate={() => massActions.bulkActivate(filteredDepartments)}
            onBulkDeactivate={() => massActions.bulkDeactivate(filteredDepartments)}
            onBulkExport={() => massActions.bulkExport(filteredDepartments)}
            onClearSelection={massActions.clearSelection}
            isProcessing={massActions.isProcessing}
            processingAction={massActions.processingAction}
          />
        )}

        {/* Lista de Departamentos */}
        <DataTable
          title={viewMode === 'table' ? "Vista de Tabla - Departamentos" : "Departamentos"}
          description={viewMode === 'table' ? `Información detallada en columnas (${filteredDepartments.length} departamentos)` : "Clic en tarjeta para ver detalles"}
          data={paginatedDepartments}
          columns={departmentColumns}
          loading={loading}
          pagination={paginationConfig}
          onRefresh={refresh}
          viewMode={viewMode as 'table' | 'cards'}
          onViewModeChange={setViewMode as (mode: 'table' | 'cards') => void}
          cardRenderer={(department) => <DepartmentCard department={department} />}
          onRowClick={(department) => handleOpenDialog(department)}
          externalSearch={true}
          hideInternalFilters={true}
          emptyState={{
            icon: <Building className='h-12 w-12 text-muted-foreground mx-auto mb-4' />,
            title: searchTerm || statusFilter !== 'all'
              ? "No se encontraron departamentos"
              : "No hay departamentos disponibles",
            description: searchTerm || statusFilter !== 'all'
              ? "Intenta ajustar los filtros de búsqueda"
              : "Comienza creando tu primer departamento",
            action: searchTerm || statusFilter !== 'all' ? (
              <Button variant="outline" onClick={() => {
                setSearchTerm('')
                setStatusFilter('all')
              }}>
                Limpiar filtros
              </Button>
            ) : (
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Departamento
              </Button>
            )
          }}
        />
      </div>

      {/* Dialog de Crear/Editar */}
      <DepartmentFormDialog
        open={showDialog}
        onOpenChange={handleCloseDialog}
        editingDepartment={editingDepartment}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        submitting={submitting}
        departments={departments}
      />

      {/* Dialog de Eliminar */}
      <AlertDialog open={showDeleteDialog} onOpenChange={() => handleCloseDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingDepartment && (
                <>
                  Estás a punto de eliminar:{' '}
                  <span className="font-semibold text-foreground">
                    "{deletingDepartment.name}"
                  </span>
                  <br /><br />
                  <div className='mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md'>
                    <div className='text-sm text-yellow-800'>
                      <p className='font-medium mb-1'>Verifica antes de eliminar:</p>
                      <ul className='list-disc list-inside space-y-1'>
                        <li>{deletingDepartment._count?.users || 0} técnicos asignados</li>
                        <li>{deletingDepartment._count?.categories || 0} categorías asociadas</li>
                      </ul>
                    </div>
                  </div>
                  <div className='mt-2'>
                    Esta acción no se puede deshacer. Todos los datos asociados a este departamento se perderán permanentemente.
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className='bg-red-600 hover:bg-red-700'
              disabled={deleting}
            >
              {deleting ? 'Eliminando...' : 'Eliminar Departamento'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ModuleLayout>
  )
}
