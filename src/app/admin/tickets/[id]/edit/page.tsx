'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { RoleDashboardLayout } from '@/components/layout/role-dashboard-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge, PriorityBadge } from '@/components/ui/status-badge'
import { CategorySelector } from '@/components/ui/category-selector'
import { TechnicianSearchSelector } from '@/components/ui/technician-search-selector'
import { useToast } from '@/hooks/use-toast'
import { ArrowLeft, Save, X } from 'lucide-react'
import Link from 'next/link'

interface TicketData {
  id: string
  title: string
  description?: string
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  client: { id: string; name: string; email: string }
  assignee?: { id: string; name: string; email: string }
  category: { id: string; name: string; color: string }
  createdAt: string
  updatedAt: string
}

export default function EditTicketPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  
  const [ticket, setTicket] = useState<TicketData | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Form data
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as const,
    status: 'OPEN' as const,
    categoryId: '',
    assigneeId: ''
  })

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

    loadTicket()
    loadCategories()
    loadTechnicians()
  }, [session, status, router, params.id])

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const loadTechnicians = async () => {
    try {
      const response = await fetch('/api/users?role=TECHNICIAN')
      if (response.ok) {
        const data = await response.json()
        setTechnicians(data)
      }
    } catch (error) {
      console.error('Error loading technicians:', error)
    }
  }

  const loadTicket = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/tickets/${params.id}`)
      
      if (!response.ok) {
        throw new Error('Error al cargar el ticket')
      }

      const data = await response.json()
      
      if (data.success && data.data) {
        const ticketData = data.data
        setTicket(ticketData)
        setFormData({
          title: ticketData.title,
          description: ticketData.description || '',
          priority: ticketData.priority,
          status: ticketData.status,
          categoryId: ticketData.category.id,
          assigneeId: ticketData.assignee?.id || ''
        })
      } else {
        throw new Error(data.message || 'Error al cargar el ticket')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      setError(errorMessage)
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      
      const response = await fetch(`/api/tickets/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        throw new Error('Error al actualizar el ticket')
      }

      const data = await response.json()
      
      if (data.success) {
        toast({
          title: "Ticket actualizado",
          description: "Los cambios se han guardado exitosamente."
        })
        router.push(`/admin/tickets/${params.id}`)
      } else {
        throw new Error(data.message || 'Error al actualizar el ticket')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido'
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage
      })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <RoleDashboardLayout title='Editar Ticket' subtitle='Modificar información del ticket'>
        <div className='flex items-center justify-center h-64'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600'></div>
        </div>
      </RoleDashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  if (error || !ticket) {
    return (
      <RoleDashboardLayout title='Error' subtitle='No se pudo cargar el ticket'>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-red-500 mb-2">Error al cargar el ticket</div>
              <div className="text-muted-foreground text-sm mb-4">{error}</div>
              <Button asChild>
                <Link href="/admin/tickets">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Volver a tickets
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </RoleDashboardLayout>
    )
  }

  const headerActions = (
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

  return (
    <RoleDashboardLayout
      title={`Editar Ticket #${ticket.id.slice(-8)}`}
      subtitle={ticket.title}
      headerActions={headerActions}
    >
      <div className="space-y-6">
        {/* Información básica */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
            <CardDescription>
              Modifica los datos principales del ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Título del ticket"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descripción detallada del problema"
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Estado y prioridad */}
        <Card>
          <CardHeader>
            <CardTitle>Estado y Prioridad</CardTitle>
            <CardDescription>
              Configura el estado actual y la prioridad del ticket
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status">Estado</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    status: e.target.value as typeof formData.status 
                  }))}
                  className="w-full px-3 py-2 border border-border rounded-md"
                >
                  <option value="OPEN">Abierto</option>
                  <option value="IN_PROGRESS">En Progreso</option>
                  <option value="RESOLVED">Resuelto</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </div>
              
              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <select
                  id="priority"
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    priority: e.target.value as typeof formData.priority 
                  }))}
                  className="w-full px-3 py-2 border border-border rounded-md"
                >
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Asignación */}
        <Card>
          <CardHeader>
            <CardTitle>Asignación y Categoría</CardTitle>
            <CardDescription>
              Asigna el ticket a un técnico y selecciona la categoría
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Categoría</Label>
              <CategorySelector
                categories={categories}
                value={formData.categoryId}
                onChange={(categoryId) => setFormData(prev => ({ ...prev, categoryId: categoryId || '' }))}
                placeholder="Seleccionar categoría"
              />
            </div>
            
            <div>
              <Label>Técnico Asignado</Label>
              <TechnicianSearchSelector
                technicians={technicians}
                value={formData.assigneeId}
                onChange={(assigneeId) => setFormData(prev => ({ ...prev, assigneeId: assigneeId || '' }))}
                placeholder="Seleccionar técnico"
              />
            </div>
          </CardContent>
        </Card>

        {/* Vista previa del estado actual */}
        <Card>
          <CardHeader>
            <CardTitle>Vista Previa</CardTitle>
            <CardDescription>
              Cómo se verá el ticket después de los cambios
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <StatusBadge status={formData.status} />
              <PriorityBadge priority={formData.priority} />
            </div>
          </CardContent>
        </Card>
      </div>
    </RoleDashboardLayout>
  )
}