'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Package, Layers, List } from 'lucide-react'

interface InventoryTabsProps {
  modelView: React.ReactNode
  batchView: React.ReactNode
  allView: React.ReactNode
  defaultTab?: string
}

export function InventoryTabs({
  modelView,
  batchView,
  allView,
  defaultTab = 'models',
}: InventoryTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} className='w-full'>
      <TabsList className='grid w-full grid-cols-3'>
        <TabsTrigger value='models' className='flex items-center gap-2'>
          <Layers className='w-4 h-4' />
          Por Modelo
        </TabsTrigger>
        <TabsTrigger value='batches' className='flex items-center gap-2'>
          <Package className='w-4 h-4' />
          Por Lote
        </TabsTrigger>
        <TabsTrigger value='all' className='flex items-center gap-2'>
          <List className='w-4 h-4' />
          Todos
        </TabsTrigger>
      </TabsList>

      <TabsContent value='models' className='mt-6'>
        {modelView}
      </TabsContent>

      <TabsContent value='batches' className='mt-6'>
        {batchView}
      </TabsContent>

      <TabsContent value='all' className='mt-6'>
        {allView}
      </TabsContent>
    </Tabs>
  )
}
