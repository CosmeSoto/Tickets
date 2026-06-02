'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useToast } from '@/hooks/use-toast'
import { type FamilyOption } from '@/components/users/family-assignment-section'
import { extractApiError, extractCatchError } from '@/lib/utils/api-error'
import { type UserData } from '@/hooks/use-users'

interface UseFamilyAssignmentsProps {
  user: UserData | null
  isOpen: boolean
}

export function useFamilyAssignments({ user, isOpen }: UseFamilyAssignmentsProps) {
  const { data: session } = useSession()
  const { toast } = useToast()

  const [allFamilies, setAllFamilies] = useState<FamilyOption[]>([])
  const [ticketFamilies, setTicketFamilies] = useState<FamilyOption[]>([])
  const [inventoryFamilies, setInventoryFamilies] = useState<FamilyOption[]>([])
  const [patrolFamilies, setPatrolFamilies] = useState<FamilyOption[]>([])
  const [adminTicketScopeIds, setAdminTicketScopeIds] = useState<string[]>([])
  const [adminInventoryScopeIds, setAdminInventoryScopeIds] = useState<string[]>([])
  const [adminPatrolScopeIds, setAdminPatrolScopeIds] = useState<string[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)
  const [familyError, setFamilyError] = useState<string | null>(null)
  const [technicianFamilyIds, setTechnicianFamilyIds] = useState<string[]>([])
  const [clientFamilyIds, setClientFamilyIds] = useState<string[]>([])
  const [inventoryFamilyIds, setInventoryFamilyIds] = useState<string[]>([])
  const [patrolFamilyIds, setPatrolFamilyIds] = useState<string[]>([])
  const [adminFamilyIds, setAdminFamilyIds] = useState<string[]>([])
  const [adminScopeIds, setAdminScopeIds] = useState<string[]>([])
  const [confirmUnassign, setConfirmUnassign] = useState<{
    familyId: string
    familyName: string
    activeTickets: number
  } | null>(null)
  const [pendingUnassignFamilyId, setPendingUnassignFamilyId] = useState<string | null>(null)

  const invalidateModulesCache = () => {
    if (!user) return
    void fetch(`/api/user/modules?userId=${user.id}&_t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    })
    window.dispatchEvent(new CustomEvent('modules-updated'))
  }

  const viewerIsAdminNormal =
    session?.user?.role === 'ADMIN' && !(session?.user as any)?.isSuperAdmin

  const ticketReadOnlyIds = (() => {
    if (!viewerIsAdminNormal || adminTicketScopeIds.length === 0) return []
    return allFamilies.map(f => f.id).filter(id => !adminTicketScopeIds.includes(id))
  })()

  const inventoryReadOnlyIds = (() => {
    if (!viewerIsAdminNormal || adminInventoryScopeIds.length === 0) return []
    return allFamilies.map(f => f.id).filter(id => !adminInventoryScopeIds.includes(id))
  })()

  const patrolReadOnlyIds = (() => {
    if (!viewerIsAdminNormal || adminPatrolScopeIds.length === 0) return []
    return allFamilies.map(f => f.id).filter(id => !adminPatrolScopeIds.includes(id))
  })()

  const adminScopeReadOnlyIds = [
    ...new Set([...ticketReadOnlyIds, ...inventoryReadOnlyIds, ...patrolReadOnlyIds]),
  ]

  const showApiError = (title: string, result: any, fallback?: string) => {
    toast({ title, description: extractApiError(result, fallback), variant: 'destructive' })
  }

  const showNetworkError = (err: unknown) => {
    toast({
      title: 'Error de conexión',
      description: extractCatchError(err),
      variant: 'destructive',
    })
  }

  const handleAssignTechnicianFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/technician`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al asignar familia')
      }
      setTechnicianFamilyIds(prev => [...prev, familyId])
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleUnassignTechnicianFamily = async (
    familyId: string
  ): Promise<{ requiresConfirmation?: boolean; activeTickets?: number } | void> => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/technician/${familyId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message ?? 'Error al desasignar familia')
      }
      if (data.requiresConfirmation) {
        const family = allFamilies.find(f => f.id === familyId)
        setPendingUnassignFamilyId(familyId)
        setConfirmUnassign({
          familyId,
          familyName: family?.name ?? familyId,
          activeTickets: data.activeTickets ?? 0,
        })
        return { requiresConfirmation: true, activeTickets: data.activeTickets }
      }
      setTechnicianFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleConfirmUnassignTechnician = async () => {
    if (!user || !pendingUnassignFamilyId) return
    const familyId = pendingUnassignFamilyId
    setConfirmUnassign(null)
    setPendingUnassignFamilyId(null)
    try {
      const res = await fetch(
        `/api/admin/users/${user.id}/families/technician/${familyId}?force=true`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        setFamilyError(data.message ?? 'Error al desasignar familia')
        return
      }
      setTechnicianFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch {
      setFamilyError('Error al desasignar familia')
    }
  }

  const handleAssignClientFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al asignar familia')
      }
      setClientFamilyIds(prev => [...prev, familyId])
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleUnassignClientFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/client/${familyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al desasignar familia')
      }
      setClientFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleAssignInventoryFamily = async (familyId: string) => {
    if (!user) return
    try {
      const newIds = [...inventoryFamilyIds, familyId]
      const res = await fetch(`/api/admin/users/${user.id}/families/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyIds: newIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al asignar familia')
      }
      setInventoryFamilyIds(newIds)
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleUnassignInventoryFamily = async (familyId: string) => {
    if (!user) return
    try {
      const newIds = inventoryFamilyIds.filter(id => id !== familyId)
      const res = await fetch(`/api/admin/users/${user.id}/families/inventory`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyIds: newIds }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al desasignar familia')
      }
      setInventoryFamilyIds(newIds)
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleAssignPatrolFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch('/api/patrol-family-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, familyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al asignar familia')
      }
      setPatrolFamilyIds(prev => [...prev, familyId])
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleUnassignPatrolFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(
        `/api/patrol-family-assignments?userId=${user.id}&familyId=${familyId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Error al desasignar familia')
      }
      setPatrolFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleAssignAdminFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ familyId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al asignar familia')
      }
      setAdminFamilyIds(prev => [...prev, familyId])
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  const handleUnassignAdminFamily = async (familyId: string) => {
    if (!user) return
    try {
      const res = await fetch(`/api/admin/users/${user.id}/families/admin/${familyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message ?? 'Error al desasignar familia')
      }
      setAdminFamilyIds(prev => prev.filter(id => id !== familyId))
      invalidateModulesCache()
    } catch (err) {
      showNetworkError(err)
    }
  }

  useEffect(() => {
    if (!user || !isOpen) return

    const fetchFamiliesAndAssignments = async () => {
      setLoadingFamilies(true)
      setFamilyError(null)
      try {
        const viewerIsSuperAdmin = (session?.user as any)?.isSuperAdmin === true

        // Para módulos de inventario y patrullas usamos scope=all para que la API
        // no filtre por el scope del admin viewer (que podría no tener asignaciones propias).
        // El filtro de módulo habilitado (inventoryEnabled/patrolsEnabled) sí se aplica.
        // Los fetches sin scope=all se usan para calcular el scope del viewer (readOnly locks).
        const [ticketModuleRes, inventoryModuleRes, patrolModuleRes, allRes] = await Promise.all([
          fetch('/api/families?includeInactive=false&module=tickets'),
          fetch('/api/families?includeInactive=false&module=inventory&scope=all'),
          fetch('/api/families?includeInactive=false&module=patrols&scope=all'),
          fetch('/api/families?includeInactive=false&scope=all'),
        ])

        const parseFamilies = async (res: Response) => {
          if (!res.ok) return [] as FamilyOption[]
          const data = await res.json()
          return ((data.data ?? []) as FamilyOption[]).filter(f => f.isActive)
        }

        const tModuleFamilies = await parseFamilies(ticketModuleRes)
        const iModuleFamilies = await parseFamilies(inventoryModuleRes)
        const pModuleFamilies = await parseFamilies(patrolModuleRes)
        const allActiveFamilies = await parseFamilies(allRes)

        setAllFamilies(allActiveFamilies)

        // Familia nativa del usuario siendo editado — debe estar siempre disponible
        const userNativeFamilyId =
          user && typeof user.department === 'object'
            ? ((user.department as any)?.familyId ?? null)
            : null

        /**
         * Garantiza que la familia nativa del usuario editado esté incluida
         * en la lista de familias disponibles, aunque esté fuera del scope del viewer.
         */
        const ensureNativeFamily = (list: FamilyOption[]): FamilyOption[] => {
          if (!userNativeFamilyId) return list
          const alreadyIn = list.some(f => f.id === userNativeFamilyId)
          if (alreadyIn) return list
          // Buscarla en cualquiera de las listas disponibles
          const nativeFamily =
            allActiveFamilies.find(f => f.id === userNativeFamilyId) ??
            tModuleFamilies.find(f => f.id === userNativeFamilyId) ??
            iModuleFamilies.find(f => f.id === userNativeFamilyId) ??
            pModuleFamilies.find(f => f.id === userNativeFamilyId)
          return nativeFamily ? [...list, nativeFamily] : list
        }

        if (viewerIsSuperAdmin) {
          setTicketFamilies(tModuleFamilies)
          setInventoryFamilies(iModuleFamilies)
          setPatrolFamilies(pModuleFamilies)
        } else {
          // Para Admin Normal: las listas de inventario y patrullas ya vienen sin filtro
          // de scope (scope=all), por lo que las usamos directamente asegurando que la
          // familia nativa del usuario editado esté incluida.
          // Para tickets sí mantenemos la intersección con el scope del viewer.
          const viewerTicketFamilies =
            tModuleFamilies.length > 0
              ? allActiveFamilies.filter(f => tModuleFamilies.some(t => t.id === f.id))
              : allActiveFamilies

          setTicketFamilies(ensureNativeFamily(viewerTicketFamilies))
          setInventoryFamilies(ensureNativeFamily(iModuleFamilies))
          setPatrolFamilies(ensureNativeFamily(pModuleFamilies))

          // Para los readOnly locks necesitamos el scope real del viewer (sin scope=all).
          // Hacemos fetches adicionales sin scope=all para obtener solo lo que el viewer puede asignar.
          const [viewerInvRes, viewerPatrolRes] = await Promise.all([
            fetch('/api/families?includeInactive=false&module=inventory'),
            fetch('/api/families?includeInactive=false&module=patrols'),
          ])
          const viewerInvFamilies = await parseFamilies(viewerInvRes)
          const viewerPatrolFamilies = await parseFamilies(viewerPatrolRes)

          setAdminTicketScopeIds(tModuleFamilies.map(f => f.id))
          setAdminInventoryScopeIds(viewerInvFamilies.map(f => f.id))
          setAdminPatrolScopeIds(viewerPatrolFamilies.map(f => f.id))
          setAdminScopeIds(tModuleFamilies.map(f => f.id))
        }

        const viewerIsAdmin = session?.user?.role === 'ADMIN' && !session?.user?.isSuperAdmin
        if (viewerIsAdmin && session?.user?.id) {
          const scopeRes = await fetch(`/api/admin/family-assignments?adminId=${session.user.id}`)
          if (scopeRes.ok) {
            const scopeData = await scopeRes.json()
            const scopeAssignments = scopeData.data ?? []
            setAdminScopeIds(scopeAssignments.map((a: any) => a.familyId))
          }
        }

        if (user.role === 'TECHNICIAN') {
          const res = await fetch(`/api/technician-family-assignments?technicianId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? data ?? []
            setTechnicianFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }

        if (user.role === 'CLIENT') {
          const res = await fetch(`/api/client-family-assignments?clientId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? data ?? []
            setClientFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }

        const invRes = await fetch(`/api/inventory/managers/${user.id}/families`)
        if (invRes.ok) {
          const data = await invRes.json()
          const families = data.families ?? data.data ?? data ?? []
          setInventoryFamilyIds(
            Array.isArray(families) ? families.map((f: any) => f.familyId ?? f.id) : []
          )
        }

        const patrolRes = await fetch(`/api/patrol-family-assignments?userId=${user.id}`)
        if (patrolRes.ok) {
          const data = await patrolRes.json()
          const assignments = data.data ?? []
          setPatrolFamilyIds(assignments.map((a: any) => a.familyId))
        }

        if (user.role === 'ADMIN' && !user.isSuperAdmin) {
          const res = await fetch(`/api/admin/family-assignments?adminId=${user.id}`)
          if (res.ok) {
            const data = await res.json()
            const assignments = data.data ?? []
            setAdminFamilyIds(assignments.map((a: any) => a.familyId))
          }
        }
      } catch (err) {
        setFamilyError('Error al cargar familias')
      } finally {
        setLoadingFamilies(false)
      }
    }

    void fetchFamiliesAndAssignments()
  }, [user, isOpen, session?.user?.id, session?.user?.role, session?.user?.isSuperAdmin])

  return {
    // Estados
    allFamilies,
    ticketFamilies,
    inventoryFamilies,
    patrolFamilies,
    technicianFamilyIds,
    clientFamilyIds,
    inventoryFamilyIds,
    patrolFamilyIds,
    adminFamilyIds,
    adminScopeIds,
    loadingFamilies,
    familyError,
    confirmUnassign,
    pendingUnassignFamilyId,

    // Read-only ids
    ticketReadOnlyIds,
    inventoryReadOnlyIds,
    patrolReadOnlyIds,
    adminScopeReadOnlyIds,

    // Handlers
    handleAssignTechnicianFamily,
    handleUnassignTechnicianFamily,
    handleConfirmUnassignTechnician,
    handleAssignClientFamily,
    handleUnassignClientFamily,
    handleAssignInventoryFamily,
    handleUnassignInventoryFamily,
    handleAssignPatrolFamily,
    handleUnassignPatrolFamily,
    handleAssignAdminFamily,
    handleUnassignAdminFamily,
    setConfirmUnassign,
    setPendingUnassignFamilyId,
  }
}
