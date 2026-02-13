'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Search, User, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

export interface UserOption {
  id: string
  name: string
  email: string
  role?: string
  department?: {
    id: string
    name: string
    color: string
  }
  avatar?: string
}

interface UserComboboxProps {
  value?: string
  onValueChange: (value: string) => void
  role?: 'CLIENT' | 'TECHNICIAN' | 'ADMIN'
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  allowClear?: boolean
  showEmail?: boolean
  showDepartment?: boolean
}

export function UserCombobox({
  value,
  onValueChange,
  role,
  placeholder = 'Seleccionar usuario...',
  emptyText = 'No se encontraron usuarios',
  disabled = false,
  className,
  allowClear = true,
  showEmail = true,
  showDepartment = true,
}: UserComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [users, setUsers] = React.useState<UserOption[]>([])
  const [loading, setLoading] = React.useState(false)
  const [selectedUser, setSelectedUser] = React.useState<UserOption | null>(null)

  // Debounce search
  const debounceTimeout = React.useRef<NodeJS.Timeout | null>(null)

  // Cargar usuarios cuando se abre el combobox o cambia la búsqueda
  React.useEffect(() => {
    if (open || search) {
      // Limpiar timeout anterior
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }

      // Debounce de 300ms
      debounceTimeout.current = setTimeout(() => {
        loadUsers(search)
      }, 300)
    }

    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }
    }
  }, [open, search, role])

  // Cargar usuario seleccionado cuando cambia el value
  React.useEffect(() => {
    if (value && !selectedUser) {
      loadSelectedUser(value)
    } else if (!value) {
      setSelectedUser(null)
    }
  }, [value])

  const loadUsers = async (query: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (role) params.append('role', role)
      params.append('isActive', 'true')
      params.append('limit', '20')
      if (query) params.append('search', query)

      const response = await fetch(`/api/users?${params}`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setUsers(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSelectedUser = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedUser(data)
      }
    } catch (error) {
      console.error('Error loading selected user:', error)
    }
  }

  const handleSelect = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (user) {
      setSelectedUser(user)
      onValueChange(userId)
      setOpen(false)
      setSearch('')
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedUser(null)
    onValueChange('')
    setSearch('')
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'Admin'
      case 'TECHNICIAN':
        return 'Técnico'
      case 'CLIENT':
        return 'Cliente'
      default:
        return ''
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !selectedUser && 'text-muted-foreground',
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedUser ? (
              <>
                <User className="h-4 w-4 flex-shrink-0" />
                <div className="flex flex-col items-start flex-1 min-w-0">
                  <span className="font-medium truncate">{selectedUser.name}</span>
                  {showEmail && (
                    <span className="text-xs text-muted-foreground truncate">
                      {selectedUser.email}
                    </span>
                  )}
                </div>
                {selectedUser.role && (
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {getRoleLabel(selectedUser.role)}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Search className="h-4 w-4 flex-shrink-0" />
                <span>{placeholder}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {allowClear && selectedUser && (
              <X
                className="h-4 w-4 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre o email..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Buscando...
              </div>
            ) : users.length === 0 ? (
              <CommandEmpty>{emptyText}</CommandEmpty>
            ) : (
              <CommandGroup>
                {users.map((user) => (
                  <CommandItem
                    key={user.id}
                    value={user.id}
                    onSelect={handleSelect}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === user.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-shrink-0">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{user.name}</span>
                          {user.role && (
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {getRoleLabel(user.role)}
                            </Badge>
                          )}
                        </div>
                        {showEmail && (
                          <span className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </span>
                        )}
                        {showDepartment && user.department && (
                          <Badge
                            variant="outline"
                            className="text-xs mt-1 w-fit"
                            style={{
                              borderColor: user.department.color,
                              color: user.department.color,
                            }}
                          >
                            {user.department.name}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
