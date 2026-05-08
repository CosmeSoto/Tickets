'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CustomFieldsManager } from '@/components/inventory/custom-fields/custom-fields-manager'

interface Family {
  id: string
  name: string
  code: string
  color?: string
}

interface InventoryCustomFieldsTabProps {
  families: Family[]
  selectedFamilyId: string
}

export function InventoryCustomFieldsTab({
  families,
  selectedFamilyId,
}: InventoryCustomFieldsTabProps) {
  return (
    <div className='space-y-6'>
      {/* Gestor de Campos Personalizados */}
      {selectedFamilyId ? (
        <Card>
          <CardHeader>
            <CardTitle>Campos Personalizados</CardTitle>
            <CardDescription>
              Define los atributos específicos que se mostrarán en el formulario de equipos de esta
              familia. Los campos se cargan según la familia seleccionada en el panel izquierdo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CustomFieldsManager familyId={selectedFamilyId} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className='py-8 text-center text-muted-foreground'>
            Selecciona una familia en el panel izquierdo para gestionar sus campos personalizados
          </CardContent>
        </Card>
      )}
    </div>
  )
}
