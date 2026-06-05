'use client'

/**
 * Report Filters Component
 * Handles family selection and date range filtering
 */

import { Loader2, Crown } from 'lucide-react'
import { FamilyCombobox } from '@/components/ui/family-combobox'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Family } from './utils/report-types'

interface ReportFiltersProps {
  families: Family[]
  selectedFamilyId: string
  onFamilyChange: (familyId: string) => void
  selectedFamily: Family | null
  startDate: string
  onStartDateChange: (date: string) => void
  endDate: string
  onEndDateChange: (date: string) => void
  onClearDates: () => void
  loadingFamilies: boolean
  isSuperAdmin: boolean
}

export function ReportFilters({
  families,
  selectedFamilyId,
  onFamilyChange,
  selectedFamily,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onClearDates,
  loadingFamilies,
  isSuperAdmin,
}: ReportFiltersProps) {
  return (
    <Card>
      <CardContent className='py-4'>
        <div className='flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-4'>
          {/* Familia */}
          <div className='flex items-center gap-2 flex-1 min-w-[200px]'>
            <span className='text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0'>
              Familia:
            </span>
            {loadingFamilies ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <FamilyCombobox
                families={families.map(f => ({
                  id: f.id,
                  name: f.name,
                  code: f.code,
                  color: f.color,
                }))}
                value={selectedFamilyId}
                onValueChange={onFamilyChange}
                allowAll
                allowClear
                popoverWidth='260px'
                className='w-full sm:w-52'
                disabled={loadingFamilies}
              />
            )}
            {/* Badge de alcance */}
            {isSuperAdmin ? (
              <Badge className='bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 flex items-center gap-1 shrink-0'>
                <Crown className='h-3 w-3' />
                Vista global
              </Badge>
            ) : (
              <Badge variant='outline' className='text-muted-foreground shrink-0'>
                Tus familias
              </Badge>
            )}
          </div>

          <div className='w-full sm:w-px sm:h-6 bg-border hidden sm:block' />

          {/* Date range */}
          <div className='flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-2 flex-1'>
            <div className='flex items-center gap-2'>
              <Label className='text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0'>
                Desde:
              </Label>
              <Input
                type='date'
                value={startDate}
                onChange={e => onStartDateChange(e.target.value)}
                className='w-full sm:w-36 h-9 text-sm'
              />
            </div>
            <div className='flex items-center gap-2'>
              <Label className='text-sm font-medium text-muted-foreground whitespace-nowrap shrink-0'>
                Hasta:
              </Label>
              <Input
                type='date'
                value={endDate}
                onChange={e => onEndDateChange(e.target.value)}
                className='w-full sm:w-36 h-9 text-sm'
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant='ghost'
                size='sm'
                onClick={onClearDates}
                className='text-muted-foreground h-9'
              >
                Limpiar
              </Button>
            )}
          </div>

          {selectedFamily && (
            <div className='flex items-center gap-2 sm:ml-auto'>
              <span
                className='inline-block h-3 w-3 rounded-full flex-shrink-0'
                style={{ backgroundColor: selectedFamily.color ?? '#6B7280' }}
              />
              <span className='text-sm font-medium'>{selectedFamily.name}</span>
              <Badge variant='secondary' className='font-mono text-xs'>
                {selectedFamily.code}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
