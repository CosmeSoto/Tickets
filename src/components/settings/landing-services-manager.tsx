'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'
import * as Icons from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { IconPicker } from '@/components/inventory/icon-picker'

interface Service {
  id: string
  icon: string
  iconColor: string
  title: string
  description: string
  order: number
  enabled: boolean
}

const colorOptions = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-100 text-blue-600' },
  { value: 'green', label: 'Verde', class: 'bg-green-100 text-green-600' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-100 text-orange-600' },
  { value: 'purple', label: 'Morado', class: 'bg-purple-100 text-purple-600' },
  { value: 'red', label: 'Rojo', class: 'bg-red-100 text-red-600' },
]

export function LandingServicesManager() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<Service | null>(null)
  const [formData, setFormData] = useState({
    icon: 'Wrench',
    iconColor: 'blue',
    title: '',
    description: '',
  })
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadServices()
  }, [])

  const loadServices = async () => {
    try {
      const response = await fetch('/api/admin/landing-page/services')
      if (response.ok) {
        const data = await response.json()
        setServices(data)
      }
    } catch (error) {
      console.error('Error loading services:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setEditingService(null)
    setFormData({
      icon: 'Wrench',
      iconColor: 'blue',
      title: '',
      description: '',
    })
    setDialogOpen(true)
  }

  const handleEdit = (service: Service) => {
    setEditingService(service)
    setFormData({
      icon: service.icon,
      iconColor: service.iconColor,
      title: service.title,
      description: service.description,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!formData.title || !formData.description) {
      toast({
        title: 'Error',
        description: 'Completa todos los campos',
        variant: 'destructive',
      })
      return
    }

    try {
      const url = editingService
        ? `/api/admin/landing-page/services/${editingService.id}`
        : '/api/admin/landing-page/services'
      
      const method = editingService ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: editingService ? 'Servicio actualizado' : 'Servicio creado',
        })
        setDialogOpen(false)
        loadServices()
      } else {
        throw new Error('Error al guardar')
      }
    } catch (error) {
      console.error('Error saving service:', error)
      toast({
        title: 'Error',
        description: 'Error al guardar el servicio',
        variant: 'destructive',
      })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/landing-page/services/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Servicio eliminado',
        })
        loadServices()
      }
    } catch (error) {
      console.error('Error deleting service:', error)
      toast({
        title: 'Error',
        description: 'Error al eliminar el servicio',
        variant: 'destructive',
      })
    } finally {
      setDeletingServiceId(null)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/landing-page/services/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (response.ok) {
        loadServices()
      }
    } catch (error) {
      console.error('Error toggling service:', error)
    }
  }

  const getIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName] || Icons.HelpCircle
    return Icon
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando servicios...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gestión de Servicios</CardTitle>
              <CardDescription>
                Administra los servicios mostrados en la página pública
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Servicio
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No hay servicios configurados
            </div>
          ) : (
            <div className="space-y-3">
              {services.map((service) => {
                const Icon = getIcon(service.icon)
                const colorClass = colorOptions.find((c) => c.value === service.iconColor)?.class || 'bg-blue-100 text-blue-600'

                return (
                  <div
                    key={service.id}
                    className="flex items-center space-x-4 p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                    
                    <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">{service.title}</h4>
                      <p className="text-xs text-muted-foreground truncate">{service.description}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(service)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingServiceId(service.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
            </DialogTitle>
            <DialogDescription>
              Configura los detalles del servicio
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <IconPicker
                value={formData.icon}
                onChange={(value) => setFormData({ ...formData, icon: value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Select
                value={formData.iconColor}
                onValueChange={(value) => setFormData({ ...formData, iconColor: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center">
                        <div className={`w-4 h-4 rounded mr-2 ${option.class}`}></div>
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Soporte Técnico"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del servicio"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingServiceId} onOpenChange={(open) => !open && setDeletingServiceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este servicio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El servicio será eliminado de la página pública.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingServiceId && handleDelete(deletingServiceId)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
