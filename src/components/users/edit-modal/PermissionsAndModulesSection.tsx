'use client'

import { useMemo } from 'react'
import { Activity } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { ModuleAccessCard } from '@/components/users/module-access-card'
import { UserModulesPanel } from '@/components/users/user-modules-panel'
import { useSystemModules } from '@/hooks/use-system-modules'
import { type UserRole } from '@/lib/constants/user-constants'
import { type FamilyOption } from '@/components/users/family-assignment-section'
import { type UserData } from '@/hooks/use-users'
import { resolveNativeFamily } from '@/lib/utils/native-family'

interface DepartmentOption {
  id: string
  name: string
  color?: string | null
  familyId?: string | null
  family?: {
    id: string
    name: string
    code: string
    color?: string | null
  } | null
}

interface PermissionsAndModulesSectionProps {
  user: UserData
  isCurrentUser: boolean
  formData: {
    isActive: boolean
    isSuperAdmin: boolean
    role: UserRole
    departmentId: string
    ticketsEnabled: boolean
    inventoryEnabled: boolean
    patrolsEnabled: boolean
    newsEnabled: boolean
    canManageNews: boolean
    formsEnabled: boolean
    canManageForms: boolean
    credentialsEnabled: boolean
    canManageCredentials: boolean
    canManageInventory: boolean
    canRequestAssets: boolean
    canAccessKnowledge: boolean
  }
  /** Departamentos del sistema (con familyId/family) para resolver nativa al cambiar depto */
  departments?: DepartmentOption[]
  /** Todas las familias activas — fallback si el depto no trae family embebida */
  allFamilies?: FamilyOption[]
  loading: boolean
  loadingFamilies: boolean
  ticketFamilies: FamilyOption[]
  inventoryFamilies: FamilyOption[]
  patrolFamilies: FamilyOption[]
  credentialsFamilies: FamilyOption[]
  technicianFamilyIds: string[]
  clientFamilyIds: string[]
  inventoryFamilyIds: string[]
  patrolFamilyIds: string[]
  credentialsFamilyIds: string[]
  adminFamilyIds: string[]
  /** Áreas adicionales del módulo unificado `content` (docs + noticias) */
  contentFamilyIds: string[]
  ticketReadOnlyIds: string[]
  inventoryReadOnlyIds: string[]
  patrolReadOnlyIds: string[]
  credentialsReadOnlyIds: string[]
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
      | 'credentialsEnabled'
      | 'canManageCredentials'
      | 'canManageInventory'
      | 'canRequestAssets'
      | 'canAccessKnowledge',
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
    handleAssignCredentialsFamily: (id: string) => Promise<any>
    handleUnassignCredentialsFamily: (id: string) => Promise<any>
    handleAssignAdminFamily: (id: string) => Promise<any>
    handleUnassignAdminFamily: (id: string) => Promise<any>
    handleAssignContentFamily: (id: string) => Promise<any>
    handleUnassignContentFamily: (id: string) => Promise<any>
  }
}

