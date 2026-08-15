'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export type ProcessIndicator = {
  name: string
  formula: string
  unit: string
  dataSource: string
  frequency: string
  owner: string
}

export type ProcessProfile = {
  suppliers: string[]
  inputs: string[]
  outputs: string[]
  customers: string[]
  indicators: ProcessIndicator[]
}

export const emptyProcessProfile: ProcessProfile = {
  suppliers: [],
  inputs: [],
  outputs: [],
  customers: [],
  indicators: [],
}

const parseLines = (value: string) =>
  value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

export function profileFromContent(content: unknown): ProcessProfile {
  const value = content as { profile?: Partial<ProcessProfile> } | null
  return {
    suppliers: value?.profile?.suppliers || [],
    inputs: value?.profile?.inputs || [],
    outputs: value?.profile?.outputs || [],
    customers: value?.profile?.customers || [],
    indicators: value?.profile?.indicators || [],
  }
}

export function profileToContent(profile: ProcessProfile) {
  return { profile }
}

export function ProcessProfileEditor({
  value,
  onChange,
}: {
  value: ProcessProfile
  onChange: (value: ProcessProfile) => void
}) {
  const setList = (key: 'suppliers' | 'inputs' | 'outputs' | 'customers', raw: string) =>
    onChange({ ...value, [key]: parseLines(raw) })

  return (
    <div className='space-y-4 rounded-lg border p-4'>
      <div>
        <p className='font-medium'>Ficha de proceso (FR-MC-01)</p>
        <p className='text-xs text-muted-foreground'>
          Un elemento por línea. Describe las uniones reales entre proveedores, áreas y clientes.
        </p>
      </div>
      <div className='grid gap-3 sm:grid-cols-2'>
        {(
          [
            ['suppliers', 'Proveedores'],
            ['inputs', 'Entradas'],
            ['outputs', 'Salidas'],
            ['customers', 'Clientes'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className='space-y-1'>
            <Label>{label}</Label>
            <Textarea
              rows={3}
              value={value[key].join('\n')}
              onChange={event => setList(key, event.target.value)}
              placeholder='Un elemento por línea'
            />
          </div>
        ))}
      </div>
      <div className='space-y-2'>
        <Label>Indicadores</Label>
        {value.indicators.map((indicator, index) => (
          <div key={index} className='grid gap-2 rounded-md border p-2 sm:grid-cols-3'>
            {(
              [
                ['name', 'Indicador'],
                ['formula', 'Fórmula'],
                ['unit', 'Unidad'],
                ['dataSource', 'Origen de datos'],
                ['frequency', 'Frecuencia'],
                ['owner', 'Responsable'],
              ] as const
            ).map(([key, label]) => (
              <Input
                key={key}
                aria-label={label}
                placeholder={label}
                value={indicator[key]}
                onChange={event => {
                  const indicators = [...value.indicators]
                  indicators[index] = { ...indicator, [key]: event.target.value }
                  onChange({ ...value, indicators })
                }}
              />
            ))}
            <button
              type='button'
              className='text-left text-sm text-destructive'
              onClick={() =>
                onChange({ ...value, indicators: value.indicators.filter((_, i) => i !== index) })
              }
            >
              Eliminar indicador
            </button>
          </div>
        ))}
        <button
          type='button'
          className='text-sm font-medium text-primary'
          onClick={() =>
            onChange({
              ...value,
              indicators: [
                ...value.indicators,
                { name: '', formula: '', unit: '', dataSource: '', frequency: '', owner: '' },
              ],
            })
          }
        >
          Añadir indicador
        </button>
      </div>
    </div>
  )
}

function ProfileList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className='font-medium'>{title}</p>
      {items.length ? (
        <ul className='mt-1 list-inside list-disc text-sm text-muted-foreground'>
          {items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className='mt-1 text-sm text-muted-foreground'>Sin definir</p>
      )}
    </div>
  )
}

/** Lectura de la ficha FR-MC-01 en el detalle publicado. */
export function ProcessProfileView({ value }: { value: ProcessProfile }) {
  const hasContent =
    value.suppliers.length > 0 ||
    value.inputs.length > 0 ||
    value.outputs.length > 0 ||
    value.customers.length > 0 ||
    value.indicators.length > 0

  if (!hasContent) {
    return (
      <div className='rounded-lg border px-4 py-6 text-sm text-muted-foreground'>
        Este procedimiento aún no tiene ficha FR-MC-01 (SIPOC / indicadores).
      </div>
    )
  }

  return (
    <div className='space-y-4 rounded-lg border p-4'>
      <div>
        <p className='font-medium'>Ficha de proceso (FR-MC-01)</p>
        <p className='text-xs text-muted-foreground'>
          Proveedores, entradas, salidas, clientes e indicadores.
        </p>
      </div>
      <div className='grid gap-4 sm:grid-cols-2'>
        <ProfileList title='Proveedores' items={value.suppliers} />
        <ProfileList title='Entradas' items={value.inputs} />
        <ProfileList title='Salidas' items={value.outputs} />
        <ProfileList title='Clientes' items={value.customers} />
      </div>
      {value.indicators.length > 0 && (
        <div className='space-y-2'>
          <p className='font-medium'>Indicadores</p>
          <div className='overflow-x-auto'>
            <table className='w-full text-left text-sm'>
              <thead>
                <tr className='border-b text-muted-foreground'>
                  <th className='py-1 pr-2 font-medium'>Indicador</th>
                  <th className='py-1 pr-2 font-medium'>Fórmula</th>
                  <th className='py-1 pr-2 font-medium'>Unidad</th>
                  <th className='py-1 pr-2 font-medium'>Origen</th>
                  <th className='py-1 pr-2 font-medium'>Frecuencia</th>
                  <th className='py-1 font-medium'>Responsable</th>
                </tr>
              </thead>
              <tbody>
                {value.indicators.map((indicator, index) => (
                  <tr key={`${indicator.name}-${index}`} className='border-b last:border-0'>
                    <td className='py-1.5 pr-2'>{indicator.name || '—'}</td>
                    <td className='py-1.5 pr-2'>{indicator.formula || '—'}</td>
                    <td className='py-1.5 pr-2'>{indicator.unit || '—'}</td>
                    <td className='py-1.5 pr-2'>{indicator.dataSource || '—'}</td>
                    <td className='py-1.5 pr-2'>{indicator.frequency || '—'}</td>
                    <td className='py-1.5'>{indicator.owner || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
