/**
 * Sistema SIMPLIFICADO de asignación de categorías
 * Solo 3 niveles: Principal, Regular, Respaldo
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Shield, Users, Zap, AlertCircle, Search } from 'lucide-react'
import { CategorySelector } from '@/features/category-selection/components/CategorySelector'
import type { Category } from '@/types/technicians'

interface CategoryAssignment {
  categoryId: string
  priority: number
  maxTickets?: number
  autoAssign: boolean
}

interface Props {
  assignments: CategoryAssignment[]
  availableCategories: Category[]
  errors: Record<string, string>
  onAdd: () => void
  onRemove: (index: number) => void
  onUpdate: (index: number, field: string, value: any) => void
}

// Solo 3 niveles simples
const PRIORITY_LEVELS = {
  1: {
    label: 'Principal',
    icon: Shield,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    description: 'Recibe tickets primero',
    defaultMax: 15
  },
  2: {
    label: 'Regular',
    icon: Users,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    description: 'Recibe cuando Principal está ocupado',
    defaultMax: 10
  },
  3: {
    label: 'Respaldo',
    icon: Zap,
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    bgColor: 'bg-orange-50',
    description: 'Solo cuando todos están ocupados',
    defaultMax: 5
  }
}

export function SimpleCategoryAssignment({
  assignments,
  availableCategories,
  errors,
  onAdd,
  onRemove,
  onUpdate
}: Props) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [tempCategoryId, setTempCategoryId] = useState<string>('')

  const handleOpenSelector = (index: number) => {
    setEditingIndex(index)
    setTempCategoryId(assignments[index].categoryId)
  }

  const handleConfirmCategory = () => {
    if (editingIndex !== null && tempCategoryId) {
      onUpdate(editingIndex, 'categoryId', tempCategoryId)
      setEditingIndex(null)
      setTempCategoryId('')
    }
  }

  const handleCancelSelection = () => {
    setEditingIndex(null)
    setTempCategoryId('')
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Categorías de Trabajo</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona en qué categorías trabajará este técnico
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAdd}
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Categoría
            </Button>
          </div>
        </CardHeader>

        <CardContent>
        {assignments.length === 0 ? (
          <div className="text-center py-8 space-y-3 border-2 border-dashed rounded-lg">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No hay categorías asignadas
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Haz clic en "Agregar Categoría" para comenzar
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment, index) => {
              const level = PRIORITY_LEVELS[assignment.priority as keyof typeof PRIORITY_LEVELS] || PRIORITY_LEVELS[2]
              const Icon = level.icon
              const category = availableCategories.find(c => c.id === assignment.categoryId)

              return (
                <Card key={index} className="border-2">
                  <CardContent className="pt-4">
                    <div className="space-y-4">
                      {/* Header con categoría y eliminar */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {category && (
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: category.color }}
                            />
                          )}
                          <span className="font-medium">
                            {category?.name || 'Seleccionar categoría'}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemove(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Selector de categoría - Compacto con Modal */}
                      <div>
                        <Label className="text-xs font-medium mb-2 block">Categoría *</Label>
                        {assignment.categoryId ? (
                          // Mostrar categoría seleccionada de forma compacta
                          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center space-x-2 flex-1 min-w-0">
                              {category && (
                                <div 
                                  className="w-3 h-3 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: category.color }}
                                />
                              )}
                              <span className="text-sm font-medium truncate">
                                {category?.name || 'Categoría seleccionada'}
                              </span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenSelector(index)}
                              className="flex-shrink-0"
                            >
                              <Search className="h-4 w-4 mr-1" />
                              Cambiar
                            </Button>
                          </div>
                        ) : (
                          // Botón para abrir selector cuando no hay categoría
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-start text-muted-foreground border-dashed"
                            onClick={() => handleOpenSelector(index)}
                          >
                            <Search className="h-4 w-4 mr-2" />
                            Seleccionar categoría
                          </Button>
                        )}
                        {errors[`assignedCategories[${index}].categoryId`] && (
                          <p className="text-xs text-red-500 mt-1">
                            {errors[`assignedCategories[${index}].categoryId`]}
                          </p>
                        )}
                      </div>

                      {/* Nivel de prioridad - SIMPLE */}
                      <div>
                        <Label className="text-xs font-medium">Nivel de Prioridad *</Label>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          {Object.entries(PRIORITY_LEVELS).map(([priority, config]) => {
                            const isSelected = assignment.priority === parseInt(priority)
                            const LevelIcon = config.icon
                            
                            return (
                              <button
                                key={priority}
                                type="button"
                                onClick={() => {
                                  onUpdate(index, 'priority', parseInt(priority))
                                  // Auto-configurar maxTickets según el nivel
                                  if (!assignment.maxTickets) {
                                    onUpdate(index, 'maxTickets', config.defaultMax)
                                  }
                                }}
                                className={`
                                  p-3 rounded-lg border-2 transition-all text-left
                                  ${isSelected 
                                    ? `${config.bgColor} border-current ${config.textColor}` 
                                    : 'border-gray-200 hover:border-gray-300'
                                  }
                                `}
                              >
                                <div className="flex items-center space-x-2 mb-1">
                                  <LevelIcon className="h-4 w-4" />
                                  <span className="font-semibold text-sm">{config.label}</span>
                                </div>
                                <p className="text-xs opacity-75">{config.description}</p>
                                {isSelected && (
                                  <Badge className={`mt-2 ${config.color} text-white text-xs`}>
                                    Seleccionado
                                  </Badge>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {/* Configuración adicional */}
                      <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                        <div>
                          <Label className="text-xs font-medium">Máximo de Tickets</Label>
                          <Select
                            value={assignment.maxTickets?.toString() || 'unlimited'}
                            onValueChange={(value) => onUpdate(
                              index, 
                              'maxTickets', 
                              value === 'unlimited' ? undefined : parseInt(value)
                            )}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlimited">Sin límite</SelectItem>
                              <SelectItem value="5">5 tickets</SelectItem>
                              <SelectItem value="10">10 tickets</SelectItem>
                              <SelectItem value="15">15 tickets</SelectItem>
                              <SelectItem value="20">20 tickets</SelectItem>
                              <SelectItem value="30">30 tickets</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-end">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={assignment.autoAssign}
                              onCheckedChange={(checked) => onUpdate(index, 'autoAssign', checked)}
                            />
                            <Label className="text-xs cursor-pointer">
                              Asignación automática
                            </Label>
                          </div>
                        </div>
                      </div>

                      {/* Resumen visual */}
                      <div className={`p-3 rounded-lg ${level.bgColor}`}>
                        <p className={`text-xs ${level.textColor}`}>
                          {assignment.autoAssign ? (
                            <>
                              <strong>Nivel {level.label}:</strong> Recibirá tickets automáticamente
                              {assignment.maxTickets && <> (máximo {assignment.maxTickets} simultáneos)</>}
                            </>
                          ) : (
                            <>
                              <strong>Solo asignación manual:</strong> No recibirá tickets automáticamente
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {/* Leyenda explicativa */}
        {assignments.length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">¿Cómo funciona?</p>
            <div className="space-y-1">
              <div className="flex items-start space-x-2 text-xs text-muted-foreground">
                <Shield className="h-3 w-3 mt-0.5 text-blue-500" />
                <span><strong>Principal:</strong> Recibe todos los tickets primero hasta llegar a su límite</span>
              </div>
              <div className="flex items-start space-x-2 text-xs text-muted-foreground">
                <Users className="h-3 w-3 mt-0.5 text-green-500" />
                <span><strong>Regular:</strong> Recibe tickets cuando Principal está ocupado</span>
              </div>
              <div className="flex items-start space-x-2 text-xs text-muted-foreground">
                <Zap className="h-3 w-3 mt-0.5 text-orange-500" />
                <span><strong>Respaldo:</strong> Solo recibe cuando Principal y Regular están ocupados</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>

    {/* Modal para seleccionar categoría */}
    <Dialog open={editingIndex !== null} onOpenChange={(open) => !open && handleCancelSelection()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Seleccionar Categoría
          </DialogTitle>
          <DialogDescription>
            Busca y selecciona la categoría en la que trabajará el técnico
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <CategorySelector
            value={tempCategoryId}
            onChange={setTempCategoryId}
            clientId="admin"
            categories={availableCategories.map(cat => ({
              id: cat.id,
              name: cat.name,
              description: cat.description || '',
              parentId: cat.parentId || null,
              level: cat.level || 1,
              isActive: cat.isActive !== false,
              color: cat.color || '#6B7280'
            }))}
            ticketTitle=""
            ticketDescription=""
            showFrequentCategories={false}
            showSuggestions={false}
          />
        </div>
            ticketDescription=""
          />
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancelSelection}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmCategory}
            disabled={!tempCategoryId}
          >
            Confirmar Categoría
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </>
  )
}
