/**
 * Tabla de usuarios optimizada con paginación, filtros y acciones masivas
 * Usa el hook optimizado para mejor performance
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  Search,
  Filter,
  RefreshCw,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Wrench,
  UserCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Users,
  Activity,
  Download,
  UserCheck,
  UserX,
  Grid3X3,
  List,
  Camera,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useUsers, UserData, formatTimeAgo } from '@/hooks/use-users'
import { USER_ROLE_LABELS, USER_ROLE_COLORS } from '@/lib/constants/user-constants'
import { useToast } from '@/hooks/use-toast'
import { AvatarUploadModal } from './avatar-upload-modal'
import { UserStatsCard } from '@/components/ui/user-stats-card'

interface UserTableProps {
  title?: string
  description?: string
  showFilters?: boolean
  enableMassActions?: boolean
  onUserEdit?: (user: UserData) => void
  onUserDelete?: (user: UserData) => void
  onUserDetails?: (user: UserData) => void
  onUsersLoaded?: (users: UserData[]) => void
  departments?: Array<{ id: string; name: string; color: string }>
}

const roleIcons = {
  ADMIN: Shield,
  TECHNICIAN: Wrench,
  CLIENT: UserCircle,
}

export function UserTable({
  title = 'Usuarios del Sistema',
  description = 'Gestión de usuarios con paginación avanzada',
  showFilters = true,
  enableMassActions = true,
  onUserEdit,
  onUserDelete,
  onUserDetails,
  onUsersLoaded,
  departments = []
}: UserTableProps) {
  const { data: session } = useSession()
  const { toast } = useToast()
  const {
    users,
    loading,
    error,
    pagination,
    filters,
    stats,
    setFilters,
    clearFilters,
    refresh,
    goToPage,
    hasActiveFilters,
    toggleUserStatus
  } = useUsers({
    pageSize: 20,
    enableCache: true
  })

  // Estados para acciones masivas
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [isPerformingAction, setIsPerformingAction] = useState(false)
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
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
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    title: string
    description: string
    action: () => Promise<void>
  }>({
    isOpen: false,
    title: '',
    description: '',
    action: async () => {}
  })

  // Funciones para selección masiva
  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) {
        newSet.delete(userId)
      } else {
        newSet.add(userId)
      }
      return newSet
    })
  }, [])

  const toggleAllUsers = useCallback(() => {
    if (selectedUsers.size === users.length) {
      setSelectedUsers(new Set())
    } else {
      setSelectedUsers(new Set(users.map(u => u.id)))
    }
  }, [selectedUsers.size, users])

  const clearSelection = useCallback(() => {
    setSelectedUsers(new Set())
  }, [])

  // Función para ejecutar acciones masivas
  const executeMassAction = useCallback(async (action: 'activate' | 'deactivate' | 'delete', userIds: string[]) => {
    setIsPerformingAction(true)
    try {
      let successCount = 0
      
      for (const userId of userIds) {
        const user = users.find(u => u.id === userId)
        if (!user) continue

        let success = false
        
        switch (action) {
          case 'activate':
            if (!user.isActive) {
              success = await toggleUserStatus(userId, false)
            }
            break
          case 'deactivate':
            if (user.isActive && user.id !== session?.user?.id) {
              success = await toggleUserStatus(userId, true)
            }
            break
          case 'delete':
            if (user.canDelete) {
              // Implementar delete masivo cuando esté disponible
              success = true
            }
            break
        }
        
        if (success) successCount++
      }

      if (successCount > 0) {
        toast({
          title: 'Acción completada',
          description: `${successCount} usuarios procesados exitosamente`,
        })
        clearSelection()
      }
    } catch (error) {
      console.error('Error executing mass action:', error)
      toast({
        title: 'Error',
        description: 'Error al ejecutar la acción masiva',
        variant: 'destructive'
      })
    } finally {
      setIsPerformingAction(false)
    }
  }, [users, session, toggleUserStatus, clearSelection])

  // Función para manejar clic en fila
  const handleRowClick = useCallback((user: UserData) => {
    if (onUserDetails) {
      onUserDetails(user)
    }
  }, [onUserDetails])

  // Función para abrir modal de avatar
  const handleAvatarClick = useCallback((user: UserData, e: React.MouseEvent) => {
    e.stopPropagation()
    setAvatarModal({
      isOpen: true,
      userId: user.id,
      userName: user.name,
      currentAvatar: user.avatar
    })
  }, [])

  // Función para manejar actualización de avatar
  const handleAvatarUpdated = useCallback((newAvatarUrl: string | null) => {
    // Refrescar la lista de usuarios para mostrar el nuevo avatar
    refresh()
    setAvatarModal({
      isOpen: false,
      userId: '',
      userName: '',
      currentAvatar: undefined
    })
  }, [refresh])

  const isAllSelected = users.length > 0 && selectedUsers.size === users.length
  const isIndeterminate = selectedUsers.size > 0 && selectedUsers.size < users.length

  // Notificar cuando se cargan los usuarios
  useEffect(() => {
    if (onUsersLoaded && users.length > 0) {
      onUsersLoaded(users)
    }
  }, [users, onUsersLoaded])

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>{title}</span>
              </CardTitle>
              <CardDescription>
                {description} • {pagination.total} usuarios total
                {hasActiveFilters && (
                  <span className="text-blue-600 ml-2">• Filtros activos</span>
                )}
              </CardDescription>
            </div>
            <div className='flex items-center space-x-2'>
              <Button
                variant='outline'
                size='sm'
                onClick={refresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
              <div className='flex items-center border rounded-md'>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('table')}
                  className='rounded-r-none'
                >
                  <List className='h-4 w-4' />
                </Button>
                <Button
                  variant={viewMode === 'cards' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setViewMode('cards')}
                  className='rounded-l-none'
                >
                  <Grid3X3 className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Estadísticas rápidas */}
          <div className='grid grid-cols-2 md:grid-cols-6 gap-4 mb-6'>
            <div className='flex items-center space-x-2 p-3 bg-blue-50 rounded-lg'>
              <Users className='h-4 w-4 text-blue-600' />
              <div>
                <div className='text-lg font-bold text-blue-600'>{stats.total}</div>
                <div className='text-xs text-muted-foreground'>Total</div>
              </div>
            </div>
            <div className='flex items-center space-x-2 p-3 bg-green-50 rounded-lg'>
              <Activity className='h-4 w-4 text-green-600' />
              <div>
                <div className='text-lg font-bold text-green-600'>{stats.active}</div>
                <div className='text-xs text-muted-foreground'>Activos</div>
              </div>
            </div>
            <div className='flex items-center space-x-2 p-3 bg-blue-50 rounded-lg'>
              <Shield className='h-4 w-4 text-blue-600' />
              <div>
                <div className='text-lg font-bold text-blue-600'>{stats.admins}</div>
                <div className='text-xs text-muted-foreground'>Admins</div>
              </div>
            </div>
            <div className='flex items-center space-x-2 p-3 bg-green-50 rounded-lg'>
              <Wrench className='h-4 w-4 text-green-600' />
              <div>
                <div className='text-lg font-bold text-green-600'>{stats.technicians}</div>
                <div className='text-xs text-muted-foreground'>Técnicos</div>
              </div>
            </div>
            <div className='flex items-center space-x-2 p-3 bg-purple-50 rounded-lg'>
              <UserCircle className='h-4 w-4 text-purple-600' />
              <div>
                <div className='text-lg font-bold text-purple-600'>{stats.clients}</div>
                <div className='text-xs text-muted-foreground'>Clientes</div>
              </div>
            </div>
            <div className='flex items-center space-x-2 p-3 bg-red-50 rounded-lg'>
              <EyeOff className='h-4 w-4 text-red-600' />
              <div>
                <div className='text-lg font-bold text-red-600'>{stats.inactive}</div>
                <div className='text-xs text-muted-foreground'>Inactivos</div>
              </div>
            </div>
          </div>

          {/* Filtros */}
          {showFilters && (
            <div className='space-y-4 mb-6'>
              <div className='flex flex-col sm:flex-row gap-4'>
                <div className='flex-1'>
                  <div className='relative'>
                    <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4' />
                    <Input
                      placeholder='Buscar usuarios por nombre, email, departamento...'
                      value={filters.search || ''}
                      onChange={e => setFilters({ search: e.target.value })}
                      className='pl-10'
                    />
                  </div>
                </div>
                <Select value={filters.role || 'all'} onValueChange={value => setFilters({ role: value })}>
                  <SelectTrigger className='w-full sm:w-[180px]'>
                    <SelectValue placeholder='Rol' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos los roles</SelectItem>
                    <SelectItem value='ADMIN'>Administradores</SelectItem>
                    <SelectItem value='TECHNICIAN'>Técnicos</SelectItem>
                    <SelectItem value='CLIENT'>Clientes</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filters.isActive || 'all'} onValueChange={value => setFilters({ isActive: value })}>
                  <SelectTrigger className='w-full sm:w-[180px]'>
                    <SelectValue placeholder='Estado' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='all'>Todos</SelectItem>
                    <SelectItem value='true'>Activos</SelectItem>
                    <SelectItem value='false'>Inactivos</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  <Filter className='h-4 w-4 mr-2' />
                  Filtros
                </Button>
              </div>

              {showAdvancedFilters && (
                <div className='flex flex-col sm:flex-row gap-4 p-4 bg-muted rounded-lg'>
                  <div className='flex-1'>
                    <Label className='text-sm font-medium mb-2 block'>Departamento</Label>
                    <Select value={filters.departmentId || 'all'} onValueChange={value => setFilters({ departmentId: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder='Departamento' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value='all'>Todos los departamentos</SelectItem>
                        {departments.map(dept => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='flex items-end'>
                    <Button variant='outline' onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Barra de acciones masivas */}
          {enableMassActions && selectedUsers.size > 0 && (
            <div className='flex items-center justify-between p-3 mb-4 bg-blue-50 border border-blue-200 rounded-lg'>
              <div className='flex items-center space-x-3'>
                <span className='text-sm font-medium text-blue-900'>
                  {selectedUsers.size} usuario{selectedUsers.size > 1 ? 's' : ''} seleccionado{selectedUsers.size > 1 ? 's' : ''}
                </span>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={clearSelection}
                  disabled={isPerformingAction}
                >
                  Limpiar selección
                </Button>
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => executeMassAction('activate', Array.from(selectedUsers))}
                  disabled={isPerformingAction}
                  className='flex items-center space-x-1'
                >
                  <UserCheck className="h-4 w-4" />
                  <span className='hidden sm:inline'>Activar</span>
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => executeMassAction('deactivate', Array.from(selectedUsers))}
                  disabled={isPerformingAction}
                  className='flex items-center space-x-1'
                >
                  <UserX className="h-4 w-4" />
                  <span className='hidden sm:inline'>Desactivar</span>
                </Button>
              </div>
            </div>
          )}

          {/* Tabla o Vista de Tarjetas */}
          {viewMode === 'table' ? (
            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    {enableMassActions && (
                      <TableHead className='w-12'>
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={toggleAllUsers}
                          aria-label='Seleccionar todos los usuarios'
                        />
                      </TableHead>
                    )}
                    <TableHead>Usuario</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Actividad</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Tickets</TableHead>
                    <TableHead className='text-right'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={enableMassActions ? 8 : 7} className='text-center py-8'>
                        <div className='flex items-center justify-center'>
                          <RefreshCw className='h-6 w-6 animate-spin mr-2' />
                          <div>
                            <div className='font-medium'>Cargando usuarios...</div>
                            <div className='text-sm text-muted-foreground mt-1'>
                              {filters.search ? `Buscando "${filters.search}"` : 'Obteniendo datos del servidor'}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell colSpan={enableMassActions ? 8 : 7} className='text-center py-8'>
                        <div className='flex flex-col items-center space-y-3'>
                          <div className='text-red-500 font-medium'>Error al cargar usuarios</div>
                          <div className='text-sm text-muted-foreground max-w-md text-center'>{error.message}</div>
                          <Button 
                            variant='outline' 
                            size='sm' 
                            onClick={refresh}
                            className='mt-2'
                          >
                            <RefreshCw className='h-4 w-4 mr-2' />
                            Reintentar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={enableMassActions ? 8 : 7} className='text-center py-8'>
                        <div className='flex flex-col items-center space-y-2'>
                          <Users className='h-12 w-12 text-muted-foreground' />
                          <div className='text-muted-foreground font-medium'>
                            {hasActiveFilters
                              ? 'No se encontraron usuarios con los filtros aplicados'
                              : 'No hay usuarios disponibles'
                            }
                          </div>
                          {hasActiveFilters && (
                            <Button 
                              variant='outline' 
                              size='sm' 
                              onClick={clearFilters}
                              className='mt-2'
                            >
                              Limpiar filtros
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(user => {
                      const RoleIcon = roleIcons[user.role]
                      return (
                        <TableRow 
                          key={user.id} 
                          className='hover:bg-muted cursor-pointer transition-colors'
                          onClick={() => handleRowClick(user)}
                        >
                          {enableMassActions && (
                            <TableCell>
                              <Checkbox
                                checked={selectedUsers.has(user.id)}
                                onCheckedChange={() => toggleUserSelection(user.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label={`Seleccionar usuario ${user.name}`}
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className='flex items-center space-x-3'>
                              <div className='relative group/avatar'>
                                <Avatar className='h-8 w-8'>
                                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                                  <AvatarFallback className='bg-muted text-muted-foreground'>
                                    {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                {/* Botón de cámara para cambiar avatar */}
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="absolute inset-0 opacity-0 group-hover/avatar:opacity-100 transition-opacity rounded-full bg-black/50 hover:bg-black/70 text-white border-0 p-0"
                                  onClick={(e) => handleAvatarClick(user, e)}
                                >
                                  <Camera className="h-3 w-3" />
                                </Button>
                              </div>
                              <div>
                                <div className='font-medium text-foreground flex items-center space-x-2'>
                                  <span>{user.name}</span>
                                  {user.id === session?.user?.id && (
                                    <Badge variant="outline" className="text-xs">Tú</Badge>
                                  )}
                                </div>
                                <div className='text-sm text-muted-foreground flex items-center'>
                                  <Mail className='h-3 w-3 mr-1' />
                                  {user.email}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={USER_ROLE_COLORS[user.role]}>
                              <RoleIcon className='h-3 w-3 mr-1' />
                              {USER_ROLE_LABELS[user.role]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              {user.department ? (
                                <div className='flex items-center'>
                                  <Building className='h-4 w-4 mr-1 text-muted-foreground' />
                                  {typeof user.department === 'string' ? user.department : user.department.name}
                                </div>
                              ) : (
                                <span className='text-muted-foreground'>-</span>
                              )}
                              {user.phone && (
                                <div className='flex items-center text-muted-foreground mt-1'>
                                  <Phone className='h-3 w-3 mr-1' />
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm text-muted-foreground'>
                              {user.lastLogin ? (
                                <>
                                  <div>Último acceso:</div>
                                  <div className='text-muted-foreground'>{formatTimeAgo(user.lastLogin)}</div>
                                </>
                              ) : (
                                <span className='text-muted-foreground'>Nunca</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                user.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {user.isActive ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              <div>Creados: {user._count.tickets_tickets_createdByIdTousers || 0}</div>
                              <div>Asignados: {user._count.tickets_tickets_assigneeIdTousers || 0}</div>
                            </div>
                          </TableCell>
                          <TableCell className='text-right'>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant='ghost' 
                                  size='sm'
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className='h-4 w-4' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end'>
                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation()
                                  onUserEdit?.(user)
                                }}>
                                  <Edit className='h-4 w-4 mr-2' />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleUserStatus(user.id, user.isActive)
                                  }}
                                  disabled={user.id === session?.user?.id && user.isActive}
                                >
                                  {user.isActive ? (
                                    <>
                                      <EyeOff className='h-4 w-4 mr-2' />
                                      {user.id === session?.user?.id ? 'No puedes desactivarte' : 'Desactivar'}
                                    </>
                                  ) : (
                                    <>
                                      <Eye className='h-4 w-4 mr-2' />
                                      Activar
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onUserDelete?.(user)
                                  }}
                                  disabled={!user.canDelete || user.id === session?.user?.id}
                                  className='text-red-600'
                                >
                                  <Trash2 className='h-4 w-4 mr-2' />
                                  {user.id === session?.user?.id ? 'No puedes eliminarte' : 'Eliminar'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            /* Vista de Tarjetas */
            <div className='grid gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className='animate-pulse'>
                    <CardContent className='p-6'>
                      <div className='flex items-center space-x-4'>
                        <div className='h-16 w-16 bg-muted rounded-full'></div>
                        <div className='space-y-2 flex-1'>
                          <div className='h-4 bg-muted rounded w-3/4'></div>
                          <div className='h-3 bg-muted rounded w-1/2'></div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : error ? (
                <div className='col-span-full flex flex-col items-center justify-center py-12'>
                  <div className='text-red-500 font-medium mb-2'>Error al cargar usuarios</div>
                  <div className='text-sm text-muted-foreground mb-4'>{error.message}</div>
                  <Button variant='outline' size='sm' onClick={refresh}>
                    <RefreshCw className='h-4 w-4 mr-2' />
                    Reintentar
                  </Button>
                </div>
              ) : users.length === 0 ? (
                <div className='col-span-full flex flex-col items-center justify-center py-12'>
                  <Users className='h-12 w-12 text-muted-foreground mb-4' />
                  <div className='text-muted-foreground font-medium mb-2'>
                    {hasActiveFilters
                      ? 'No se encontraron usuarios con los filtros aplicados'
                      : 'No hay usuarios disponibles'
                    }
                  </div>
                  {hasActiveFilters && (
                    <Button variant='outline' size='sm' onClick={clearFilters}>
                      Limpiar filtros
                    </Button>
                  )}
                </div>
              ) : (
                users.map(user => (
                  <UserStatsCard
                    key={user.id}
                    user={user}
                    onEdit={() => onUserEdit?.(user)}
                    onDelete={() => onUserDelete?.(user)}
                    onDetails={() => handleRowClick(user)}
                    onAvatarClick={(e) => handleAvatarClick(user, e)}
                    canDelete={user.canDelete}
                    showDetailedStats={true}
                  />
                ))
              )}
            </div>
          )}

          {/* Paginación avanzada */}
          {!loading && !error && pagination.totalPages > 1 && (
            <div className='flex flex-col sm:flex-row items-center justify-between mt-6 gap-4'>
              <div className='text-sm text-muted-foreground'>
                {pagination.total > 0 ? (
                  <>
                    Mostrando {(pagination.page - 1) * pagination.limit + 1} a {Math.min(pagination.page * pagination.limit, pagination.total)} de{' '}
                    {pagination.total} usuarios
                    {hasActiveFilters && (
                      <span className='text-blue-600 ml-1'>(filtrados)</span>
                    )}
                  </>
                ) : (
                  'No hay usuarios para mostrar'
                )}
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page === 1 || loading}
                >
                  <ChevronLeft className='h-4 w-4' />
                  <span className='hidden sm:inline ml-1'>Anterior</span>
                </Button>
                
                <div className='flex items-center space-x-1'>
                  {/* Paginación inteligente similar a tickets */}
                  {(() => {
                    const pages = []
                    const maxVisiblePages = 5
                    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2))
                    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1)
                    
                    if (endPage - startPage + 1 < maxVisiblePages) {
                      startPage = Math.max(1, endPage - maxVisiblePages + 1)
                    }
                    
                    if (startPage > 1) {
                      pages.push(
                        <Button
                          key={1}
                          variant='outline'
                          size='sm'
                          onClick={() => goToPage(1)}
                          disabled={loading}
                        >
                          1
                        </Button>
                      )
                      if (startPage > 2) {
                        pages.push(<span key="ellipsis1" className='px-2 text-muted-foreground'>...</span>)
                      }
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pages.push(
                        <Button
                          key={i}
                          variant={pagination.page === i ? 'default' : 'outline'}
                          size='sm'
                          onClick={() => goToPage(i)}
                          disabled={loading}
                        >
                          {i}
                        </Button>
                      )
                    }
                    
                    if (endPage < pagination.totalPages) {
                      if (endPage < pagination.totalPages - 1) {
                        pages.push(<span key="ellipsis2" className='px-2 text-muted-foreground'>...</span>)
                      }
                      pages.push(
                        <Button
                          key={pagination.totalPages}
                          variant='outline'
                          size='sm'
                          onClick={() => goToPage(pagination.totalPages)}
                          disabled={loading}
                        >
                          {pagination.totalPages}
                        </Button>
                      )
                    }
                    
                    return pages
                  })()}
                </div>
                
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages || loading}
                >
                  <span className='hidden sm:inline mr-1'>Siguiente</span>
                  <ChevronRight className='h-4 w-4' />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmación */}
      <AlertDialog open={confirmationDialog.isOpen} onOpenChange={(open) => 
        setConfirmationDialog(prev => ({ ...prev, isOpen: open }))
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmationDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPerformingAction}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmationDialog.action}
              disabled={isPerformingAction}
            >
              {isPerformingAction ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Procesando...
                </>
              ) : (
                'Confirmar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
        onAvatarUpdated={handleAvatarUpdated}
      />
    </>
  )
}