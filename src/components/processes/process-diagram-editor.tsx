'use client'

import { useMemo } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { ProcessDiagramDefinition } from '@/lib/processes/diagram-definition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type EditableProcessDiagram = {
  type: 'SWIMLANE' | 'SEQUENCE'
  name: string
  definition: ProcessDiagramDefinition
}

type ProcessDiagramEditorProps = {
  value: EditableProcessDiagram[]
  onChange: (value: EditableProcessDiagram[]) => void
}

const NODE_TYPES = ['START', 'ACTIVITY', 'DECISION', 'DOCUMENT', 'EVENT', 'END'] as const

function emptyDiagram(): EditableProcessDiagram {
  return {
    type: 'SWIMLANE',
    name: 'Flujo principal',
    definition: {
      lanes: [
        { id: 'lane-1', label: 'Área / Rol 1', order: 0 },
        { id: 'lane-2', label: 'Área / Rol 2', order: 1 },
      ],
      nodes: [
        { id: 'n1', laneId: 'lane-1', label: 'Inicio', type: 'START', order: 0 },
        { id: 'n2', laneId: 'lane-1', label: 'Actividad', type: 'ACTIVITY', order: 1 },
        { id: 'n3', laneId: 'lane-2', label: 'Fin', type: 'END', order: 2 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
    },
  }
}

export function ProcessDiagramEditor({ value, onChange }: ProcessDiagramEditorProps) {
  const diagrams = value.length ? value : []

  const updateDiagram = (index: number, next: EditableProcessDiagram) => {
    const copy = [...diagrams]
    copy[index] = next
    onChange(copy)
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between gap-2'>
        <Label>Diagramas del procedimiento</Label>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => onChange([...diagrams, emptyDiagram()])}
        >
          <Plus className='mr-1 h-3.5 w-3.5' />
          Añadir diagrama
        </Button>
      </div>

      {!diagrams.length && (
        <p className='rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground'>
          Sin diagramas. Puedes guardar el procedimiento y agregarlos después, o crear uno ahora.
        </p>
      )}

      {diagrams.map((diagram, diagramIndex) => (
        <DiagramCard
          key={`diagram-${diagramIndex}`}
          diagram={diagram}
          onChange={next => updateDiagram(diagramIndex, next)}
          onRemove={() => onChange(diagrams.filter((_, i) => i !== diagramIndex))}
        />
      ))}
    </div>
  )
}

function DiagramCard({
  diagram,
  onChange,
  onRemove,
}: {
  diagram: EditableProcessDiagram
  onChange: (value: EditableProcessDiagram) => void
  onRemove: () => void
}) {
  const laneOptions = useMemo(
    () => diagram.definition.lanes.map(lane => ({ id: lane.id, label: lane.label })),
    [diagram.definition.lanes]
  )
  const nodeOptions = useMemo(
    () => diagram.definition.nodes.map(node => ({ id: node.id, label: node.label })),
    [diagram.definition.nodes]
  )

  const setDefinition = (definition: ProcessDiagramDefinition) =>
    onChange({ ...diagram, definition })

  return (
    <div className='space-y-4 rounded-lg border p-3'>
      <div className='flex flex-wrap items-end gap-3'>
        <div className='min-w-[180px] flex-1 space-y-1'>
          <Label>Nombre</Label>
          <Input
            value={diagram.name}
            onChange={event => onChange({ ...diagram, name: event.target.value })}
          />
        </div>
        <div className='w-44 space-y-1'>
          <Label>Tipo</Label>
          <Select
            value={diagram.type}
            onValueChange={value =>
              onChange({ ...diagram, type: value as EditableProcessDiagram['type'] })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='SWIMLANE'>Swimlane</SelectItem>
              <SelectItem value='SEQUENCE'>Secuencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type='button' size='icon' variant='ghost' onClick={onRemove}>
          <Trash2 className='h-4 w-4' />
        </Button>
      </div>

      <section className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label>Carriles / actores</Label>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => {
              const id = `lane-${Date.now()}`
              setDefinition({
                ...diagram.definition,
                lanes: [
                  ...diagram.definition.lanes,
                  {
                    id,
                    label: `Carril ${diagram.definition.lanes.length + 1}`,
                    order: diagram.definition.lanes.length,
                  },
                ],
              })
            }}
          >
            <Plus className='mr-1 h-3.5 w-3.5' />
            Carril
          </Button>
        </div>
        {diagram.definition.lanes.map((lane, index) => (
          <div key={lane.id} className='flex gap-2'>
            <Input
              value={lane.label}
              onChange={event => {
                const lanes = [...diagram.definition.lanes]
                lanes[index] = { ...lane, label: event.target.value }
                setDefinition({ ...diagram.definition, lanes })
              }}
            />
            <Button
              type='button'
              size='icon'
              variant='ghost'
              disabled={diagram.definition.lanes.length <= 1}
              onClick={() => {
                const removedNodeIds = new Set(
                  diagram.definition.nodes
                    .filter(node => node.laneId === lane.id)
                    .map(node => node.id)
                )
                setDefinition({
                  ...diagram.definition,
                  lanes: diagram.definition.lanes.filter((_, i) => i !== index),
                  nodes: diagram.definition.nodes.filter(node => node.laneId !== lane.id),
                  edges: diagram.definition.edges.filter(
                    edge => !removedNodeIds.has(edge.from) && !removedNodeIds.has(edge.to)
                  ),
                })
              }}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        ))}
      </section>

      <section className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label>Nodos</Label>
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => {
              const id = `n-${Date.now()}`
              const laneId = diagram.definition.lanes[0]?.id
              if (!laneId) return
              setDefinition({
                ...diagram.definition,
                nodes: [
                  ...diagram.definition.nodes,
                  {
                    id,
                    laneId,
                    label: 'Nueva actividad',
                    type: 'ACTIVITY',
                    order: diagram.definition.nodes.length,
                  },
                ],
              })
            }}
          >
            <Plus className='mr-1 h-3.5 w-3.5' />
            Nodo
          </Button>
        </div>
        {diagram.definition.nodes.map((node, index) => (
          <div key={node.id} className='grid gap-2 rounded-md border p-2 sm:grid-cols-4'>
            <Input
              value={node.label}
              onChange={event => {
                const nodes = [...diagram.definition.nodes]
                nodes[index] = { ...node, label: event.target.value }
                setDefinition({ ...diagram.definition, nodes })
              }}
              placeholder='Etiqueta'
            />
            <Select
              value={node.type}
              onValueChange={value => {
                const nodes = [...diagram.definition.nodes]
                nodes[index] = { ...node, type: value as (typeof NODE_TYPES)[number] }
                setDefinition({ ...diagram.definition, nodes })
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NODE_TYPES.map(type => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={node.laneId}
              onValueChange={value => {
                const nodes = [...diagram.definition.nodes]
                nodes[index] = { ...node, laneId: value }
                setDefinition({ ...diagram.definition, nodes })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Carril' />
              </SelectTrigger>
              <SelectContent>
                {laneOptions.map(lane => (
                  <SelectItem key={lane.id} value={lane.id}>
                    {lane.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className='flex gap-2'>
              <Input
                type='number'
                min={0}
                value={node.order ?? index}
                onChange={event => {
                  const nodes = [...diagram.definition.nodes]
                  nodes[index] = { ...node, order: Number(event.target.value) || 0 }
                  setDefinition({ ...diagram.definition, nodes })
                }}
              />
              <Button
                type='button'
                size='icon'
                variant='ghost'
                onClick={() =>
                  setDefinition({
                    ...diagram.definition,
                    nodes: diagram.definition.nodes.filter((_, i) => i !== index),
                    edges: diagram.definition.edges.filter(
                      edge => edge.from !== node.id && edge.to !== node.id
                    ),
                  })
                }
              >
                <Trash2 className='h-3.5 w-3.5' />
              </Button>
            </div>
          </div>
        ))}
      </section>

      <section className='space-y-2'>
        <div className='flex items-center justify-between'>
          <Label>Conexiones</Label>
          <Button
            type='button'
            size='sm'
            variant='outline'
            disabled={diagram.definition.nodes.length < 2}
            onClick={() => {
              const [from, to] = diagram.definition.nodes
              if (!from || !to) return
              setDefinition({
                ...diagram.definition,
                edges: [...diagram.definition.edges, { from: from.id, to: to.id }],
              })
            }}
          >
            <Plus className='mr-1 h-3.5 w-3.5' />
            Conexión
          </Button>
        </div>
        {diagram.definition.edges.map((edge, index) => (
          <div key={`${edge.from}-${edge.to}-${index}`} className='grid gap-2 sm:grid-cols-4'>
            <Select
              value={edge.from}
              onValueChange={value => {
                const edges = [...diagram.definition.edges]
                edges[index] = { ...edge, from: value }
                setDefinition({ ...diagram.definition, edges })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Desde' />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map(node => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={edge.to}
              onValueChange={value => {
                const edges = [...diagram.definition.edges]
                edges[index] = { ...edge, to: value }
                setDefinition({ ...diagram.definition, edges })
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder='Hacia' />
              </SelectTrigger>
              <SelectContent>
                {nodeOptions.map(node => (
                  <SelectItem key={node.id} value={node.id}>
                    {node.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={edge.label || ''}
              placeholder='Etiqueta (Sí/No…)'
              onChange={event => {
                const edges = [...diagram.definition.edges]
                edges[index] = { ...edge, label: event.target.value || undefined }
                setDefinition({ ...diagram.definition, edges })
              }}
            />
            <Button
              type='button'
              size='icon'
              variant='ghost'
              onClick={() =>
                setDefinition({
                  ...diagram.definition,
                  edges: diagram.definition.edges.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </div>
        ))}
      </section>
    </div>
  )
}

export function diagramsFromProcess(
  diagrams: Array<{ type: 'SWIMLANE' | 'SEQUENCE'; name: string; definition: unknown }>
): EditableProcessDiagram[] {
  return diagrams.flatMap(diagram => {
    const parsed = diagram.definition as ProcessDiagramDefinition
    if (!parsed?.lanes || !parsed?.nodes) return []
    return [
      {
        type: diagram.type,
        name: diagram.name,
        definition: {
          lanes: parsed.lanes,
          nodes: parsed.nodes,
          edges: parsed.edges || [],
        },
      },
    ]
  })
}
