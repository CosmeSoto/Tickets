'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { useSyncDashboardPageMeta } from '@/contexts/dashboard-shell-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { TechnicianSearchSelector } from '@/components/ui/technician-search-selector'
import { CategorySelectorWrapper } from '@/features/category-selection'
import { Layers, ArrowLeft, Save, X } from 'lucide-react'
import Link from 'next/link'
import { getTicketDisplayCode } from '@/hooks/use-ticket-data'
import { useToast } from '@/hooks/use-toast'
import { useTechnicians } from '@/contexts/users-context'
import { TicketSupportAreaField } from '@/components/tickets/ticket-support-area-field'
import { ticketRequestFamiliesUrl } from '@/lib/utils/ticket-family'

// ── Types ────────────────────────────────────────────────────────────────────

interface FamilyOption {
  id: string
  name: string
  code: string
  color?: string | null
  isOwnFamily?: boolean
}

interface TicketData {
  id: string
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  familyId?: string | null
  client: { id: string; name: string; email: string }
  assignee?: { id: string; name: string; email: string }
  category: { id: string; name: string; color: string }
  createdAt: string
  updatedAt: string
}

interface FormData {
  title: string
  description: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  categoryId: string
  assigneeId: string
  familyId: string
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EditTicketPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()

  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [familyTechnicians, setFamilyTechnicians] = useState<any[] | null>(null)

  // Familias disponibles para el selector
  const [availableFamilies, setAvailableFamilies] = useState<FamilyOption[]>([])
  const [loadingFamilies, setLoadingFamilies] = useState(false)

