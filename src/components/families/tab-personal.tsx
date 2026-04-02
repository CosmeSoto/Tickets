'use client'

/**
 * TabPersonal — Pestaña Personal de la página de detalle de familia.
 * - Técnicos de Tickets: TechnicianFamilyAssignment + TechnicianManagementPanel
 * - Gestores de Inventario: ManagerFamilyAssignment + InventoryManagerPanel
 * Requisitos: 5.1–5.9
 */

import {
  TechnicianFamilyAssignment,
  type AssignedTechnician,
} from '@/components/families/technician-family-assignment'
import { TechnicianManagementPanel } from '@/components/families/technician-management-panel'
import {
  ManagerFamilyAssignment,
  type AssignedManager,
} from '@/components/families/manager-family-assignment'
import { InventoryManagerPanel } from '@/components/families/inventory-manager-panel'

// ---- Types ----

export type { AssignedTechnician as TechnicianAssignment }
export type { AssignedManager as ManagerAssignment }

interface UserOption {
  id: string
  name: string
  email: string
  role: string
  isActive: boolean
  canManageInventory?: boolean
}

export interface TabPersonalProps {
  familyId: string
  technicians: AssignedTechnician[]
  managers: AssignedManager[]
  onPersonnelChanged: () => void
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
}

// ---- TabPersonal ----

export function TabPersonal({ familyId, technicians, managers, onPersonnelChanged }: TabPersonalProps) {
  return (
    <div className="space-y-8">

      {/* ── Sección 1: Técnicos de esta familia ── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Técnicos de Tickets</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Técnicos del sistema que atienden tickets de <strong>esta familia</strong>.
            Solo los técnicos asignados aquí reciben tickets de esta familia.
          </p>
        </div>
        <TechnicianFamilyAssignment
          mode="by-family"
          familyId={familyId}
          assignedTechnicians={technicians}
          onChanged={onPersonnelChanged}
        />
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">¿Necesitas crear o editar un técnico?</span>
          <TechnicianManagementPanel onChanged={onPersonnelChanged} />
        </div>
      </div>

      {/* ── Sección 2: Gestores de inventario de esta familia ── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Gestores de Inventario</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Usuarios que pueden gestionar los activos de inventario de <strong>esta familia</strong>.
            Pueden ser técnicos, clientes o cualquier usuario con el permiso activado.
          </p>
        </div>
        <ManagerFamilyAssignment
          mode="by-family"
          familyId={familyId}
          assignedManagers={managers}
          onChanged={onPersonnelChanged}
        />
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-muted-foreground">¿Necesitas ver todos los gestores del sistema?</span>
          <InventoryManagerPanel onChanged={onPersonnelChanged} />
        </div>
      </div>

    </div>
  )
}
