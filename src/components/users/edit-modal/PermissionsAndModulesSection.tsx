'use client'

import { Activity } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { ModuleAccessCard } from '@/components/users/module-access-card'
import { UserModulesPanel } from '@/components/users/user-modules-panel'
import { useSystemModules } from '@/hooks/use-system-modules'
import { type UserRole } from '@/lib/constants/user-constants'
import { type FamilyOption } from '@/components/users/family-assignment-section'
import { type UserData } from '@/hooks/use-users'

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
    canManageNews: boolean
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
      | 'canManageNews'
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

  // Familia nativa: viene del departamento asignado
  const deptObj = user && typeof user.department === 'object' ? (user.department as any) : null
  const nativeFamilyId: string | null = deptObj?.familyId ?? null
  const nativeFamily =
    nativeFamilyId && deptObj?.family
      ? {
          id: deptObj.family.id as string,
          name: deptObj.family.name as string,
          code: deptObj.family.code as string,
          color: deptObj.family.color as string | null,
          isActive: true,
        }
      : null

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
              Los módulos habilitados determinan qué secciones verá. Solo verá datos de sus familias
              asignadas.
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
            {/* ── Tickets ── */}
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
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamily}
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

            {/* ── Inventario ── */}
            <ModuleAccessCard
              moduleKey='inventory'
              moduleName='Inventario'
              role={formData.role}
              enabled={formData.inventoryEnabled || formData.canManageInventory}
              onToggle={v => onToggle('inventoryEnabled', v)}
              families={inventoryFamilies}
              assignedFamilyIds={inventoryFamilyIds}
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamily}
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

            {/* ── Rondas ── */}
            {/* CLIENT: solo agente — sin familia nativa en el card ni selector adicional */}
            {/* TECHNICIAN/ADMIN: supervisor multi-instalación — mostrar selector completo */}
            <ModuleAccessCard
              moduleKey='patrols'
              moduleName='Rondas y Patrullajes'
              role={formData.role}
              enabled={formData.patrolsEnabled}
              onToggle={v => onToggle('patrolsEnabled', v)}
              families={formData.role === 'CLIENT' ? [] : patrolFamilies}
              assignedFamilyIds={formData.role === 'CLIENT' ? [] : patrolFamilyIds}
              nativeFamilyId={formData.role === 'CLIENT' ? null : nativeFamilyId}
              nativeFamily={formData.role === 'CLIENT' ? null : nativeFamily}
              readOnlyFamilyIds={patrolReadOnlyIds}
              onAssignFamily={handlers.handleAssignPatrolFamily}
              onUnassignFamily={handlers.handleUnassignPatrolFamily}
              familyMode='patrol'
              loading={loadingFamilies}
              disabled={loading}
            />

            {/* ── Noticias ── */}
            <ModuleAccessCard
              moduleKey='news'
              moduleName='Noticias'
              role={formData.role}
              enabled={formData.newsEnabled}
              onToggle={v => onToggle('newsEnabled', v)}
              families={[]}
              assignedFamilyIds={[]}
              onAssignFamily={async () => {}}
              onUnassignFamily={async () => {}}
              options={
                // ADMIN siempre gestiona — solo TECHNICIAN puede tener toggle de gestión de noticias
                formData.role === 'TECHNICIAN'
                  ? {
                      canManageNews: formData.canManageNews,
                      onToggleManageNews: v => onToggle('canManageNews', v),
                    }
                  : undefined
              }
              disabled={loading}
            />

            {/* ── Documentos ── */}
            {/* CLIENT: solo puede ver documentos, sin opción de gestionar */}
            <ModuleAccessCard
              moduleKey='forms'
              moduleName='Documentos'
              role={formData.role}
              enabled={formData.formsEnabled}
              onToggle={v => onToggle('formsEnabled', v)}
              families={[]}
              assignedFamilyIds={[]}
              onAssignFamily={async () => {}}
              onUnassignFamily={async () => {}}
              options={
                // Solo TECHNICIAN puede tener canManageForms — CLIENT solo ve
                formData.role === 'TECHNICIAN'
                  ? {
                      canManageForms: formData.canManageForms,
                      onToggleManageForms: v => onToggle('canManageForms', v),
                    }
                  : undefined
              }
              disabled={loading}
            />
          </div>
        </div>
      )}

      {user && !formData.isSuperAdmin && (
        <UserModulesPanel
          userId={user.id}
          role={formData.role}
          canManageInventory={formData.canManageInventory}
          canRequestAssets={formData.canRequestAssets}
          ticketsEnabled={formData.ticketsEnabled}
          inventoryEnabled={formData.inventoryEnabled}
          patrolsEnabled={formData.patrolsEnabled}
          newsEnabled={formData.newsEnabled}
          canManageNews={formData.canManageNews}
          formsEnabled={formData.formsEnabled}
          canManageForms={formData.canManageForms}
          defaultCollapsed
        />
      )}

      {user && formData.isSuperAdmin && (
        <UserModulesPanel
          userId={user.id}
          role={formData.role}
          canManageInventory={true}
          canRequestAssets={true}
          ticketsEnabled={true}
          inventoryEnabled={true}
          patrolsEnabled={true}
          newsEnabled={true}
          canManageNews={true}
          formsEnabled={true}
          canManageForms={true}
          defaultCollapsed
        />
      )}
    </div>
  )
}
