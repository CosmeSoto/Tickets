'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, Wrench, X } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface TechnicianOption {
  id: string
  name: string
  email: string
}

interface TechnicianComboboxProps {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  allowNull?: boolean
  nullLabel?: string
}

export function TechnicianCombobox({
  value,
  onValueChange,
  placeholder = 'Seleccionar técnico...',
  disabled = false,
  className,
  allowNull = false,
  nullLabel = 'Sin asignar',
}: TechnicianComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [technicians, setTechnicians] = React.useState<TechnicianOption[]>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open || technicians.length > 0 || loading) return

    const fetchTechnicians = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/users?role=TECHNICIAN')
        if (res.ok) {
          const data = await res.json()
          const raw = Array.isArray(data)
            ? data
            : Array.isArray(data?.users)
              ? data.users
              : Array.isArray(data?.data)
                ? data.data
                : []
          setTechnicians(
            raw
              .filter((u: { id?: string }) => typeof u?.id === 'string')
              .map((u: { id: string; name?: string; email?: string }) => ({
                id: u.id,
                name: u.name || u.email || 'Sin nombre',
                email: u.email || '',
              }))
          )
        } else {
          setTechnicians([])
        }
      } catch (error) {
        console.error('Error fetching technicians:', error)
        setTechnicians([])
      } finally {
        setLoading(false)
      }
    }

    void fetchTechnicians()
  }, [open, technicians.length, loading])

  const selectedTechnician = technicians.find(t => t.id === value)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
          disabled={disabled}
        >
          <div className='flex items-center gap-2 flex-1 min-w-0'>
            <Wrench className='h-4 w-4 text-muted-foreground flex-shrink-0' />
            <span className={cn(!selectedTechnician && 'text-muted-foreground', 'truncate')}>
              {selectedTechnician ? selectedTechnician.name : placeholder}
            </span>
          </div>
          <div className='flex items-center gap-1 flex-shrink-0'>
            {allowNull && value && (
              <X className='h-3.5 w-3.5 opacity-50 hover:opacity-100' onClick={handleClear} />
            )}
            <ChevronsUpDown className='h-4 w-4 opacity-40' />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[300px] p-0' align='start'>
        <Command>
          <CommandInput placeholder='Buscar técnico...' />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Cargando técnicos...' : 'No se encontraron técnicos'}
            </CommandEmpty>
            {allowNull && (
              <CommandGroup>
                <CommandItem
                  value=''
                  onSelect={() => {
                    onValueChange('')
                    setOpen(false)
                  }}
                  className='cursor-pointer'
                >
                  <Check className={cn('mr-2 h-4 w-4', !value ? 'opacity-100' : 'opacity-0')} />
                  <span className='font-medium'>{nullLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {technicians.length > 0 && (
              <CommandGroup>
                {technicians.map(tech => (
                  <CommandItem
                    key={tech.id}
                    value={tech.name}
                    onSelect={() => {
                      onValueChange(tech.id)
                      setOpen(false)
                    }}
                    className='cursor-pointer'
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === tech.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className='flex flex-col'>
                      <span className='font-medium'>{tech.name}</span>
                      <span className='text-xs text-muted-foreground'>{tech.email}</span>
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
