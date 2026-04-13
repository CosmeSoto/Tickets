/**
 * Diálogo para seleccionar un usuario y promoverlo a técnico
 * Valida que el usuario no tenga tickets pendientes antes de permitir la promoción
 */

'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Search, UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import type { BaseUser } from '@/types/user'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserSelected: (user: BaseUser) => void
}

interface UserWithValidation extends BaseUser {
  pendingTickets?: number
  canPromote?: boolean
  validationMessage?: string
}

export function UserSelectionDialog({ open, onOpenChange, onUserSelected }: Props) {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserWithValidation[]>([])
  const [loading, setLoading] = useState(false)
  const [validating, setValidating] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<UserWithValidation | null>(null)

  // Cargar usuarios disponibles (solo clientes)
  useEffect(() => {
    if (open) {
      loadUsers()
    } else {
      // Reset al cerrar
      setUsers([])
      setSearchTerm('')
      setSelectedUserId('')
      setSelectedUser(null)
    }
  }, [open])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users?role=CLIENT', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error('Error al cargar usuarios')
      }

      const result = await response.json()
      
      if (result.success && Array.isArray(result.data)) {
        setUsers(result.data)
      } else {
        throw new Error('Formato de respuesta inválido')
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error)
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los usuarios disponibles',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // Validar usuario seleccionado
  const validateUser = async (userId: string) => {
    setValidating(true)
    try {
      const response = await fetch(`/api/users/${userId}/validate-promotion`, {
        credentials: 'include'
      })
      
      const result = await response.json()
      
      if (result.success) {
        const user = users.find(u => u.id === userId)
        if (user) {
          const validatedUser: UserWithValidation = {
            ...user,
            pendingTickets: result.data.pendingTickets || 0,
            canPromote: result.data.canPromote,
            validationMessage: result.data.message
          }
          setSelectedUser(validatedUser)
        }
      } else {
        toast({
          title: 'Error de validación',
          description: result.error || 'No se pudo validar el usuario',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Error validando usuario:', error)
      toast({
        title: 'Error',
        description: 'No se pudo validar el usuario',
        variant: 'destructive'
      })
    } finally {
      setValidating(false)
    }
  }

  // Manejar selección de usuario
  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId)
    setSelectedUser(null)
    if (userId) {
      validateUser(userId)
    }
  }

  // Confirmar promoción
  const handleConfirm = () => {
    if (selectedUser && selectedUser.canPromote) {
      onUserSelected(selectedUser)
      onOpenChange(false)
    }
  }

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <UserPlus className="h-5 w-5" />
            <span>Seleccionar Usuario para Promover</span>
          </DialogTitle>
          <DialogDescription asChild>
            <span>
              Selecciona un usuario cliente para promoverlo a técnico. El usuario no debe tener tickets pendientes.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selector de usuario con búsqueda integrada */}
          <div>
            <Label htmlFor="user">Seleccionar Usuario</Label>
            <Select 
              value={selectedUserId} 
              onValueChange={handleUserSelect}
              disabled={loading || validating}
            >
              <SelectTrigger className="h-auto min-h-[40px]">
                <SelectValue placeholder={
                  loading ? "Cargando usuarios..." : 
                  users.length === 0 ? "No hay usuarios disponibles" :
                  "Buscar y seleccionar usuario..."
                } />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {/* Campo de búsqueda dentro del selector */}
                <div className="sticky top-0 z-10 bg-background p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Buscar por nombre o email..."
                      className="pl-8 h-8"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>
                
                {/* Lista de usuarios filtrados */}
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {searchTerm ? 'No se encontraron usuarios' : 'No hay usuarios disponibles'}
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col py-1">
                        <span className="font-medium">{user.name}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                        {user.phone && (
                          <span className="text-xs text-muted-foreground">📞 {user.phone}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              {users.length} usuario{users.length !== 1 ? 's' : ''} disponible{users.length !== 1 ? 's' : ''} para promoción
            </p>
          </div>

          {/* Estado de validación */}
          {validating && (
            <Alert>
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Validando usuario...
              </AlertDescription>
            </Alert>
          )}

          {/* Resultado de validación */}
          {selectedUser && !validating && (
            <Alert variant={selectedUser.canPromote ? 'default' : 'destructive'}>
              {selectedUser.canPromote ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {selectedUser.validationMessage || (
                  selectedUser.canPromote 
                    ? 'Usuario válido para promoción'
                    : `No se puede promover: tiene ${selectedUser.pendingTickets} ticket(s) pendiente(s)`
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Información del usuario seleccionado */}
          {selectedUser && selectedUser.canPromote && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium">Usuario seleccionado:</h4>
              <div className="text-sm space-y-1">
                <p><span className="text-muted-foreground">Nombre:</span> {selectedUser.name}</p>
                <p><span className="text-muted-foreground">Email:</span> {selectedUser.email}</p>
                {selectedUser.phone && (
                  <p><span className="text-muted-foreground">Teléfono:</span> {selectedUser.phone}</p>
                )}
                <p><span className="text-muted-foreground">Tickets pendientes:</span> {selectedUser.pendingTickets || 0}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={validating}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!selectedUser || !selectedUser.canPromote || validating}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Continuar con Promoción
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