export function PermissionsAndModulesSection({
  user,
  isCurrentUser,
  formData,
  departments = [],
  allFamilies = [],
  loading,
  loadingFamilies,
  ticketFamilies,
  inventoryFamilies,
  patrolFamilies,
  credentialsFamilies,
  technicianFamilyIds,
  clientFamilyIds,
  inventoryFamilyIds,
  patrolFamilyIds,
  credentialsFamilyIds,
  adminFamilyIds,
  contentFamilyIds,
  ticketReadOnlyIds,
  inventoryReadOnlyIds,
  patrolReadOnlyIds,
  credentialsReadOnlyIds,
  adminScopeReadOnlyIds,
  onToggle,
  handlers,
}: PermissionsAndModulesSectionProps) {
  const { modules: systemModules } = useSystemModules()

  const familyLookup = useMemo(() => {
    const map = new Map<string, FamilyOption>()
    for (const f of [
      ...allFamilies,
      ...ticketFamilies,
      ...inventoryFamilies,
      ...patrolFamilies,
      ...credentialsFamilies,
    ]) {
      if (f?.id) map.set(f.id, f)
    }
    return Array.from(map.values())
  }, [allFamilies, ticketFamilies, inventoryFamilies, patrolFamilies, credentialsFamilies])

  // Familia nativa: depto del formulario (si cambia) o el del usuario cargado.
  // familyId plano O family.id; TECHNOLOGY legacy → ADMINISTRATIVE.
  const nativeFamily = useMemo(
    () =>
      resolveNativeFamily({
        departmentId: formData.departmentId,
        userDepartment: typeof user.department === 'object' ? user.department : null,
        departments,
        families: familyLookup,
      }),
    [formData.departmentId, user.department, departments, familyLookup]
  )
  const nativeFamilyId: string | null = nativeFamily?.id ?? null
  const nativeFamilyForCards = nativeFamily
    ? {
        id: nativeFamily.id,
        name: nativeFamily.name,
        code: nativeFamily.code,
        color: nativeFamily.color ?? null,
        isActive: true as boolean,
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
              Los módulos habilitados determinan qué secciones verá. La gestión operativa de tickets
              es en su familia nativa; las adicionales son visibilidad y apoyo.
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
              nativeFamily={nativeFamilyForCards}
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
              options={{
                canAccessKnowledge: formData.canAccessKnowledge,
                onToggleAccessKnowledge: v => onToggle('canAccessKnowledge', v),
              }}
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
              nativeFamily={nativeFamilyForCards}
              readOnlyFamilyIds={inventoryReadOnlyIds}
              onAssignFamily={handlers.handleAssignInventoryFamily}
              onUnassignFamily={handlers.handleUnassignInventoryFamily}
              options={{
                // Inventario: gestión completa — TECHNICIAN y ADMIN (no CLIENT)
                canManageInventory:
                  formData.role !== 'CLIENT' ? formData.canManageInventory : undefined,
                onToggleManager:
                  formData.role !== 'CLIENT' ? v => onToggle('canManageInventory', v) : undefined,
                // "Solicitar activos" — visible para TECHNICIAN y CLIENT (no ADMIN, que siempre puede)
                canRequestAssets:
                  formData.role === 'CLIENT' || formData.role === 'TECHNICIAN'
                    ? formData.canRequestAssets
                    : undefined,
                onToggleRequestAssets:
                  formData.role === 'CLIENT' || formData.role === 'TECHNICIAN'
                    ? v => onToggle('canRequestAssets', v)
                    : undefined,
              }}
              loading={loadingFamilies}
              disabled={loading}
            />

            {/* ── Rondas ── */}
            <ModuleAccessCard
              moduleKey='patrols'
              moduleName='Rondas y Patrullajes'
              role={formData.role}
              enabled={formData.patrolsEnabled}
              onToggle={v => onToggle('patrolsEnabled', v)}
              families={patrolFamilies}
              assignedFamilyIds={patrolFamilyIds}
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamilyForCards}
              readOnlyFamilyIds={patrolReadOnlyIds}
              onAssignFamily={handlers.handleAssignPatrolFamily}
              onUnassignFamily={handlers.handleUnassignPatrolFamily}
              loading={loadingFamilies}
              disabled={loading}
            />

            {/* ── Credenciales ── */}
            <ModuleAccessCard
              moduleKey='credentials'
              moduleName='Credenciales'
              role={formData.role}
              enabled={formData.credentialsEnabled || formData.canManageCredentials}
              onToggle={v => onToggle('credentialsEnabled', v)}
              families={credentialsFamilies}
              assignedFamilyIds={credentialsFamilyIds}
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamilyForCards}
              readOnlyFamilyIds={credentialsReadOnlyIds}
              onAssignFamily={handlers.handleAssignCredentialsFamily}
              onUnassignFamily={handlers.handleUnassignCredentialsFamily}
              options={
                formData.role !== 'CLIENT'
                  ? {
                      canManageCredentials: formData.canManageCredentials,
                      onToggleManageCredentials: v => onToggle('canManageCredentials', v),
                    }
                  : undefined
              }
              loading={loadingFamilies}
              disabled={loading}
            />

            {/* ── Noticias ── */}
            {/* Áreas: módulo unificado `content` (compartido con Documentos). */}
            <ModuleAccessCard
              moduleKey='news'
              moduleName='Noticias'
              role={formData.role}
              enabled={formData.newsEnabled}
              onToggle={v => onToggle('newsEnabled', v)}
              families={allFamilies}
              assignedFamilyIds={contentFamilyIds}
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamilyForCards}
              readOnlyFamilyIds={adminScopeReadOnlyIds}
              onAssignFamily={handlers.handleAssignContentFamily}
              onUnassignFamily={handlers.handleUnassignContentFamily}
              options={
                formData.role === 'TECHNICIAN' || formData.role === 'CLIENT'
                  ? {
                      canManageNews: formData.canManageNews,
                      onToggleManageNews: v => onToggle('canManageNews', v),
                    }
                  : undefined
              }
              loading={loadingFamilies}
              disabled={loading}
            />

            {/* ── Documentos ── */}
            {/* Mismas áreas que Noticias (user_family_access.module = content). */}
            <ModuleAccessCard
              moduleKey='forms'
              moduleName='Documentos'
              role={formData.role}
              enabled={formData.formsEnabled}
              onToggle={v => onToggle('formsEnabled', v)}
              families={allFamilies}
              assignedFamilyIds={contentFamilyIds}
              nativeFamilyId={nativeFamilyId}
              nativeFamily={nativeFamilyForCards}
              readOnlyFamilyIds={adminScopeReadOnlyIds}
              onAssignFamily={handlers.handleAssignContentFamily}
              onUnassignFamily={handlers.handleUnassignContentFamily}
              options={
                formData.role === 'TECHNICIAN' || formData.role === 'CLIENT'
                  ? {
                      canManageForms: formData.canManageForms,
                      onToggleManageForms: v => onToggle('canManageForms', v),
                    }
                  : undefined
              }
              loading={loadingFamilies}
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
          canAccessKnowledge={formData.canAccessKnowledge}
          ticketsEnabled={formData.ticketsEnabled}
          inventoryEnabled={formData.inventoryEnabled}
          patrolsEnabled={formData.patrolsEnabled}
          newsEnabled={formData.newsEnabled}
          canManageNews={formData.canManageNews}
          formsEnabled={formData.formsEnabled}
          canManageForms={formData.canManageForms}
          credentialsEnabled={formData.credentialsEnabled}
          canManageCredentials={formData.canManageCredentials}
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
          credentialsEnabled={true}
          canManageCredentials={true}
          defaultCollapsed
        />
      )}
    </div>
  )
}
