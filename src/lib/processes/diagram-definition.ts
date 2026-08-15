import { z } from 'zod'

/**
 * Contrato portable de diagramas. Se persiste como JSON para que el dump,
 * una restauración y futuros renderizadores conserven el mismo grafo.
 */
export const processDiagramDefinitionSchema = z.object({
  lanes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(120),
        order: z.number().int().min(0).max(1000).optional(),
      })
    )
    .min(1)
    .max(30),
  nodes: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        laneId: z.string().trim().min(1).max(80),
        label: z.string().trim().min(1).max(500),
        type: z
          .enum(['START', 'END', 'ACTIVITY', 'DECISION', 'DOCUMENT', 'EVENT'])
          .default('ACTIVITY'),
        order: z.number().int().min(0).max(10000).optional(),
      })
    )
    .min(1)
    .max(250),
  edges: z
    .array(
      z.object({
        from: z.string().trim().min(1).max(80),
        to: z.string().trim().min(1).max(80),
        label: z.string().trim().max(120).optional(),
      })
    )
    .max(500),
})

export type ProcessDiagramDefinition = z.infer<typeof processDiagramDefinitionSchema>

export function validateProcessDiagramDefinition(
  definition: unknown
): { success: true; data: ProcessDiagramDefinition } | { success: false; message: string } {
  const parsed = processDiagramDefinitionSchema.safeParse(definition)
  if (!parsed.success) {
    return {
      success: false,
      message: 'La definición del diagrama no tiene carriles, nodos o conexiones válidos.',
    }
  }

  const lanes = new Set(parsed.data.lanes.map(lane => lane.id))
  const nodes = new Set(parsed.data.nodes.map(node => node.id))
  const invalidLane = parsed.data.nodes.some(node => !lanes.has(node.laneId))
  const invalidEdge = parsed.data.edges.some(edge => !nodes.has(edge.from) || !nodes.has(edge.to))
  const selfLoop = parsed.data.edges.some(edge => edge.from === edge.to)
  const edgeKeys = new Set(
    parsed.data.edges.map(edge => `${edge.from}\u0000${edge.to}\u0000${edge.label || ''}`)
  )
  const repeatedLane = lanes.size !== parsed.data.lanes.length
  const repeatedNode = nodes.size !== parsed.data.nodes.length
  const repeatedEdge = edgeKeys.size !== parsed.data.edges.length

  if (repeatedLane)
    return { success: false, message: 'Los identificadores de los carriles deben ser únicos.' }
  if (invalidLane)
    return { success: false, message: 'Cada nodo debe pertenecer a un carril existente.' }
  if (invalidEdge)
    return { success: false, message: 'Cada conexión debe referenciar nodos existentes.' }
  if (repeatedNode)
    return { success: false, message: 'Los identificadores de los nodos deben ser únicos.' }
  if (selfLoop) return { success: false, message: 'Una conexión no puede apuntar al mismo nodo.' }
  if (repeatedEdge) return { success: false, message: 'No se permiten conexiones duplicadas.' }
  return { success: true, data: parsed.data }
}
