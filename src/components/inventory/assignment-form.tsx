'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, X } from 'lucide-react'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { createAssignmentSchema, type CreateAssignmentInput } from '@/lib/validations/inventory/assignment'
import type { AssignmentFormData } from '@/types/inventory/assignment'

interface AssignmentFormProps {
  equipmentId: string
  equipmentCode?: string
  defaultAccessories?: string[]
  onSuccess?: (assignment: any) => void
  onCancel?: () => void
}

interface User {
  id: string
  name: string
  email: string
  role: string
  department?: {
    name: string
  }
}

const ASSIGNMENT_TYPE_OPTIONS = [
  { value: 'PERMANENT', label: 'Permanente', description: 'Asignación sin fecha de fin' },
  { value: 'TEMPORARY', label: 'Temporal', description: 'Asignación con fecha de fin definida' },
  { value: 'LOAN', label: 'Préstamo', description: 'Préstamo temporal del equipo' },
]

export function AssignmentForm({
  equipmentId,
  equipmentCode,
  defaultAccessories = [],
  onSuccess,
  onCancel,
}: AssignmentFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [accessories, setAccessories] = useState<string[]>(defaultAccessories)
  const [newAccessory, setNewAccessory] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      equipmentId,
      assignmentType: 'PERMANENT',
      startDate: new Date(),
      accessories: defaultAccessories,
    },
  })

  const assignmentType = watch('assignmentType')
  const requiresEndDate = assignmentType === 'TEMPORARY' || assignmentType === 'LOAN'

  // Cargar usuarios disponibles
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoadingUsers(true)
        const response = await fetch('/api/users?role=CLIENT,TECHNICIAN')
        
        if (!response.ok) {
          throw new Error('Error al cargar usuarios')
        }

        const data = await response.json()
        setUsers(data.users || data)
      } catch (error) {
        console.error('Error cargando usuarios:', error)
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los usuarios',
          variant: 'destructive',
        })
      } finally {
        setLoadingUsers(false)
      }
    }

    fetchUsers()
  }, [toast])

  const onSubmit = async (data: any) => {
    try {
      setLoading(true)

      const payload: AssignmentFormData = {
        ...data,
        accessories,
      }

      const response = await fetch('/api/inventory/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Error al crear asignación')
      }

      const result = await response.json()

      toast({
        title: 'Asignación creada',
        description: `El equipo ${equipmentCode || equipmentId} ha sido asignado exitosamente`,
      })

      onSuccess?.(result)
    } catch (error) {
      console.error('Error creando asignación:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo crear la asignación',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const addAccessory = () => {
    if (newAccessory.trim()) {
      setAccessories([...accessories, newAccessory.trim()])
      setNewAccessory('')
    }
  }

  const removeAccessory = (index: number) => {
    setAccessories(accessories.filter((_, i) => i !== index))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Información de Asignación */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Asignación</CardTitle>
          <CardDescription>
            Selecciona el usuario y tipo de asignación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receiverId">
              Usuario Receptor <span className="text-destructive">*</span>
            </Label>
            {loadingUsers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando usuarios...
              </div>
            ) : (
              <Select
                value={watch('receiverId')}
                onValueChange={(value) => setValue('receiverId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex flex-col">
                        <span>{user.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.email}
                          {user.department && ` • ${user.department.name}`}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {errors.receiverId && (
              <p className="text-sm text-destructive">{errors.receiverId.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignmentType">
              Tipo de Asignación <span className="text-destructive">*</span>
            </Label>
            <Select
              value={watch('assignmentType')}
              onValueChange={(value) => setValue('assignmentType', value as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNMENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignmentType && (
              <p className="text-sm text-destructive">{errors.assignmentType.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Fechas */}
      <Card>
        <CardHeader>
          <CardTitle>Fechas</CardTitle>
          <CardDescription>
            Define el período de la asignación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Fecha de Inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                {...register('startDate')}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">
                Fecha de Fin {requiresEndDate && <span className="text-destructive">*</span>}
              </Label>
              <Input
                id="endDate"
                type="date"
                {...register('endDate')}
                disabled={!requiresEndDate}
              />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
              {requiresEndDate && (
                <p className="text-xs text-muted-foreground">
                  Requerida para asignaciones temporales y préstamos
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accesorios */}
      <Card>
        <CardHeader>
          <CardTitle>Accesorios</CardTitle>
          <CardDescription>
            Lista de accesorios incluidos en la asignación
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newAccessory}
              onChange={(e) => setNewAccessory(e.target.value)}
              placeholder="Ej: Cargador, Mouse, Cable HDMI"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addAccessory())}
            />
            <Button type="button" onClick={addAccessory} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {accessories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {accessories.map((accessory, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm"
                >
                  {accessory}
                  <button
                    type="button"
                    onClick={() => removeAccessory(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Observaciones */}
      <Card>
        <CardHeader>
          <CardTitle>Observaciones</CardTitle>
          <CardDescription>
            Notas adicionales sobre la asignación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            {...register('observations')}
            placeholder="Motivo de la asignación, condiciones especiales, etc..."
            rows={4}
          />
          {errors.observations && (
            <p className="mt-2 text-sm text-destructive">{errors.observations.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Botones */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={loading || loadingUsers}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Crear Asignación
        </Button>
      </div>
    </form>
  )
}