  // ✅ Técnicos desde contexto global — sin petición extra
  const { technicians } = useTechnicians()
  const displayTechnicians = familyTechnicians ?? technicians

  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    priority: 'MEDIUM',
    status: 'OPEN',
    categoryId: '',
    assigneeId: '',
    familyId: '',
  })

  // ── Carga de familias disponibles para el cliente del ticket ─────────────
  const loadFamiliesForClient = useCallback(async (clientId: string) => {
    setLoadingFamilies(true)
    try {
      const url = ticketRequestFamiliesUrl({
        forClientId: clientId,
      })

      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json()
        setAvailableFamilies(json.data ?? [])
      }
    } catch {
      // silencioso
    } finally {
      setLoadingFamilies(false)
    }
  }, [])

  // ── Carga técnicos al cambiar familia ────────────────────────────────────
  const loadTechniciansForFamily = useCallback(async (familyId: string) => {
    if (!familyId) return
    try {
      const res = await fetch(`/api/users?role=TECHNICIAN&isActive=true&familyId=${familyId}`)
      const d = await res.json()
      if (d.data) setFamilyTechnicians(d.data)
    } catch {
      // silencioso
    }
  }, [])

  // ── Auth + carga inicial ─────────────────────────────────────────────────
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/login')
      return
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/unauthorized')
      return
    }

    const loadTicket = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/tickets/${params.id}`)
        if (!response.ok) throw new Error('Error al cargar el ticket')

        const data = await response.json()
        if (data.success && data.data) {
          const t: TicketData = data.data
          setTicket(t)
          setFormData({
            title: t.title,
            description: t.description ?? '',
            priority: t.priority,
            status: t.status,
            categoryId: t.category.id,
            assigneeId: t.assignee?.id ?? '',
            familyId: t.familyId ?? '',
          })

          // Cargar familias disponibles para el cliente
          loadFamiliesForClient(t.client.id)

          // Cargar técnicos de la familia actual
          if (t.familyId) loadTechniciansForFamily(t.familyId)
        } else {
          throw new Error(data.message || 'Error al cargar el ticket')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        setError(msg)
        toast({ variant: 'destructive', title: 'Error', description: msg })
      } finally {
        setLoading(false)
      }
    }

    loadTicket()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router, params.id])

  // ── Guardar cambios ──────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/tickets/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (data.success) {
        toast({
          title: 'Ticket actualizado',
          description: 'Los cambios se han guardado exitosamente.',
        })
        router.push(`/admin/tickets/${params.id}`)
      } else {
        throw new Error(data.message || 'Error al actualizar el ticket')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      toast({ variant: 'destructive', title: 'Error al guardar', description: msg })
    } finally {
      setSaving(false)
    }
  }

  // ── Shell meta ───────────────────────────────────────────────────────────
  const headerActionsResolved = useMemo(() => {
    if (!ticket) return undefined
    return (
      <div className='flex items-center space-x-3'>
        <Button variant='outline' asChild>
          <Link href={`/admin/tickets/${params.id}`}>
            <X className='h-4 w-4 mr-2' />
            Cancelar
          </Link>
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className='h-4 w-4 mr-2' />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </div>
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket, params.id, saving])

  const shellMeta = useMemo(() => {
    if (status === 'loading' || loading)
      return { title: 'Editar Ticket', subtitle: 'Modificar información del ticket' }
    if (!session || session.user.role !== 'ADMIN') return { title: '', subtitle: '' }
    if (error || !ticket) return { title: 'Error', subtitle: 'No se pudo cargar el ticket' }
    return {
      title: `Editar Ticket #${getTicketDisplayCode(ticket)}`,
      subtitle: ticket.title,
      headerActions: headerActionsResolved,
    }
  }, [status, loading, session, error, ticket, headerActionsResolved])

  useSyncDashboardPageMeta(shellMeta)

  // ── Guardas de render ────────────────────────────────────────────────────
  if (status === 'loading' || loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary' />
      </div>
    )
  }

  if (!session || session.user.role !== 'ADMIN') return null

  if (error || !ticket) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <div className='text-center'>
            <div className='text-red-500 mb-2'>Error al cargar el ticket</div>
            <div className='text-muted-foreground text-sm mb-4'>{error}</div>
            <Button asChild>
              <Link href='/admin/tickets'>
                <ArrowLeft className='h-4 w-4 mr-2' />
                Volver a tickets
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      {/* ── Información básica ── */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
          <CardDescription>Modifica los datos principales del ticket</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label htmlFor='title'>Título</Label>
            <Input
              id='title'
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder='Título del ticket'
            />
          </div>
          <div>
            <Label htmlFor='description'>Descripción</Label>
            <Textarea
              id='description'
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder='Descripción detallada del problema'
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Estado y prioridad ── */}
      <Card>
        <CardHeader>
          <CardTitle>Estado y Prioridad</CardTitle>
          <CardDescription>Configura el estado actual y la prioridad del ticket</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <Label htmlFor='status'>Estado</Label>
              <select
                id='status'
                value={formData.status}
                onChange={e =>
                  setFormData(prev => ({ ...prev, status: e.target.value as FormData['status'] }))
                }
                className='w-full px-3 py-2 border border-border rounded-md'
              >
                <option value='OPEN'>Abierto</option>
                <option value='IN_PROGRESS'>En Progreso</option>
                <option value='RESOLVED'>Resuelto</option>
                <option value='CLOSED'>Cerrado</option>
              </select>
            </div>
            <div>
              <Label htmlFor='priority'>Prioridad</Label>
              <select
                id='priority'
                value={formData.priority}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    priority: e.target.value as FormData['priority'],
                  }))
                }
                className='w-full px-3 py-2 border border-border rounded-md'
              >
                <option value='LOW'>Baja</option>
                <option value='MEDIUM'>Media</option>
                <option value='HIGH'>Alta</option>
                <option value='URGENT'>Urgente</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Área de soporte ── */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Layers className='h-4 w-4' />
            Área de Soporte
          </CardTitle>
          <CardDescription>
            Redirige el ticket a otra área si es necesario. Cambiar el área puede limpiar la
            categoría y técnico asignado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TicketSupportAreaField
            families={availableFamilies}
            loading={loadingFamilies}
            value={formData.familyId}
            onValueChange={newFamilyId => {
              setFormData(prev => ({
                ...prev,
                familyId: newFamilyId,
                categoryId: newFamilyId !== prev.familyId ? '' : prev.categoryId,
                assigneeId: newFamilyId !== prev.familyId ? '' : prev.assigneeId,
              }))
              loadTechniciansForFamily(newFamilyId)
            }}
            emptyMessage='No hay áreas disponibles.'
            showNativeHint={false}
          />
          {formData.familyId && ticket && formData.familyId !== ticket.familyId && (
            <p className='text-xs text-amber-600 dark:text-amber-400 mt-2'>
              El área fue cambiada. La categoría y técnico asignado fueron reiniciados.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Asignación y categoría ── */}
      <Card>
        <CardHeader>
          <CardTitle>Asignación y Categoría</CardTitle>
          <CardDescription>Asigna el ticket a un técnico y selecciona la categoría</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div>
            <Label>Categoría</Label>
            <CategorySelectorWrapper
              value={formData.categoryId}
              onChange={categoryId =>
                setFormData(prev => ({ ...prev, categoryId: categoryId || '' }))
              }
              ticketTitle={formData.title}
              ticketDescription={formData.description}
              clientId={ticket.client.id}
              familyId={formData.familyId || undefined}
              requireFamily
            />
          </div>
          <div>
            <Label>Técnico Asignado</Label>
            <TechnicianSearchSelector
              technicians={displayTechnicians as any}
              value={formData.assigneeId}
              onChange={assigneeId =>
                setFormData(prev => ({ ...prev, assigneeId: assigneeId || '' }))
              }
              placeholder='Seleccionar técnico'
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Vista previa ── */}
      <Card>
        <CardHeader>
          <CardTitle>Vista Previa</CardTitle>
          <CardDescription>Cómo se verá el ticket después de los cambios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='flex items-center space-x-4'>
            <StatusBadge status={formData.status} />
            <PriorityBadge priority={formData.priority} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
