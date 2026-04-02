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
    <div className="space-y-6">
      {/* Técnicos de Tickets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Técnicos de Tickets</p>
            <p className="text-xs text-muted-foreground">Asignación de técnicos a esta familia</p>
          </div>
          <TechnicianManagementPanel onChanged={onPersonnelChanged} />
        </div>
        <TechnicianFamilyAssignment
          mode="by-family"
          familyId={familyId}
          assignedTechnicians={technicians}
          onChanged={onPersonnelChanged}
        />
      </div>

      {/* Gestores de Inventario */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Gestores de Inventario</p>
            <p className="text-xs text-muted-foreground">Asignación de gestores a esta familia</p>
          </div>
          <InventoryManagerPanel onChanged={onPersonnelChanged} />
        </div>
        <ManagerFamilyAssignment
          mode="by-family"
          familyId={familyId}
          assignedManagers={managers}
          onChanged={onPersonnelChanged}
        />
      </div>
    </div>
  )
}
