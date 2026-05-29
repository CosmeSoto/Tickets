'use client'

import { Activity } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ModuleAccessCard } from '@/components/users/module-access-card'
import { UserModulesPanel } from '@/components/users/user-modules-panel'
import { useSystemModules } from '@/hooks/use-system-modules'
import { type UserRole } from '@/lib/constants/user-constants'
import { type FamilyOption } from '@/components/users/family-assignment-section'

interface UserData {
  id: string
  role: UserRole
  department: any
}

interface PermissionsAndModulesSectionProps {
  user: UserData
  isCurrentUser: boolean
  formData: {
    isActive: boolean
    isSuperAdmin: boolean
    role: UserRole
    ticketsEnabled: boolean
    inventoryEnabled: boolean
    patrolsEnabled: boolean
    newsEnabled: boolean
    formsEnabled: boolean
    canManageForms: boolean
    canManageInventory: boolean
    canRequestAssets: boolean
  }
  loading: boolean
  loadingFamilies: boolean
  ticketFamilies: FamilyOption[]
  inventoryFamilies: FamilyOption[]
  patrolFamilies: FamilyOption[]
  technicianFamilyIds: string[]
  clientFamilyIds: string[]
  inventoryFamilyIds: string[]
  patrolFamilyIds: string[]
  adminFamilyIds: string[]
  ticketReadOnlyIds: string[]
  inventoryReadOnlyIds: string[]
  patrolReadOnlyIds: string[]
  adminScopeReadOnlyIds: string[]
  onToggle: (
    field:
      | 'isActive'
      | 'isSuperAdmin'
      | 'ticketsEnabled'
      | 'inventoryEnabled'
      | 'patrolsEnabled'
      | 'newsEnabled'
      | 'formsEnabled'
      | 'canManageForms'
      | 'canManageInventory'
      | 'canRequestAssets',
    value: boolean
  ) => void
  handlers: {
    handleAssignTechnicianFamily: (id: string) => Promise<any>
    handleUnassignTechnicianFamily: (id: string) => Promise<any>
    handleAssignClientFamily: (id: string) => Promise<any>
    handleUnassignClientFamily: (id: string) => Promise<any>
    handleAssignInventoryFamily: (id: string) => Promise<any>
    handleUnassignInventoryFamily: (id: string) => Promise<any>
    handleAssignPatrolFamily: (id: string) => Promise<any>
    handleUnassignPatrolFamily: (id: string) => Promise<any>
    handleAssignAdminFamily: (id: string) => Promise<any>
    handleUnassignAdminFamily: (id: string) => Promise<any>
  }
}

