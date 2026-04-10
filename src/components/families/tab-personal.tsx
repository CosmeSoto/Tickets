'use client'

/**
 * TabPersonal — Pestaña Personal de la página de detalle de familia.
 * - Técnicos de Tickets: TechnicianFamilyAssignment + TechnicianManagementPanel
 * - Gestores de Inventario: ManagerFamilyAssignment + InventoryManagerPanel
 * - Administradores Asignados: AdminFamilyAssignment (solo super admin puede modificar)
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
import {
  AdminFamilyAssignment,
  type AssignedAdmin,
} from '@/components/families/admin-family-assignment'

export type { AssignedTechnician as TechnicianAssignment }
export type { AssignedManager as ManagerAssignment }
export type { AssignedAdmin as AdminAssignment }

export interface TabPersonalProps {
  familyId: string
  technicians: AssignedTechnician[]
  managers: AssignedManager[]
  admins: AssignedAdmin[]
  currentUserIsSuperAdmin: boolean
  onPersonnelChanged: () => void
}

export function TabPersonal({
  familyId,
  technicians,
  managers,
  admins,
  currentUserIsSuperAdmin,
  onPersonnelChanged,
}: TabPersonalProps) {
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

      {/* ── Sección 3: Administradores asignados a esta familia ── */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Administradores de Familia</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Administradores con acceso <strong>restringido a esta familia</strong>.
            Pueden gestionar sus técnicos y colaboradores dentro de esta familia,
            pero no tienen acceso a otras familias ni a la configuración global del sistema.
          </p>
        </div>
        <AdminFamilyAssignment
          familyId={familyId}
          assignedAdmins={admins}
          isSuperAdmin={currentUserIsSuperAdmin}
          onChanged={onPersonnelChanged}
        />
      </div>

    </div>
  )
}
