'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Loader2, Globe, Building2, AlertCircle } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface FamilyOption {
  id: string
  name: string
  icon?: string | null
  color?: string | null
  code: string
}

interface DepartmentOption {
  id: string
  name: string
  familyId?: string | null
}

interface ManagerScope {
  type: 'family' | 'departments' | 'none'
  familyIds: string[]
  departmentIds: string[]
}

interface InventoryManagerScopeProps {
  managerId: string
  allFamilies: FamilyOption[]
}

export function InventoryManagerScope({ managerId, allFamilies }: InventoryManagerScopeProps) {
  const [scope, setScope] = useState<ManagerScope | null>(null)
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(false)
      try {
        const res = await fetch(`/api/inventory/managers/${managerId}/scope`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        if (!cancelled) setScope(data.data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [managerId])

  // Cargar nombres de departamentos cuando el scope es por departamentos específicos
  useEffect(() => {
    if (scope?.type !== 'departments' || scope.departmentIds.length === 0) return

    let cancelled = false
    const loadDepts = async () => {
      try {
        const res = await fetch('/api/departments?limit=500')
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) setDepartments(data.data ?? data.departments ?? [])
      } catch {
        // silencioso — los IDs se muestran como fallback
      }
    }
    loadDepts()
    return () => { cancelled = true }
  }, [scope])

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Cargando scope...
      </div>
    )
  }

  if (error || !scope) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
        <AlertCircle className="h-3 w-3 text-destructive" />
        No se pudo cargar el scope
      </div>
    )
  }

  if (scope.type === 'none') {
    return (
      <p className="text-xs text-muted-foreground italic py-1">
        Sin asignaciones de inventario
      </p>
    )
  }

  if (scope.type === 'family') {
    const assignedFamilies = allFamilies.filter(f => scope.familyIds.includes(f.id))
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <Globe className="h-3.5 w-3.5 text-primary" />
          Acceso por familia completa
        </div>
        {assignedFamilies.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {assignedFamilies.map(family => (
              <FamilyBadge key={family.id} family={family} size="sm" />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {scope.familyIds.length} familia(s) asignada(s)
          </p>
        )}
      </div>
    )
  }

  // type === 'departments'
  const assignedDepts = scope.departmentIds.map(id => {
    const found = departments.find(d => d.id === id)
    return found ?? { id, name: id }
  })

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        Acceso por departamentos específicos
      </div>
      {assignedDepts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {assignedDepts.map(dept => (
            <Badge key={dept.id} variant="secondary" className="text-xs">
              {dept.name}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sin departamentos asignados</p>
      )}
    </div>
  )
}