export function PermissionsAndModulesSection({
  user,
  isCurrentUser,
  formData,
  loading,
  loadingFamilies,
  ticketFamilies,
  inventoryFamilies,
  patrolFamilies,
  technicianFamilyIds,
  clientFamilyIds,
  inventoryFamilyIds,
  patrolFamilyIds,
  adminFamilyIds,
  ticketReadOnlyIds,
  inventoryReadOnlyIds,
  patrolReadOnlyIds,
  adminScopeReadOnlyIds,
  onToggle,
  handlers,
}: PermissionsAndModulesSectionProps) {
  const { modules: systemModules } = useSystemModules()

  return (
    <div className='space-y-3'>
      <h3 className='text-sm font-semibold text-foreground'>Estado y permisos</h3>
      <div className='space-y-2'>
        <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
          <div>
            <p className='text-sm font-medium'>Usuario activo</p>
            <p className='text-xs text-muted-foreground'>
              El usuario puede iniciar sesión y usar el sistema
            </p>
          </div>
          <Switch
            checked={formData.isActive}
            onCheckedChange={v => onToggle('isActive', v)}
            disabled={isCurrentUser}
          />
        </div>

        {formData.role === 'ADMIN' && !isCurrentUser && (
          <div className='flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5'>
            <div>
              <p className='text-sm font-medium'>Administrador Principal (Super Admin)</p>
              <p className='text-xs text-muted-foreground'>
                Acceso total a todas las familias y configuraciones del sistema.
              </p>
            </div>
            <Switch
              checked={formData.isSuperAdmin}
              onCheckedChange={v => onToggle('isSuperAdmin', v)}
            />
          </div>
        )}

        {formData.role === 'ADMIN' && !formData.isSuperAdmin && (
          <div className='rounded-lg border bg-muted/30 px-3 py-2.5 space-y-1'>
            <p className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
              <Activity className='h-3.5 w-3.5' />
              Acceso como Administrador de Familia
            </p>
            <p className='text-xs text-muted-foreground'>
              Los módulos habilitados abajo determinan qué secciones verá este admin. Además, solo
              verá datos de las familias que tenga asignadas.
            </p>
          </div>
        )}
      </div>

      {!formData.isSuperAdmin && systemModules.length > 0 && (
        <div className='space-y-2 pt-1'>
          <p className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
            Acceso a módulos
          </p>

          <div className='space-y-2'>
            <ModuleAccessCard
              moduleKey='tickets'
              moduleName='Tickets de Soporte'
              role={formData.role}
              enabled={formData.ticketsEnabled}
              onToggle={v => onToggle('ticketsEnabled', v)}
              families={ticketFamilies}
              assignedFamilyIds={
                formData.role === 'TECHNICIAN'
                  ? technicianFamilyIds
                  : formData.role === 'ADMIN'
                    ? adminFamilyIds
                    : clientFamilyIds
              }
              nativeFamilyId={
                user && typeof user.department === 'object'
                  ? ((user.department as any)?.familyId ?? null)
                  : null
              }
              readOnlyFamilyIds={ticketReadOnlyIds}
              onAssignFamily={
                formData.role === 'TECHNICIAN'
                  ? handlers.handleAssignTechnicianFamily
                  : formData.role === 'ADMIN'
                    ? handlers.handleAssignAdminFamily
                    : handlers.handleAssignClientFamily
              }
              onUnassignFamily={
                formData.role === 'TECHNICIAN'
                  ? (handlers.handleUnassignTechnicianFamily as (id: string) => Promise<any>)
                  : formData.role === 'ADMIN'
                    ? handlers.handleUnassignAdminFamily
                    : handlers.handleUnassignClientFamily
              }
              loading={loadingFamilies}
              disabled={loading}
            />

            <ModuleAccessCard
              moduleKey='inventory'
              moduleName='Inventario'
              role={formData.role}
              enabled={formData.inventoryEnabled || formData.canManageInventory}
              onToggle={v => onToggle('inventoryEnabled', v)}
              families={inventoryFamilies}
              assignedFamilyIds={inventoryFamilyIds}
              nativeFamilyId={
                user && typeof user.department === 'object'
                  ? ((user.department as any)?.familyId ?? null)
                  : null
              }
              readOnlyFamilyIds={inventoryReadOnlyIds}
              onAssignFamily={handlers.handleAssignInventoryFamily}
              onUnassignFamily={handlers.handleUnassignInventoryFamily}
              options={{
                canManageInventory: formData.canManageInventory,
                onToggleManager: v => onToggle('canManageInventory', v),
                canRequestAssets: formData.canRequestAssets,
                onToggleRequestAssets: v => onToggle('canRequestAssets', v),
              }}
              loading={loadingFamilies}
              disabled={loading}
            />

            <ModuleAccessCard
              moduleKey='patrols'
              moduleName='Rondas y Patrullajes'
              role={formData.role}
              enabled={formData.patrolsEnabled}
              onToggle={v => onToggle('patrolsEnabled', v)}
              families={patrolFamilies}
              assignedFamilyIds={patrolFamilyIds}
              nativeFamilyId={
                user && typeof user.department === 'object'
                  ? ((user.department as any)?.familyId ?? null)
                  : null
              }
              readOnlyFamilyIds={patrolReadOnlyIds}
              onAssignFamily={handlers.handleAssignPatrolFamily}
              onUnassignFamily={handlers.handleUnassignPatrolFamily}
              loading={loadingFamilies}
              disabled={loading}
            />

            <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
              <div>
                <p className='text-sm font-medium flex items-center gap-2'>📰 Noticias</p>
                <p className='text-xs text-muted-foreground'>
                  Permite al usuario ver el módulo de noticias
                </p>
              </div>
              <Switch
                checked={formData.newsEnabled}
                onCheckedChange={v => onToggle('newsEnabled', v)}
                disabled={loading}
              />
            </div>

            <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
              <div>
                <p className='text-sm font-medium flex items-center gap-2'>📄 Documentos</p>
                <p className='text-xs text-muted-foreground'>
                  Permite al usuario ver el módulo de documentos
                </p>
              </div>
              <Switch
                checked={formData.formsEnabled}
                onCheckedChange={v => onToggle('formsEnabled', v)}
                disabled={loading}
              />
            </div>

            {formData.formsEnabled && (
              <div className='flex items-center justify-between rounded-lg border px-3 py-2.5 bg-muted/30'>
                <div>
                  <p className='text-sm font-medium flex items-center gap-2'>
                    🔧 Permitir gestión de documentos
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    Permite crear, editar y eliminar documentos de sus familias
                  </p>
                </div>
                <Switch
                  checked={formData.canManageForms}
                  onCheckedChange={v => onToggle('canManageForms', v)}
                  disabled={loading}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {user && !formData.isSuperAdmin && (
        <UserModulesPanel
          userId={user.id}
          role={formData.role}
          canManageInventory={formData.canManageInventory}
          ticketsEnabled={formData.ticketsEnabled}
          inventoryEnabled={formData.inventoryEnabled}
          patrolsEnabled={formData.patrolsEnabled}
          newsEnabled={formData.newsEnabled}
          formsEnabled={formData.formsEnabled}
          canManageForms={formData.canManageForms}
        />
      )}

      {user && formData.isSuperAdmin && (
        <UserModulesPanel
          userId={user.id}
          role={formData.role}
          canManageInventory={true}
          ticketsEnabled={true}
          inventoryEnabled={true}
          patrolsEnabled={true}
          newsEnabled={true}
          formsEnabled={true}
          canManageForms={true}
        />
      )}
    </div>
  )
}
