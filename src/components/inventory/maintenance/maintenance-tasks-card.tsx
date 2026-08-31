'use client'

/**
 * Checklist de pasos marcables dentro de un mantenimiento — ej. "Limpieza",
 * "Cambio de pasta térmica", "Prueba final". Puramente organizativo: no
 * condiciona el flujo de estados del mantenimiento ni bloquea "Completar".
 *
 * A diferencia de AcquisitionInvoicesCard (que sirve 2 tipos de activo y
 * necesita un diálogo con ~8 campos), acá cada ítem es solo texto corto, así
 * que todo es inline — sin modal: input "+ Agregar tarea", checkbox por
 * fila, ↑/↓ para reordenar (sin drag-and-drop — no hay librería de DnD en
 * el proyecto y no hace falta para listas cortas), ✕ para eliminar.
 */

import { useEffect, useState, useCallback } from 'react'
import { ListChecks, Plus, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { inventoryToast as toast } from '@/lib/utils/inventory-toast'

interface MaintenanceTask {
  id: string
  description: string
  order: number
  isCompleted: boolean
  completedAt: string | null
  completedBy: { id: string; name: string } | null
}

interface MaintenanceTasksCardProps {
  maintenanceId: string
  /** ADMIN/TECHNICIAN con acceso al equipo — puede agregar/marcar/reordenar/eliminar. */
  canManage: boolean
}

export function MaintenanceTasksCard({ maintenanceId, canManage }: MaintenanceTasksCardProps) {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/inventory/maintenance/${maintenanceId}/tasks`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setTasks(data.tasks ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [maintenanceId])

  useEffect(() => {
    load()
  }, [load])

  // No mostrar el bloque vacío a quien no puede gestionar (cliente sin tareas aún).
  if (!loading && tasks.length === 0 && !canManage) return null

  const completedCount = tasks.filter(t => t.isCompleted).length
  const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0

  const handleAdd = async () => {
    const description = newText.trim()
    if (!description) return
    setAdding(true)
    try {
      const res = await fetch(`/api/inventory/maintenance/${maintenanceId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar la tarea')
      setTasks(prev => [...prev, data])
      setNewText('')
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handleToggle = async (task: MaintenanceTask) => {
    setBusyId(task.id)
    const nextCompleted = !task.isCompleted
    setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, isCompleted: nextCompleted } : t)))
    try {
      const res = await fetch(`/api/inventory/maintenance/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: nextCompleted }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar la tarea')
      const data = await res.json()
      setTasks(prev => prev.map(t => (t.id === task.id ? data : t)))
    } catch (e) {
      setTasks(prev =>
        prev.map(t => (t.id === task.id ? { ...t, isCompleted: task.isCompleted } : t))
      )
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/inventory/maintenance/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ move: direction }),
      })
      if (!res.ok) throw new Error('No se pudo reordenar')
      await load()
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      const res = await fetch(`/api/inventory/maintenance/tasks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('No se pudo eliminar la tarea')
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Card>
      <CardHeader className='pb-3'>
        <div className='flex items-center justify-between gap-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <ListChecks className='h-5 w-5' /> Checklist
          </CardTitle>
          {tasks.length > 0 && (
            <span className='text-xs text-muted-foreground whitespace-nowrap'>
              {completedCount}/{tasks.length} completadas
            </span>
          )}
        </div>
        {tasks.length > 0 && <Progress value={progressPct} className='h-1.5 mt-2' />}
      </CardHeader>
      <CardContent className='space-y-2'>
        {loading ? (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : tasks.length === 0 ? (
          <p className='text-sm text-muted-foreground py-2'>
            {canManage
              ? 'Sin tareas todavía — agrega los pasos a seguir.'
              : 'Sin tareas registradas.'}
          </p>
        ) : (
          <ul className='space-y-1'>
            {tasks.map((task, i) => (
              <li
                key={task.id}
                className='flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors'
              >
                <Checkbox
                  checked={task.isCompleted}
                  disabled={!canManage || busyId === task.id}
                  onCheckedChange={() => handleToggle(task)}
                />
                <span
                  className={`flex-1 text-sm ${task.isCompleted ? 'line-through text-muted-foreground' : ''}`}
                >
                  {task.description}
                </span>
                {canManage && (
                  <div className='flex items-center gap-0.5 shrink-0'>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      disabled={i === 0 || busyId === task.id}
                      onClick={() => handleMove(task.id, 'up')}
                      title='Subir'
                    >
                      <ChevronUp className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6'
                      disabled={i === tasks.length - 1 || busyId === task.id}
                      onClick={() => handleMove(task.id, 'down')}
                      title='Bajar'
                    >
                      <ChevronDown className='h-3.5 w-3.5' />
                    </Button>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon'
                      className='h-6 w-6 text-muted-foreground hover:text-destructive'
                      disabled={busyId === task.id}
                      onClick={() => handleDelete(task.id)}
                      title='Eliminar'
                    >
                      <X className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <div className='flex items-center gap-2 pt-2'>
            <Input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAdd()
                }
              }}
              placeholder='Agregar tarea...'
              maxLength={300}
              className='h-8 text-sm'
              disabled={adding}
            />
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='h-8 shrink-0'
              onClick={handleAdd}
              disabled={adding || !newText.trim()}
            >
              {adding ? (
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Plus className='h-3.5 w-3.5' />
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
