'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomFieldsManager } from '@/components/inventory/custom-fields/custom-fields-manager'

interface Family {
  id: string
  name: string
  code: string
  color?: string
}

interface InventoryCustomFieldsTabProps {
  families: Family[]
}

export function InventoryCustomFieldsTab({ families }: InventoryCustomFieldsTabProps) {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string>(
    families.length > 0 ? families[0].id : ''
  )

  const familiesArray = Array.isArray(families) ? families : []

  return (
    <div className='space-y-6'>
      {/* Selector de Familia */}
      <Card>
        <CardHeader>
          <CardTitle>Seleccionar Familia</CardTitle>
          <CardDescription>
            Elige la familia de inventario para gestionar sus campos personalizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-2'>
            <Label htmlFor='family'>Familia de Inventario</Label>
            <Select value={selectedFamilyId} onValueChange={setSelectedFamilyId}>
              <SelectTrigger id='family'>
                <SelectValue placeholder='Selecciona una familia' />
              </SelectTrigger>
              <SelectContent>
                {familiesArray.length > 0 ? (
                  familiesArray.map(family => (
                    <SelectItem key={family.id} value={family.id}>
                      <div className='flex items-center gap-2'>
                        {family.color && (
                          <div
                            className='w-3 h-3 rounded-full'
                            style={{ backgroundColor: family.color }}
                          />
                        )}
                        <span>{family.name}</span>
                        <span className='text-xs text-muted-foreground'>({family.code})</span>
                      </div>
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value='none' disabled>
                    No hay familias disponibles
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Gestor de Campos Personalizados */}
      {selectedFamilyId && (
        <Card>
          <CardHeader>
            <CardTitle>Campos Personalizados</CardTitle>
            <CardDescription>
              Define los atributos específicos que se mostrarán en el formulario de equipos de esta
              familia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomFieldsManager familyId={selectedFamilyId} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
