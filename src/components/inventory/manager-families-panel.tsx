'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'
import { FamilyBadge } from '@/components/inventory/family-badge'

interface ManagerFamiliesPanelProps {
  managerId: string
  allFamilies: Array<{ id: string; name: string; icon?: string | null; color?: string | null; code: string }>
  currentFamilyIds: string[]
  onSaved?: () => void
}

export function ManagerFamiliesPanel({
  managerId,
  allFamilies,
  currentFamilyIds,
  onSaved,
}: ManagerFamiliesPanelProps) {
  const { success, error } = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>(currentFamilyIds)
  const [saving, setSaving] = useState(false)

  const toggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/inventory/managers/${managerId}/families`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyIds: selectedIds }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Error al guardar')
      }
      success('Familias actualizadas', 'Los cambios se han guardado correctamente')
      onSaved?.()
    } catch (err) {
      error('Error al guardar', err instanceof Error ? err.message : 'No se pudo guardar la configuración')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {allFamilies.map(family => (
          <div
            key={family.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/50 cursor-pointer"
            onClick={() => toggle(family.id)}
          >
            <Checkbox
              id={`family-${family.id}`}
              checked={selectedIds.includes(family.id)}
              onCheckedChange={() => toggle(family.id)}
              onClick={e => e.stopPropagation()}
            />
            <Label
              htmlFor={`family-${family.id}`}
              className="flex-1 cursor-pointer"
              onClick={e => e.preventDefault()}
            >
              <FamilyBadge family={family} size="sm" />
            </Label>
          </div>
        ))}
      </div>

      {allFamilies.length === 0 && (
        <p className="text-sm text-muted-foreground italic text-center py-4">
          No hay familias disponibles
        </p>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" />Guardar</>
          )}
        </Button>
      </div>
    </div>
  )
}
