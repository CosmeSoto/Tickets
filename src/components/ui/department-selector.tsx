'use client'

import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Building, Plus, X, RefreshCw } from 'lucide-react'

interface Department {
  id: string
  name: string
  description?: string
  color: string
  isActive: boolean
  _count?: {
    users: number
    categories: number
  }
}

interface DepartmentSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  error?: string
  placeholder?: string
  departments?: Department[]
  existingDepartments?: string[] // Deprecated, kept for compatibility
}

export function DepartmentSelector({
  value,
  onChange,
  disabled = false,
  error,
  placeholder = 'Seleccionar departamento...',
  departments: propDepartments,
}: DepartmentSelectorProps) {
  const [departments, setDepartments] = useState<Department[]>(propDepartments || [])
  const [loading, setLoading] = useState(!propDepartments)
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')

  // Cargar departamentos desde la API solo si no se proporcionaron
  useEffect(() => {
    if (!propDepartments) {
      loadDepartments()
    }
  }, [propDepartments])

  const loadDepartments = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/departments?isActive=true')
      if (response.ok) {
        const data = await response.json()
        if (data.success && Array.isArray(data.data)) {
          setDepartments(data.data)
        }
      }
    } catch (error) {
      console.error('Error loading departments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDepartment = (deptId: string) => {
    onChange(deptId)
    setShowCustomInput(false)
    setCustomValue('')
  }

  const handleClear = () => {
    onChange(null)
    setShowCustomInput(false)
    setCustomValue('')
  }

  const selectedDepartment = departments.find(d => d.id === value)

  if (loading) {
    return (
      <div className="space-y-2">
        <Label>Departamento</Label>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Cargando departamentos...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="department">
        Departamento
        {selectedDepartment && (
          <Badge 
            variant="outline" 
            className="ml-2 text-xs"
            style={{ 
              borderColor: selectedDepartment.color,
              color: selectedDepartment.color
            }}
          >
            {selectedDepartment.name}
          </Badge>
        )}
      </Label>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          {departments.map((dept) => (
            <Button
              key={dept.id}
              type="button"
              variant={value === dept.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleSelectDepartment(dept.id)}
              disabled={disabled}
              className="text-xs"
              style={value === dept.id ? {
                backgroundColor: dept.color,
                borderColor: dept.color
              } : {
                borderColor: dept.color,
                color: dept.color
              }}
            >
              <Building className="h-3 w-3 mr-1" />
              {dept.name}
              {dept._count && dept._count.users > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {dept._count.users}
                </Badge>
              )}
            </Button>
          ))}
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={disabled}
              className="text-xs text-red-600 hover:text-red-800"
            >
              <X className="h-3 w-3 mr-1" />
              Limpiar
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {departments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No hay departamentos disponibles. Contacta al administrador.
        </p>
      )}

      {departments.length > 0 && !value && (
        <p className="text-xs text-muted-foreground">
          Selecciona un departamento para el técnico
        </p>
      )}
    </div>
  )
}
