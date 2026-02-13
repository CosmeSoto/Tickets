'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, User, Mail, Phone, Building, UserPlus } from 'lucide-react'
import { Badge } from './badge'
import { Button } from './button'
import { useToast } from '@/hooks/use-toast'
import type { BaseUser } from '@/types/user'
import { cn } from '@/lib/utils'
import { 
  USER_ROLE_LABELS,
  USER_ROLE_COLORS,
  USER_ROLE_ICONS,
  type UserRole
} from '@/lib/constants/user-constants'


interface UserToTechnicianSelectorProps {
  onSelectUser: (user: BaseUser) => void
  disabled?: boolean
  placeholder?: string
}

export function UserToTechnicianSelector({
  onSelectUser,
  disabled = false,
  placeholder = "Buscar usuario para promover a técnico..."
}: UserToTechnicianSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [users, setUsers] = useState<BaseUser[]>([])
  const [loading, setLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Cargar usuarios no técnicos
  const loadUsers = async () => {
    setLoading(true)
    try {
      // Cargar usuarios activos que no sean técnicos ni administradores
      const response = await fetch('/api/users?isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          // Filtrar solo usuarios CLIENT activos
          const clientUsers = data.data.filter((user: BaseUser) => 
            user.role === 'CLIENT' && user.isActive
          )
          setUsers(clientUsers)
          
          if (clientUsers.length === 0) {
            toast({
              title: 'Sin usuarios disponibles',
              description: 'No hay usuarios con rol de Cliente disponibles para promover',
              variant: 'info',
            })
          }
        }
      } else {
        throw new Error('Error al cargar usuarios')
      }
    } catch (error) {
      console.error('Error loading users:', error)
      toast({
        title: 'Error al cargar usuarios',
        description: 'No se pudieron cargar los usuarios disponibles',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // Cargar usuarios cuando se abre el dropdown
  useEffect(() => {
    if (isOpen && users.length === 0) {
      loadUsers()
    }
  }, [isOpen])

  // Filtrar usuarios por búsqueda
  const filteredUsers = users.filter(user => {
    const deptName = typeof user.department === 'string' ? user.department : user.department?.name || ''
    return user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      deptName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.phone && user.phone.includes(searchTerm))
  })

  // Manejar selección
  const handleSelect = (user: BaseUser) => {
    onSelectUser(user)
    setIsOpen(false)
    setSearchTerm('')
    setHighlightedIndex(-1)
    
    toast({
      title: 'Usuario seleccionado',
      description: `${user.name} ha sido seleccionado para promover a técnico`,
      variant: 'success',
    })
  }

  // Manejar teclas
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        setIsOpen(true)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => 
          prev < filteredUsers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0)
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
          handleSelect(filteredUsers[highlightedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSearchTerm('')
        setHighlightedIndex(-1)
        break
    }
  }

  // Scroll al elemento destacado
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const element = listRef.current.children[highlightedIndex] as HTMLElement
      if (element) {
        element.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex])

  // Formatear fecha de último acceso
  const formatLastLogin = (dateString?: string) => {
    if (!dateString) return 'Nunca'
    
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor(diff / (1000 * 60 * 60))

    if (hours < 24) return `${hours}h`
    if (days < 30) return `${days}d`
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="relative">
      {/* Input de búsqueda */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "w-full pl-10 pr-10 py-2 border border-border rounded-md",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "disabled:bg-muted disabled:text-muted-foreground",
            isOpen && "ring-2 ring-blue-500 border-blue-500"
          )}
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            if (!isOpen) setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "transform rotate-180"
          )} />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-80 overflow-auto">
          <div ref={listRef}>
            {loading ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div>Cargando usuarios...</div>
              </div>
            ) : filteredUsers.length > 0 ? (
              <>
                {/* Encabezado informativo */}
                <div className="px-3 py-2 bg-blue-50 border-b border-blue-200">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">
                      Usuarios disponibles para promover a técnico
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Solo se muestran usuarios activos con rol de Cliente
                  </p>
                </div>

                {/* Lista de usuarios */}
                {filteredUsers.map((user, index) => {
                  const RoleIcon = USER_ROLE_ICONS[user.role as UserRole]
                  return (
                    <div
                      key={user.id}
                      className={cn(
                        "px-3 py-3 cursor-pointer flex items-center space-x-3",
                        "hover:bg-muted border-b border-gray-100 last:border-b-0",
                        highlightedIndex === index && "bg-blue-50"
                      )}
                      onClick={() => handleSelect(user)}
                    >
                      {/* Avatar e indicadores */}
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border-2",
                          USER_ROLE_COLORS[user.role as UserRole]
                        )}>
                          <RoleIcon className="h-5 w-5" />
                        </div>
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          user.isActive ? "bg-green-500" : "bg-red-500"
                        )} />
                      </div>
                      
                      {/* Información principal */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="font-medium text-sm text-foreground truncate">
                            {user.name}
                          </div>
                          <Badge className={cn("text-xs", USER_ROLE_COLORS[user.role as UserRole])}>
                            {USER_ROLE_LABELS[user.role as UserRole]}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          
                          {user.phone && (
                            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span>{user.phone}</span>
                            </div>
                          )}
                          
                          {user.department && (
                            <div className="flex items-center space-x-1 text-xs">
                              <Building className="h-3 w-3" style={{ color: typeof user.department === 'object' ? user.department.color : '#6B7280' }} />
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                style={{ 
                                  borderColor: typeof user.department === 'object' ? user.department.color : '#6B7280',
                                  color: typeof user.department === 'object' ? user.department.color : '#6B7280'
                                }}
                              >
                                {typeof user.department === 'string' ? user.department : user.department.name}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Estadísticas y último acceso */}
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground font-medium">
                          {user._count?.tickets_tickets_createdByIdTousers || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          tickets
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatLastLogin(user.lastLogin)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? (
                  <div>
                    <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No se encontraron usuarios</div>
                    <div className="text-xs mt-1">
                      Intenta con otro término de búsqueda
                    </div>
                  </div>
                ) : (
                  <div>
                    <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <div>No hay usuarios disponibles</div>
                    <div className="text-xs mt-1">
                      Todos los usuarios activos ya son técnicos o administradores
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay para cerrar */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setIsOpen(false)
            setSearchTerm('')
            setHighlightedIndex(-1)
          }}
        />
      )}
    </div>
  )
}