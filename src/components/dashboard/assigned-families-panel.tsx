'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, Package, Crown, Wrench } from 'lucide-react'

interface Family {
  id: string
  name: string
  code: string
  color?: string | null
  icon?: string | null
}

interface AssignedFamiliesPanelProps {
  /** Familias de tickets asignadas */
  families: Family[]
  /** Familias de inventario (gestores) */
  inventoryFamilies?: Family[]
  /** Si es Super Admin (ve todas) */
  isSuperAdmin?: boolean
  /** Si es gestor de inventario */
  isInventoryManager?: boolean
  /** Rol del usuario */
  role: 'ADMIN' | 'TECHNICIAN' | 'CLIENT'
}

export function AssignedFamiliesPanel({
  families,
  inventoryFamilies,
  isSuperAdmin,
  isInventoryManager,
  role,
}: AssignedFamiliesPanelProps) {
  if (!families?.length && !inventoryFamilies?.length && !isSuperAdmin) return null

  const roleConfig = {
    ADMIN: {
      title: isSuperAdmin ? 'Acceso Global' : 'Mis Familias Asignadas',
      icon: isSuperAdmin ? Crown : Layers,
      ticketsHref: '/admin/tickets',
      inventoryHref: '/inventory',
    },
    TECHNICIAN: {
      title: 'Mis Familias de Trabajo',
      icon: Wrench,
      ticketsHref: '/technician/tickets',
      inventoryHref: '/inventory',
    },
    CLIENT: {
      title: isInventoryManager ? 'Mis Familias' : 'Áreas de Soporte',
      icon: Layers,
      ticketsHref: '/client/tickets',
      inventoryHref: '/inventory',
    },
  }

  const config = roleConfig[role]
  const Icon = config.icon

  // Unificar familias de tickets e inventario sin duplicados
  const allFamilyIds = new Set(families.map(f => f.id))
  const extraInventoryFamilies = (inventoryFamilies ?? []).filter(f => !allFamilyIds.has(f.id))

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className={`h-4 w-4 ${isSuperAdmin ? 'text-amber-500' : 'text-muted-foreground'}`} />
          {config.title}
          {isSuperAdmin && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
              Super Admin
            </Badge>
          )}
          {isInventoryManager && !isSuperAdmin && (
            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs flex items-center gap-1">
              <Package className="h-2.5 w-2.5" />
              Gestor
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isSuperAdmin ? (
          <p className="text-sm text-muted-foreground">
            Tienes acceso total a todas las familias del sistema.
          </p>
        ) : (
          <div className="space-y-3">
            {/* Familias de tickets */}
            {families.length > 0 && (
              <div>
                {(role === 'TECHNICIAN' || (isInventoryManager && extraInventoryFamilies.length > 0)) && (
                  <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Wrench className="h-3 w-3" /> Tickets
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {families.map(family => (
                    <FamilyChip key={family.id} family={family} href={`${config.ticketsHref}?familyId=${family.id}`} />
                  ))}
                </div>
              </div>
            )}

            {/* Familias de inventario adicionales */}
            {extraInventoryFamilies.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Package className="h-3 w-3" /> Inventario
                </p>
                <div className="flex flex-wrap gap-2">
                  {extraInventoryFamilies.map(family => (
                    <FamilyChip key={family.id} family={family} href={`${config.inventoryHref}?familyId=${family.id}`} variant="inventory" />
                  ))}
                </div>
              </div>
            )}

            {families.length === 0 && extraInventoryFamilies.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin familias asignadas aún.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FamilyChip({ family, href, variant = 'default' }: { family: Family; href: string; variant?: 'default' | 'inventory' }) {
  return (
    <Link href={href}>
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer ${
          variant === 'inventory'
            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400'
            : 'bg-muted border-border text-foreground hover:bg-accent'
        }`}
      >
        {family.color && (
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: family.color }}
          />
        )}
        {family.name}
        <span className="opacity-50 font-mono text-[10px]">{family.code}</span>
      </span>
    </Link>
  )
}
