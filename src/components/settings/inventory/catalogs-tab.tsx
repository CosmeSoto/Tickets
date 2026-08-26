/**
 * Catalogs Tab Component
 * Gestión de tipos y atributos para Equipment, License, Consumable
 */

'use client'

import { useState, useEffect } from 'react'
import { Package, FileKey, Box, Tag } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TypeSection } from './type-section'
import { BrandSection } from './brand-section'
import { AttributeManagerDialog } from './attribute-manager-dialog'
import { TypeFormDialog } from './type-form-dialog'
import {
  useTypeManagement,
  type EquipmentType,
  type LicenseType,
  type ConsumableType,
  type AnyType,
  type TypeKind,
  type CreateTypeData,
} from '@/hooks/inventory/use-type-management'
import { useBrandManagement } from '@/hooks/inventory/use-brand-management'

// ── Types ──────────────────────────────────────────────────────────────────

interface CatalogsTabProps {
  familyId: string | null
  familyColor?: string | null
}

// ── Component ──────────────────────────────────────────────────────────────

export function CatalogsTab({ familyId, familyColor }: CatalogsTabProps) {
  // Hooks para cada tipo
  const equipmentTypes = useTypeManagement<EquipmentType>('equipment', familyId)
  const licenseTypes = useTypeManagement<LicenseType>('license', familyId)
  const consumableTypes = useTypeManagement<ConsumableType>('consumable', familyId)
  // Hook para Marcas
  const equipmentBrands = useBrandManagement({ familyId })

  // Efecto para cargar datos al montar el componente
  useEffect(() => {
    if (familyId) {
      equipmentTypes.loadTypes()
      licenseTypes.loadTypes()
      consumableTypes.loadTypes()
      equipmentBrands.loadBrands()
    }
  }, [familyId])

  // Handlers para Marcas
  const handleCreateBrand = async () => {
    await equipmentBrands.loadBrands()
  }

  const handleEditBrand = async (brand: any) => {
    await equipmentBrands.loadBrands()
  }

  const handleDeleteBrand = async (brandId: string) => {
    const success = await equipmentBrands.deleteBrand(brandId)
    if (success) {
      await equipmentBrands.loadBrands()
    }
  }

  const handleToggleBrandActive = async (brandId: string) => {
    await equipmentBrands.toggleActive(
      brandId,
      !equipmentBrands.brands.find(b => b.id === brandId)?.isActive
    )
  }

  // Estado para el diálogo de atributos
  const [attributeDialogOpen, setAttributeDialogOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<{
    kind: TypeKind
    type: AnyType
  } | null>(null)
  // true solo cuando el gestor de atributos se abre encadenado justo tras
  // crear un tipo nuevo: hace que salte directo al formulario de "Nuevo Atributo"
  const [attributeDialogAutoCreate, setAttributeDialogAutoCreate] = useState(false)

  // Estado para el diálogo de crear/editar tipo
  const [typeFormDialogOpen, setTypeFormDialogOpen] = useState(false)
  const [typeFormMode, setTypeFormMode] = useState<'create' | 'edit'>('create')
  const [typeFormKind, setTypeFormKind] = useState<TypeKind>('equipment')
  const [typeFormData, setTypeFormData] = useState<AnyType | null>(null)

  // Handlers para Equipment Types
  const handleCreateEquipmentType = () => {
    setTypeFormKind('equipment')
    setTypeFormMode('create')
    setTypeFormData(null)
    setTypeFormDialogOpen(true)
  }

  const handleEditEquipmentType = (type: EquipmentType) => {
    setTypeFormKind('equipment')
    setTypeFormMode('edit')
    setTypeFormData(type)
    setTypeFormDialogOpen(true)
  }

  const handleManageEquipmentAttributes = (type: EquipmentType) => {
    setSelectedType({ kind: 'equipment', type })
    setAttributeDialogAutoCreate(false)
    setAttributeDialogOpen(true)
  }

  // Handlers para License Types
  const handleCreateLicenseType = () => {
    setTypeFormKind('license')
    setTypeFormMode('create')
    setTypeFormData(null)
    setTypeFormDialogOpen(true)
  }

  const handleEditLicenseType = (type: LicenseType) => {
    setTypeFormKind('license')
    setTypeFormMode('edit')
    setTypeFormData(type)
    setTypeFormDialogOpen(true)
  }

  const handleManageLicenseAttributes = (type: LicenseType) => {
    setSelectedType({ kind: 'license', type })
    setAttributeDialogAutoCreate(false)
    setAttributeDialogOpen(true)
  }

  // Handlers para Consumable Types
  const handleCreateConsumableType = () => {
    setTypeFormKind('consumable')
    setTypeFormMode('create')
    setTypeFormData(null)
    setTypeFormDialogOpen(true)
  }

  const handleEditConsumableType = (type: ConsumableType) => {
    setTypeFormKind('consumable')
    setTypeFormMode('edit')
    setTypeFormData(type)
    setTypeFormDialogOpen(true)
  }

  const handleManageConsumableAttributes = (type: ConsumableType) => {
    setSelectedType({ kind: 'consumable', type })
    setAttributeDialogAutoCreate(false)
    setAttributeDialogOpen(true)
  }

  // Handler genérico para submit del formulario
  const handleTypeFormSubmit = async (data: CreateTypeData): Promise<boolean> => {
    if (typeFormMode === 'create') {
      // Crear nuevo tipo
      let result: AnyType | null = null
      if (typeFormKind === 'equipment') {
        result = await equipmentTypes.createType(data)
      } else if (typeFormKind === 'license') {
        result = await licenseTypes.createType(data)
      } else {
        result = await consumableTypes.createType(data)
      }

      if (result) {
        // Encadenar: al crear el tipo, abrir de inmediato su gestor de
        // atributos (y de ahí, directo al formulario de "Nuevo Atributo")
        // para no obligar al usuario a volver a buscar el ícono de engranaje.
        setSelectedType({ kind: typeFormKind, type: result })
        setAttributeDialogAutoCreate(true)
        setAttributeDialogOpen(true)
      }

      return result !== null
    } else {
      // Editar tipo existente
      if (!typeFormData) return false

      if (typeFormKind === 'equipment') {
        return await equipmentTypes.updateType(typeFormData.id, data)
      } else if (typeFormKind === 'license') {
        return await licenseTypes.updateType(typeFormData.id, data)
      } else {
        return await consumableTypes.updateType(typeFormData.id, data)
      }
    }
  }

  if (!familyId) {
    return (
      <Card>
        <CardContent className='flex flex-col items-center justify-center py-16 text-muted-foreground'>
          <Package className='h-12 w-12 mb-4 opacity-30' />
          <p className='text-base font-medium'>Selecciona un área</p>
          <p className='text-sm mt-1 text-center'>
            Elige un área de la lista para gestionar sus catálogos
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='space-y-6'>
      {/* Equipment Brands */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Tag className='h-5 w-5' />
            Marcas
          </CardTitle>
          <CardDescription>Catálogo de marcas de equipos (Dell, Apple, HP, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandSection
            brands={equipmentBrands.brands}
            loading={equipmentBrands.loading}
            saving={equipmentBrands.saving}
            familyId={familyId}
            familyColor={familyColor}
            onCreateBrand={handleCreateBrand}
            onEditBrand={handleEditBrand}
            onDeleteBrand={handleDeleteBrand}
            onToggleActive={handleToggleBrandActive}
            onReorder={equipmentBrands.reorderBrands}
            onCloneSuccess={() => equipmentBrands.loadBrands()}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Equipment Types */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Package className='h-5 w-5' />
            Equipos
          </CardTitle>
          <CardDescription>
            Tipos de equipos físicos (computadoras, impresoras, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TypeSection
            typeKind='equipment'
            types={equipmentTypes.types}
            loading={equipmentTypes.loading}
            saving={equipmentTypes.saving}
            familyColor={familyColor}
            currentFamilyId={familyId}
            onCreateType={handleCreateEquipmentType}
            onEditType={handleEditEquipmentType}
            onDeleteType={equipmentTypes.deleteType}
            onToggleActive={equipmentTypes.toggleActive}
            onManageAttributes={handleManageEquipmentAttributes}
            onReorder={equipmentTypes.reorderTypes}
            onCloneSuccess={() => {
              /* No recargar: el tipo se copia a OTRA familia */
            }}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* License Types */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <FileKey className='h-5 w-5' />
            Licencias
          </CardTitle>
          <CardDescription>Tipos de licencias y contratos de software</CardDescription>
        </CardHeader>
        <CardContent>
          <TypeSection
            typeKind='license'
            types={licenseTypes.types}
            loading={licenseTypes.loading}
            saving={licenseTypes.saving}
            familyColor={familyColor}
            currentFamilyId={familyId}
            onCreateType={handleCreateLicenseType}
            onEditType={handleEditLicenseType}
            onDeleteType={licenseTypes.deleteType}
            onToggleActive={licenseTypes.toggleActive}
            onManageAttributes={handleManageLicenseAttributes}
            onReorder={licenseTypes.reorderTypes}
            onCloneSuccess={() => {
              /* Tipo copiado a otra familia */
            }}
          />
        </CardContent>
      </Card>

      <Separator />

      {/* Consumable Types */}
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Box className='h-5 w-5' />
            Suministros
          </CardTitle>
          <CardDescription>Tipos de materiales y suministros (tóner, cables, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <TypeSection
            typeKind='consumable'
            types={consumableTypes.types}
            loading={consumableTypes.loading}
            saving={consumableTypes.saving}
            familyColor={familyColor}
            currentFamilyId={familyId}
            onCreateType={handleCreateConsumableType}
            onEditType={handleEditConsumableType}
            onDeleteType={consumableTypes.deleteType}
            onToggleActive={consumableTypes.toggleActive}
            onManageAttributes={handleManageConsumableAttributes}
            onReorder={consumableTypes.reorderTypes}
            onCloneSuccess={() => {
              /* Tipo copiado a otra familia */
            }}
          />
        </CardContent>
      </Card>

      {/* Attribute Manager Dialog */}
      {selectedType && (
        <AttributeManagerDialog
          open={attributeDialogOpen}
          onOpenChange={setAttributeDialogOpen}
          typeKind={selectedType.kind}
          typeId={selectedType.type.id}
          typeName={selectedType.type.name}
          familyColor={familyColor}
          autoOpenCreate={attributeDialogAutoCreate}
          onAttributesChange={() => {
            // Recargar los tipos para actualizar el contador de atributos
            if (selectedType.kind === 'equipment') {
              equipmentTypes.loadTypes()
            } else if (selectedType.kind === 'license') {
              licenseTypes.loadTypes()
            } else {
              consumableTypes.loadTypes()
            }
          }}
        />
      )}

      {/* Type Form Dialog */}
      <TypeFormDialog
        open={typeFormDialogOpen}
        onOpenChange={setTypeFormDialogOpen}
        typeKind={typeFormKind}
        mode={typeFormMode}
        initialData={typeFormData}
        onSubmit={handleTypeFormSubmit}
        saving={
          typeFormKind === 'equipment'
            ? equipmentTypes.saving
            : typeFormKind === 'license'
              ? licenseTypes.saving
              : consumableTypes.saving
        }
      />
    </div>
  )
}
