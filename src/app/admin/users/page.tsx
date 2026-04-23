'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, UsersIcon } from 'lucide-react'

import { ModuleLayout } from '@/components/common/layout/module-layout'
import { DataTable } from '@/components/ui/data-table'
import { UserFilters } from '@/components/users/user-filters'
import { UserDetailsModal } from '@/components/ui/user-details-modal'
import { AvatarUploadModal } from '@/components/users/avatar-upload-modal'
import { CreateUserModal } from '@/components/users/create-user-modal'
import { EditUserModal } from '@/components/users/edit-user-modal'
import { PromoteUserDialog } from '@/components/users/promote-user-dialog'
import { createUserColumns, UserCard } from '@/components/users/admin/user-columns'
import { ExportButton } from '@/components/common/export-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useUsers, type UserData } from '@/hooks/use-users'
import { useUserFilters } from '@/hooks/common/use-user-filters'
import { useExport } from '@/hooks/common/use-export'
import type { UserRole } from '@/lib/constants/user-constants'
import { useToast } from '@/hooks/use-toast'
import { useActiveDepartments } from '@/contexts/departments-context'

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  // ✅ Departamentos desde contexto global — sin petición extra
  const { departments } = useActiveDepartments()

  // Hook de filtros unificado
  const { filters, setFilter, clearFilters, hasActiveFilters } = useUserFilters()

  // Hook de usuarios con filtros
  const {
    users,
    loading,
    error,
    pagination: usersPagination,
    setFilters,
    refresh,
    goToPage,
    toggleUserStatus,
    removeUserLocally,
  } = useUsers({
    pageSize: 20,
    enableCache: true,
  })

  // Exportación — usa los usuarios visibles con filtros activos
  const { exportCSV, exportExcel, exportPDF, exporting } = useExport({
    filename: 'usuarios',
    title: 'Reporte de Usuarios',
    subtitle: `Generado el ${new Date().toLocaleDateString('es-EC')}`,
    columns: [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Email' },
      {
        key: 'role',
        label: 'Rol',
        format: (v: string) =>
          ({ ADMIN: 'Administrador', TECHNICIAN: 'Técnico', CLIENT: 'Cliente' })[v] ?? v,
      },
      {
        key: 'department',
        label: 'Departamento',
        format: (v: any) => (typeof v === 'string' ? v : (v?.name ?? '—')),
      },
      { key: 'phone', label: 'Teléfono', format: (v: any) => v ?? '—' },
      { key: 'isActive', label: 'Estado', format: (v: boolean) => (v ? 'Activo' : 'Inactivo') },
      {
        key: 'lastLogin',
        label: 'Último acceso',
        format: (v: any) => (v ? new Date(v).toLocaleDateString('es-EC') : 'Nunca'),
      },
      {
        key: 'createdAt',
        label: 'Creado',
        format: (v: any) => new Date(v).toLocaleDateString('es-EC'),
      },
    ],
    getData: () => users,
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
    userName: '',
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
    currentAvatar: undefined,
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

    // Cargar datos iniciales al verificar sesión
  }, [session, status, router])

  // Aplicar filtros cuando cambien
  useEffect(() => {
    const apiFilters: Record<string, string> = {}
    if (filters.search?.trim()) apiFilters.search = filters.search
    if (filters.role && filters.role !== 'all') apiFilters.role = filters.role
    if (filters.status && filters.status !== 'all') apiFilters.isActive = filters.status
    if (filters.department && filters.department !== 'all')
      apiFilters.departmentId = filters.department
    setFilters(apiFilters)
  }, [filters.search, filters.role, filters.status, filters.department, setFilters])

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
      userName: user.name,
    })
  }

  const handleAvatarEdit = (user: UserData) => {
    setAvatarModal({
      isOpen: true,
      userId: user.id,
      userName: user.name,
      currentAvatar: user.avatar,
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
        duration: 4000,
      })
      refresh()
    } else {
      toast({
        title: 'Error al cambiar estado',
        description: `No se pudo ${user.isActive ? 'desactivar' : 'activar'} el usuario. Intenta nuevamente.`,
        variant: 'destructive',
        duration: 5000,
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
        method: 'DELETE',
      })

      const result = await response.json()

      if (response.ok && result.success) {
        toast({
          title: 'Usuario eliminado',
          description: `"${userName}" ha sido eliminado permanentemente del sistema`,
          duration: 4000,
        })
        setDeleteDialogOpen(false)
        setDeletingUser(null)
        // Eliminar inmediatamente del estado local sin esperar el fetch
        removeUserLocally(deletingUser.id)
        // Recargar en background para sincronizar
        refresh()
      } else {
        toast({
          title: 'Error al eliminar usuario',
          description: result.error || 'No se pudo eliminar el usuario. Intenta nuevamente.',
          variant: 'destructive',
          duration: 5000,
        })
      }
    } catch (error) {
      toast({
        title: 'Error de conexión',
        description:
          'No se pudo conectar con el servidor. Verifica tu conexión e intenta nuevamente.',
        variant: 'destructive',
        duration: 5000,
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
    currentUserId: session?.user?.id,
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
        <div className='flex items-center gap-2'>
          <ExportButton
            onExportCSV={exportCSV}
            onExportExcel={exportExcel}
            onExportPDF={exportPDF}
            loading={exporting}
            disabled={users.length === 0}
          />
          <Button size='sm' onClick={() => setShowCreateDialog(true)}>
            <Plus className='h-4 w-4 mr-2' />
            Nuevo usuario
          </Button>
        </div>
      }
    >
      <div className='space-y-4'>
        {/* Filtros */}
        <UserFilters
          searchTerm={filters.search}
          setSearchTerm={term => setFilter('search', term)}
          roleFilter={filters.role}
          setRoleFilter={role => setFilter('role', role as UserRole | 'all')}
          statusFilter={filters.status}
          setStatusFilter={status => setFilter('status', status as 'all' | 'true' | 'false')}
          departmentFilter={filters.department}
          setDepartmentFilter={department => setFilter('department', department)}
          onRefresh={refresh}
          onClearFilters={clearFilters}
          departments={departments as any}
          loading={loading}
        />

        {/* DataTable */}
        <DataTable
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
            onPageChange: page => goToPage(page),
            onLimitChange: _limit => {},
          }}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          cardRenderer={user => (
            <UserCard
              user={user}
              onEdit={handleUserEdit}
              onDelete={handleUserDelete}
              onDetails={handleUserDetails}
              onToggleStatus={handleToggleStatus}
              currentUserId={session?.user?.id}
            />
          )}
          onRefresh={refresh}
          emptyState={{
            icon: <UsersIcon className='h-10 w-10 text-muted-foreground mx-auto mb-3' />,
            title: 'No hay usuarios',
            description: hasActiveFilters
              ? 'No se encontraron usuarios con los filtros aplicados'
              : 'No se encontraron usuarios en el sistema',
            action: (
              <Button size='sm' onClick={() => setShowCreateDialog(true)}>
                <Plus className='h-4 w-4 mr-2' />
                Crear primer usuario
              </Button>
            ),
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
        departments={departments as any}
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
        <DialogContent className='sm:max-w-[425px]' aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>¿Eliminar usuario?</DialogTitle>
            <DialogDescription>
              {deletingUser && (
                <>
                  Estás a punto de eliminar a:{' '}
                  <span className='font-semibold text-foreground'>
                    {deletingUser.name} ({deletingUser.email})
                  </span>
                  <br />
                  <br />
                </>
              )}
              Esta acción no se puede deshacer. El usuario perderá acceso al sistema y todos sus
              datos serán eliminados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type='button' variant='outline' onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              type='button'
              variant='destructive'
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
        onClose={() =>
          setAvatarModal({
            isOpen: false,
            userId: '',
            userName: '',
            currentAvatar: undefined,
          })
        }
        onAvatarUpdated={handleUserUpdated}
      />

      {/* Modal de creación de usuario */}
      <CreateUserModal
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onUserCreated={handleUserUpdated}
        departments={departments as any}
        suggestedRole={
          filters.role &&
          filters.role !== 'all' &&
          (filters.role as string) !== 'SUPER_ADMIN' &&
          (filters.role as string) !== 'TECHNICIAN_MANAGER' &&
          (filters.role as string) !== 'CLIENT_MANAGER'
            ? (filters.role as UserRole)
            : undefined
        }
      />

      {/* Diálogo de promoción a técnico */}
      {promotingUser && (
        <PromoteUserDialog
          open={promoteDialogOpen}
          onOpenChange={setPromoteDialogOpen}
          user={{
            id: promotingUser.id,
            name: promotingUser.name,
            email: promotingUser.email,
          }}
          onSuccess={handlePromoteSuccess}
        />
      )}
    </ModuleLayout>
  )
}
