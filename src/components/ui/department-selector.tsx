'use client'

import { useState, useMemo } from 'react'
import { Check, ChevronsUpDown, Building } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface Department {
  id: string
  name: string
  description?: string
  color: string
  isActive: boolean
  familyId?: string
  family?: { id: string; name: string; code: string; color?: string | null }
  _count?: { users: number; categories: number }
}

interface DepartmentSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  error?: string
  placeholder?: string
  departments?: Department[]
  existingDepartments?: string[] // kept for compatibility
}

export function DepartmentSelector({
  value,
  onChange,
  disabled = false,
  error,
  placeholder = 'Seleccionar departamento...',
  departments = [],
}: DepartmentSelectorProps) {
  const [open, setOpen] = useState(false)

  const selectedDept = departments.find(d => d.id === value) ?? null

  // Agrupar por familia (relación anidada o familyId)
  const grouped = useMemo(() => {
    const familyMap = new Map<
      string,
      { familyName: string; color: string | null; depts: Department[] }
    >()
    const ungrouped: Department[] = []

    // Primera pasada: nombres/colores desde la relación family
    const metaById = new Map<string, { name: string; color: string | null }>()
    for (const d of departments) {
      if (d.family?.id) {
        metaById.set(d.family.id, {
          name: d.family.name,
          color: d.family.color ?? null,
        })
      }
    }

    for (const d of departments) {
      const fid = d.family?.id ?? d.familyId
      if (!fid) {
        ungrouped.push(d)
        continue
      }
      if (!familyMap.has(fid)) {
        const meta = metaById.get(fid)
        familyMap.set(fid, {
          familyName: d.family?.name ?? meta?.name ?? 'Familia',
          color: d.family?.color ?? meta?.color ?? null,
          depts: [],
        })
      }
      familyMap.get(fid)!.depts.push(d)
    }

    return { groups: Array.from(familyMap.values()), ungrouped }
  }, [departments])

  const hasGroups = grouped.groups.length > 0

  return (
    <div className='space-y-1'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            variant='outline'
            role='combobox'
            aria-expanded={open}
            disabled={disabled || departments.length === 0}
            className={cn(
              'w-full justify-between h-9 text-sm font-normal',
              !selectedDept && 'text-muted-foreground',
              error && 'border-red-500'
            )}
          >
            {selectedDept ? (
              <span className='flex items-center gap-2 truncate'>
                <span
                  className='inline-block h-2.5 w-2.5 rounded-full flex-shrink-0'
                  style={{ backgroundColor: selectedDept.color }}
                />
                {selectedDept.name}
                {selectedDept._count?.users !== undefined && (
                  <Badge variant='secondary' className='text-xs ml-1'>
                    {selectedDept._count.users} usuarios
                  </Badge>
                )}
              </span>
            ) : (
              <span className='flex items-center gap-2'>
                <Building className='h-3.5 w-3.5 opacity-50' />
                {departments.length === 0 ? 'Sin departamentos disponibles' : placeholder}
              </span>
            )}
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>

        <PopoverContent className='w-[320px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Buscar departamento...' className='h-9' />
            <CommandList>
              <CommandEmpty>No se encontraron departamentos.</CommandEmpty>

              {/* Opción para limpiar */}
              {value && (
                <CommandGroup>
                  <CommandItem
                    value='__clear__'
                    onSelect={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                    className='text-muted-foreground text-xs'
                  >
                    <span className='mr-2 opacity-50'>✕</span>
                    Limpiar selección
                  </CommandItem>
                </CommandGroup>
              )}

              {hasGroups ? (
                // Grouped by family
                grouped.groups.map(group => (
                  <CommandGroup
                    key={group.familyName}
                    heading={
                      <span className='flex items-center gap-1.5'>
                        {group.color && (
                          <span
                            className='inline-block h-2 w-2 rounded-full'
                            style={{ backgroundColor: group.color }}
                          />
                        )}
                        {group.familyName}
                      </span>
                    }
                  >
                    {group.depts.map(dept => (
                      <DeptItem
                        key={dept.id}
                        dept={dept}
                        selected={value === dept.id}
                        onSelect={() => {
                          onChange(dept.id)
                          setOpen(false)
                        }}
                      />
                    ))}
                  </CommandGroup>
                ))
              ) : (
                // Flat list
                <CommandGroup>
                  {departments.map(dept => (
                    <DeptItem
                      key={dept.id}
                      dept={dept}
                      selected={value === dept.id}
                      onSelect={() => {
                        onChange(dept.id)
                        setOpen(false)
                      }}
                    />
                  ))}
                </CommandGroup>
              )}

              {/* Ungrouped remainder */}
              {hasGroups && grouped.ungrouped.length > 0 && (
                <CommandGroup heading='Sin familia'>
                  {grouped.ungrouped.map(dept => (
                    <DeptItem
                      key={dept.id}
                      dept={dept}
                      selected={value === dept.id}
                      onSelect={() => {
                        onChange(dept.id)
                        setOpen(false)
                      }}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && <p className='text-xs text-red-600'>{error}</p>}
    </div>
  )
}

function DeptItem({
  dept,
  selected,
  onSelect,
}: {
  dept: Department
  selected: boolean
  onSelect: () => void
}) {
  return (
    <CommandItem
      value={`${dept.name} ${dept.description ?? ''}`}
      onSelect={onSelect}
      className='flex items-center gap-2'
    >
      <Check className={cn('h-4 w-4 flex-shrink-0', selected ? 'opacity-100' : 'opacity-0')} />
      <span
        className='inline-block h-2.5 w-2.5 rounded-full flex-shrink-0'
        style={{ backgroundColor: dept.color }}
      />
      <span className='flex-1 truncate'>{dept.name}</span>
      {dept._count?.users !== undefined && dept._count.users > 0 && (
        <Badge variant='secondary' className='text-xs ml-auto'>
          {dept._count.users}
        </Badge>
      )}
    </CommandItem>
  )
}
