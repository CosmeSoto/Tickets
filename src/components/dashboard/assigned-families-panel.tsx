'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Layers, Package, Crown, Wrench, Ticket } from 'lucide-react'

interface FamilyModules {
  tickets?: boolean
  inventory?: boolean
}

interface Family {
  id: string
  name: string
  code: string
  color?: string | null
  icon?: string | null
  modules?: FamilyModules
}

interface AssignedFamiliesPanelProps {
  families: Family[]
  inventoryFamilies?: Family[]
  isSuperAdmin?: boolean
  isInventoryManager?: boolean
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

  // Unificar sin duplicados
  const allFamilyIds = new Set(families.map(f => f.id))
  const extraInventoryFamilies = (inventoryFamilies ?? []).filter(f => !allFamilyIds.has(f.id))

  // Separar familias por módulos activos
  const ticketFamilies = families.filter(f => f.modules?.tickets !== false)
  const inventoryOnlyFamilies = families.filter(
    f => f.modules?.tickets === false && f.modules?.inventory
  )
  const bothModules = families.filter(f => f.modules?.tickets && f.modules?.inventory)

  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='text-sm font-semibold flex items-center gap-2'>
          <Icon
            className={`h-4 w-4 ${isSuperAdmin ? 'text-amber-500' : 'text-muted-foreground'}`}
          />
          {config.title}
          {isSuperAdmin && (
            <Badge className='bg-amber-100 text-amber-700 border-amber-200 text-xs'>
              Super Admin
            </Badge>
          )}
          {isInventoryManager && !isSuperAdmin && (
            <Badge className='bg-primary/10 text-primary border-primary/20 text-xs flex items-center gap-1'>
              <Package className='h-2.5 w-2.5' />
              Gestor
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className='pt-0'>
        {isSuperAdmin ? (
          <p className='text-sm text-muted-foreground'>
            Tienes acceso total a todas las familias del sistema.
          </p>
        ) : (
          <div className='space-y-3'>
            {families.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {families.map(family => (
                  <FamilyChip
                    key={family.id}
                    family={family}
                    ticketsHref={`${config.ticketsHref}?familyId=${family.id}`}
                    inventoryHref={`${config.inventoryHref}?familyId=${family.id}`}
                  />
                ))}
              </div>
            )}

            {extraInventoryFamilies.length > 0 && (
              <div>
                <p className='text-xs text-muted-foreground mb-1.5 flex items-center gap-1'>
                  <Package className='h-3 w-3' /> Solo inventario
                </p>
                <div className='flex flex-wrap gap-2'>
                  {extraInventoryFamilies.map(family => (
                    <FamilyChip
                      key={family.id}
                      family={family}
                      ticketsHref={`${config.ticketsHref}?familyId=${family.id}`}
                      inventoryHref={`${config.inventoryHref}?familyId=${family.id}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {families.length === 0 && extraInventoryFamilies.length === 0 && (
              <p className='text-sm text-muted-foreground'>Sin familias asignadas aún.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function FamilyChip({
  family,
  ticketsHref,
  inventoryHref,
}: {
  family: Family
  ticketsHref: string
  inventoryHref: string
}) {
  const hasTickets = family.modules?.tickets !== false
  const hasInventory = family.modules?.inventory === true
  // Si solo tiene un módulo activo, el chip navega directo; si tiene ambos, va a tickets por defecto
  const href = hasTickets ? ticketsHref : inventoryHref

  return (
    <Link href={href}>
      <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80 cursor-pointer bg-muted border-border text-foreground hover:bg-accent'>
        {family.color && (
          <span
            className='inline-block h-2 w-2 rounded-full flex-shrink-0'
            style={{ backgroundColor: family.color }}
          />
        )}
        {family.name}
        <span className='opacity-50 font-mono text-[10px]'>{family.code}</span>
        {/* Badges de módulos activos */}
        {hasTickets && (
          <span
            className='inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 text-primary'
            title='Tickets habilitado'
          >
            <Ticket className='h-2 w-2' />
          </span>
        )}
        {hasInventory && (
          <span
            className='inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-primary/15 text-primary'
            title='Inventario habilitado'
          >
            <Package className='h-2 w-2' />
          </span>
        )}
      </span>
    </Link>
  )
}
