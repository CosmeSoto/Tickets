'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, UsersIcon } from 'lucide-react'
import Link from 'next/link'

// Componentes estandarizados
import { ModuleLayout } from '@/components/common/layout/module-layout'

// Componentes específicos del módulo
import { DataTable } from '@/components/ui/data-table'
import { UserStatsPanel } from '@/components/users/user-stats-panel'
import { UserFilters } from '@/components/users/user-filters'
import { UserDetailsModal } from '@/components/ui/user-details-modal'
import { AvatarUploadModal } from '@/components/users/avatar-upload-modal'
import { CreateUserModal } from '@/components/users/create-user-modal'
import { EditUserModal } from '@/components/users/edit-user-modal'
import { PromoteUserDialog } from '@/components/users/promote-user-dialog'
import { createUserColumns, UserCard } from '@/components/users/admin/user-columns'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

// Hooks y tipos
import { useUsers, type UserData } from '@/hooks/use-users'
import { useUserFilters } from '@/hooks/common/use-user-filters'
import type { UserRole } from '@/lib/constants/user-constants'
import { useToast } from '@/hooks/use-toast'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  
  // Estados de datos
  const [departments, setDepartments] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // Hook de filtros unificado
  const {
    filters,
    debouncedFilters,
    setFilter,
    clearFilters,
    activeFiltersCount,
    hasActiveFilters
  } = useUserFilters()

  // Hook de usuarios con filtros
  const {
    users,
    loading,
    error,
    pagination: usersPagination,
    stats,
    setFilters,
    refresh,
    goToPage,
    toggleUserStatus
  } = useUsers({
    pageSize: 20,
    enableCache: true
  })

  // Estados de modales
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editUserModalOpen, setEditUserModalOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [userDetailsModal, setUserDetailsModal] = useState<{
    isOpen: boolean
    userId: string
    userName: string
  }>({
    isOpen: false,
    userId: '',
    userName: ''
  })
  const [avatarModal, setAvatarModal] = useState<{
    isOpen: boolean
    userId: string
    userName: string
    currentAvatar?: string
  }>({
    isOpen: false,
    userId: '',
    userName: '',
    currentAvatar: undefined
  })
  const [promotingUser, setPromotingUser] = useState<UserData | null>(null)
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false)

  useEffect(() => {
    if (status === 'loading') return

    if (!session) {
      router.push('/login')
      return
    }

    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    // Cargar datos iniciales
    loadDepartments()
  }, [session, status, router])

  // Cargar departamentos
  const loadDepartments = async () => {
    try {
      const response = await fetch('/api/departments?isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setDepartments(data.data)
        }
      }
    } catch (err) {
      console.error('Error loading departments:', err)
    }
  }

  // Aplicar filtros cuando cambien los filtros debounced
  useEffect(() => {
    console.log('🔄 [AdminUsersPage] Aplicando filtros:', debouncedFilters)
    
    const apiFilters: any = {}
    
    // Solo agregar filtros si tienen valores válidos (no 'all')
    if (debouncedFilters.search && debouncedFilters.search.trim()) {
      apiFilters.search = debouncedFilters.search
    }
    if (debouncedFilters.role && debouncedFilters.role !== 'all') {
      apiFilters.role = debouncedFilters.role
    }
    if (debouncedFilters.status && debouncedFilters.status !== 'all') {
      apiFilters.isActive = debouncedFilters.status
    }
    if (debouncedFilters.department && debouncedFilters.department !== 'all') {
      apiFilters.departmentId = debouncedFilters.department
    }

    console.log('📤 [AdminUsersPage] Filtros enviados a setFilters:', apiFilters)
    setFilters(apiFilters)
  }, [debouncedFilters, setFilters])

  // Funciones de manejo de modales
  const handleUserEdit = (user: UserData) => {
    setUserDetailsModal({ isOpen: false, userId: '', userName: '' })
    setEditingUser(user)
    setEditUserModalOpen(true)
  }

  const handleUserDelete = (user: UserData) => {
    setDeletingUser(user)
    setDeleteDialogOpen(true)
  }

  const handleUserDetails = (user: UserData) => {
    setUserDetailsModal({
      isOpen: true,
      userId: user.id,
      userName: user.name
    })
  }

  const handleAvatarEdit = (user: UserData) => {
    setAvatarModal({
      isOpen: true,
      userId: user.id,
      userName: user.name,
      currentAvatar: user.avatar
    })
  }

  const handleToggleStatus = async (user: UserData) => {
    const userName = user.name
    const success = await toggleUserStatus(user.id, user.isActive)
    if (success) {
      toast({
        title: user.isActive ? 'Usuario desactivado' : 'Usuario activado exitosamente',
        description: user.isActive 
          ? `"${userName}" ya no podrá iniciar sesión en el sistema`
          : `"${userName}" ahora puede iniciar sesión en el sistema`,
        duration: 4000
      })
      refresh()
    } else {
      toast({
        title: 'Error al cambiar estado',
        description: `No se pudo ${user.isActive ? 'desactivar' : 'activar'} el usuario. Intenta nuevamente.`,
        variant: 'destructive',
        duration: 5000
      })
    }
  }

  const handlePromoteUser = (user: UserData) => {
    setPromotingUser(user)
    setPromoteDialogOpen(true)
  }

  const handlePromoteSuccess = () => {
    refresh()
  }

  const handleUserUpdated = () => {
    refresh()
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    const userName = deletingUser.name
    setDeleteLoading(true)
    try {
      const response = await fetch(`/api/users/${deletingUser.id}`, {
        method: 'DELETE'
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Usuario eliminado',
          description: `"${userName}" ha sido eliminado permanentemente del sistema`,
          duration: 4000
        })
        setDeleteDialogOpen(false)
        setDeletingUser(null)
        refresh()
      } else {
        toast({
          title: 'Error al eliminar usuario',
          description: result.error || 'No se pudo eliminar el usuario. Intenta nuevamente.',
          variant: 'destructive',
          duration: 5000
        })
      }
    } catch (error) {
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor. Verifica tu conexión e intenta nuevamente.',
        variant: 'destructive',
        duration: 5000
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  // Manejar vista de usuario
  const handleViewUser = (user: UserData) => {
    handleUserDetails(user)
  }

  // Configuración de columnas
  const columns = createUserColumns({
    onUserEdit: handleUserEdit,
    onUserDelete: handleUserDelete,
    onUserDetails: handleUserDetails,
    onAvatarEdit: handleAvatarEdit,
    onToggleStatus: handleToggleStatus,
    onPromoteUser: handlePromoteUser,
    currentUserId: session?.user?.id
  })

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <ModuleLayout
      title='Gestión de Usuarios'
      subtitle='Administrar cuentas de usuario del sistema'
      loading={loading && users.length === 0}
      headerActions={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size='sm' onClick={() => setShowCreateDialog(true)}>
                <Plus className='h-4 w-4 mr-2' />
                Nuevo Usuario
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Crea un nuevo usuario en el sistema</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
    >
      <div className="space-y-6">
        {/* Panel de Estadísticas */}
        <UserStatsPanel stats={stats} loading={loading && users.length === 0} />

        {/* Filtros de Usuarios */}
        <UserFilters
          searchTerm={filters.search}
          setSearchTerm={(term) => setFilter('search', term)}
          roleFilter={filters.role}
          setRoleFilter={(role) => setFilter('role', role as UserRole | 'all')}
          statusFilter={filters.status}
          setStatusFilter={(status) => setFilter('status', status as 'all' | 'true' | 'false')}
          departmentFilter={filters.department}
          setDepartmentFilter={(department) => setFilter('department', department)}
          onRefresh={refresh}
          onClearFilters={clearFilters}
          departments={departments}
          loading={loading}
        />

        {/* DataTable */}
        <DataTable
          title={viewMode === 'table' ? "Vista de Tabla - Información detallada de usuarios" : "Información visual de usuarios"}
          description={viewMode === 'table' ? "Información completa en formato tabular" : "Clic en usuario para ver detalles"}
          data={users}
          columns={columns}
          loading={loading}
          error={error?.message}
          externalSearch={true}
          hideInternalFilters={true}
          onRowClick={handleViewUser}
          pagination={{
            page: usersPagination.page,
            limit: usersPagination.limit,
            total: usersPagination.total,
            onPageChange: (page) => goToPage(page),
            onLimitChange: (limit) => {
              // TODO: Implementar cambio de límite en el hook
              console.log('Change limit to:', limit)
            }
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cardRenderer={(user) => (
            <UserCard
              user={user}
              onEdit={handleUserEdit}
              onDelete={handleUserDelete}
              onDetails={handleUserDetails}
              onAvatarEdit={handleAvatarEdit}
              onToggleStatus={handleToggleStatus}
              currentUserId={session?.user?.id}
            />
          )}
          onRefresh={refresh}
          emptyState={{
            icon: <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />,
            title: "No hay usuarios",
            description: hasActiveFilters
              ? "No se encontraron usuarios con los filtros aplicados"
              : "No se encontraron usuarios en el sistema",
            action: (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => setShowCreateDialog(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crear primer usuario
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Crea el primer usuario del sistema</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }}
        />
      </div>

      {/* Modal de edición de usuario */}
      <EditUserModal
        isOpen={editUserModalOpen}
        onClose={() => {
          setEditUserModalOpen(false)
          setEditingUser(null)
        }}
        onUserUpdated={handleUserUpdated}
        user={editingUser}
        departments={departments}
      />

      {/* Modal de detalles de usuario */}
      <UserDetailsModal
        isOpen={userDetailsModal.isOpen}
        onClose={() => setUserDetailsModal({ isOpen: false, userId: '', userName: '' })}
        userId={userDetailsModal.userId}
        userName={userDetailsModal.userName}
        onEdit={() => {
          const user = users.find(u => u.id === userDetailsModal.userId)
          if (user) {
            handleUserEdit(user)
          }
        }}
        onDelete={() => {
          const user = users.find(u => u.id === userDetailsModal.userId)
          if (user) {
            handleUserDelete(user)
          }
        }}
        canEdit={true}
        canDelete={userDetailsModal.userId !== session?.user?.id}
      />

      {/* Diálogo de confirmación de eliminación */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>¿Eliminar usuario?</DialogTitle>
            <DialogDescription>
              {deletingUser && (
                <>
                  Estás a punto de eliminar a:{' '}
                  <span className="font-semibold text-foreground">
                    {deletingUser.name} ({deletingUser.email})
                  </span>
                  <br /><br />
                </>
              )}
              Esta acción no se puede deshacer. El usuario perderá acceso al sistema
              y todos sus datos serán eliminados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Eliminando...' : 'Eliminar Usuario'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de gestión de avatar */}
      <AvatarUploadModal
        userId={avatarModal.userId}
        userName={avatarModal.userName}
        currentAvatar={avatarModal.currentAvatar}
        isOpen={avatarModal.isOpen}
        onClose={() => setAvatarModal({
          isOpen: false,
          userId: '',
          userName: '',
          currentAvatar: undefined
        })}
        onAvatarUpdated={handleUserUpdated}
      />

      {/* Modal de creación de usuario */}
      <CreateUserModal
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onUserCreated={handleUserUpdated}
        departments={departments}
      />

      {/* Diálogo de promoción a técnico */}
      {promotingUser && (
        <PromoteUserDialog
          open={promoteDialogOpen}
          onOpenChange={setPromoteDialogOpen}
          user={{
            id: promotingUser.id,
            name: promotingUser.name,
            email: promotingUser.email
          }}
          onSuccess={handlePromoteSuccess}
        />
      )}
    </ModuleLayout>
  )
}