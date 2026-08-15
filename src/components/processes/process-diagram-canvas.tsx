import type { ProcessDiagramDefinition } from '@/lib/processes/diagram-definition'

type ProcessDiagramCanvasProps = {
  definition: ProcessDiagramDefinition
  type?: 'SWIMLANE' | 'SEQUENCE'
  title?: string
}

const NODE_WIDTH = 164
const NODE_HEIGHT = 58
const LANE_WIDTH = 180
const STEP_WIDTH = 210
const LANE_HEIGHT = 120

export function ProcessDiagramCanvas({
  definition,
  type = 'SWIMLANE',
  title,
}: ProcessDiagramCanvasProps) {
  const lanes = [...definition.lanes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const nodes = [...definition.nodes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  if (type === 'SEQUENCE') {
    return (
      <ProcessSequenceCanvas lanes={lanes} nodes={nodes} edges={definition.edges} title={title} />
    )
  }
  const maxOrder = Math.max(...nodes.map(node => node.order ?? 0), 0)
  const width = LANE_WIDTH + (maxOrder + 1) * STEP_WIDTH + 40
  const height = lanes.length * LANE_HEIGHT + 20

  const nodePosition = new Map(
    nodes.map(node => {
      const laneIndex = Math.max(
        0,
        lanes.findIndex(lane => lane.id === node.laneId)
      )
      const order = node.order ?? 0
      return [
        node.id,
        {
          x: LANE_WIDTH + order * STEP_WIDTH + 22,
          y: laneIndex * LANE_HEIGHT + (LANE_HEIGHT - NODE_HEIGHT) / 2 + 10,
        },
      ]
    })
  )

  return (
    <section className='overflow-x-auto rounded-lg border bg-background'>
      {title && <p className='border-b px-4 py-3 text-sm font-medium'>{title}</p>}
      <svg
        className='min-w-full'
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role='img'
        aria-label={title || 'Diagrama de proceso'}
      >
        <defs>
          <marker
            id='process-arrow'
            markerWidth='10'
            markerHeight='8'
            refX='9'
            refY='4'
            orient='auto'
          >
            <path d='M0,0 L10,4 L0,8 Z' className='fill-muted-foreground' />
          </marker>
        </defs>

        {lanes.map((lane, index) => {
          const y = index * LANE_HEIGHT + 10
          return (
            <g key={lane.id}>
              <rect
                x={0}
                y={y}
                width={LANE_WIDTH}
                height={LANE_HEIGHT}
                className='fill-muted'
                stroke='currentColor'
                strokeOpacity='0.15'
              />
              <rect
                x={LANE_WIDTH}
                y={y}
                width={width - LANE_WIDTH}
                height={LANE_HEIGHT}
                className={index % 2 === 0 ? 'fill-background' : 'fill-muted/20'}
                stroke='currentColor'
                strokeOpacity='0.12'
              />
              <text
                x={LANE_WIDTH / 2}
                y={y + LANE_HEIGHT / 2}
                textAnchor='middle'
                dominantBaseline='middle'
                className='fill-foreground text-xs font-medium'
              >
                {lane.label}
              </text>
            </g>
          )
        })}

        {definition.edges.map((edge, index) => {
          const from = nodePosition.get(edge.from)
          const to = nodePosition.get(edge.to)
          if (!from || !to) return null
          const startX = from.x + NODE_WIDTH
          const startY = from.y + NODE_HEIGHT / 2
          const endX = to.x - 8
          const endY = to.y + NODE_HEIGHT / 2
          const midX = Math.max(startX + 24, (startX + endX) / 2)
          const path =
            Math.abs(startY - endY) < 4
              ? `M ${startX} ${startY} L ${endX} ${endY}`
              : `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <path
                d={path}
                className='fill-none stroke-muted-foreground'
                strokeWidth='1.5'
                markerEnd='url(#process-arrow)'
              />
              {edge.label && (
                <text
                  x={midX}
                  y={Math.min(startY, endY) - 5}
                  textAnchor='middle'
                  className='fill-muted-foreground text-[10px]'
                >
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {nodes.map(node => {
          const position = nodePosition.get(node.id)
          if (!position) return null
          const { x, y } = position
          const isDecision = node.type === 'DECISION'
          const isStartOrEnd = node.type === 'START' || node.type === 'END'
          const fillClass = isDecision
            ? 'fill-amber-100 dark:fill-amber-950/60'
            : isStartOrEnd
              ? 'fill-primary/15'
              : 'fill-background'

          return (
            <g key={node.id}>
              {isDecision ? (
                <polygon
                  points={`${x + NODE_WIDTH / 2},${y - 4} ${x + NODE_WIDTH + 4},${y + NODE_HEIGHT / 2} ${x + NODE_WIDTH / 2},${y + NODE_HEIGHT + 4} ${x - 4},${y + NODE_HEIGHT / 2}`}
                  className={`${fillClass} stroke-foreground/50`}
                />
              ) : (
                <rect
                  x={x}
                  y={y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={isStartOrEnd ? NODE_HEIGHT / 2 : 4}
                  className={`${fillClass} stroke-foreground/50`}
                />
              )}
              <foreignObject x={x + 10} y={y + 8} width={NODE_WIDTH - 20} height={NODE_HEIGHT - 16}>
                <div className='flex h-full items-center justify-center text-center text-[11px] leading-tight text-foreground'>
                  {node.label}
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </section>
  )
}

function ProcessSequenceCanvas({
  lanes,
  nodes,
  edges,
  title,
}: {
  lanes: ProcessDiagramDefinition['lanes']
  nodes: ProcessDiagramDefinition['nodes']
  edges: ProcessDiagramDefinition['edges']
  title?: string
}) {
  const width = Math.max(720, lanes.length * 190 + 80)
  const maxOrder = Math.max(...nodes.map(node => node.order ?? 0), 0)
  const height = Math.max(260, 120 + (maxOrder + 1) * 100)
  const lanePosition = new Map(
    lanes.map((lane, index) => [
      lane.id,
      110 + index * ((width - 220) / Math.max(lanes.length - 1, 1)),
    ])
  )
  const nodePosition = new Map(
    nodes.map(node => [
      node.id,
      { x: lanePosition.get(node.laneId) ?? 110, y: 100 + (node.order ?? 0) * 100 },
    ])
  )

  return (
    <section className='overflow-x-auto rounded-lg border bg-background'>
      {title && <p className='border-b px-4 py-3 text-sm font-medium'>{title}</p>}
      <svg
        className='min-w-full'
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role='img'
        aria-label={title || 'Diagrama de secuencia'}
      >
        <defs>
          <marker
            id='process-sequence-arrow'
            markerWidth='10'
            markerHeight='8'
            refX='9'
            refY='4'
            orient='auto'
          >
            <path d='M0,0 L10,4 L0,8 Z' className='fill-muted-foreground' />
          </marker>
        </defs>
        {lanes.map(lane => {
          const x = lanePosition.get(lane.id) ?? 110
          return (
            <g key={lane.id}>
              <rect
                x={x - 64}
                y={16}
                width={128}
                height={36}
                rx={4}
                className='fill-muted stroke-foreground/30'
              />
              <text
                x={x}
                y={38}
                textAnchor='middle'
                className='fill-foreground text-xs font-medium'
              >
                {lane.label}
              </text>
              <line
                x1={x}
                y1={52}
                x2={x}
                y2={height - 18}
                className='stroke-muted-foreground'
                strokeDasharray='5 5'
              />
            </g>
          )
        })}
        {edges.map((edge, index) => {
          const from = nodePosition.get(edge.from)
          const to = nodePosition.get(edge.to)
          if (!from || !to) return null
          const sameLane = Math.abs(from.x - to.x) < 2
          const y = from.y
          if (sameLane) {
            const loopX = from.x + 54
            return (
              <g key={`${edge.from}-${edge.to}-${index}`}>
                <path
                  d={`M ${from.x + 20} ${y} H ${loopX} V ${y + 36} H ${from.x + 20}`}
                  className='fill-none stroke-muted-foreground'
                  strokeWidth='1.5'
                  markerEnd='url(#process-sequence-arrow)'
                />
                {edge.label && (
                  <text x={loopX + 8} y={y + 18} className='fill-muted-foreground text-[10px]'>
                    {edge.label}
                  </text>
                )}
              </g>
            )
          }
          const direction = to.x >= from.x ? 1 : -1
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <line
                x1={from.x + 20 * direction}
                y1={y}
                x2={to.x - 20 * direction}
                y2={y}
                className='stroke-muted-foreground'
                strokeWidth='1.5'
                markerEnd='url(#process-sequence-arrow)'
              />
              {edge.label && (
                <text
                  x={(from.x + to.x) / 2}
                  y={y - 7}
                  textAnchor='middle'
                  className='fill-muted-foreground text-[10px]'
                >
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}
        {nodes.map(node => {
          const position = nodePosition.get(node.id)
          if (!position) return null
          return (
            <g key={node.id}>
              <rect
                x={position.x - 66}
                y={position.y - 18}
                width={132}
                height={36}
                rx={4}
                className='fill-background stroke-primary/60'
              />
              <foreignObject x={position.x - 58} y={position.y - 14} width={116} height={28}>
                <div className='flex h-full items-center justify-center text-center text-[10px] leading-tight text-foreground'>
                  {node.label}
                </div>
              </foreignObject>
            </g>
          )
        })}
      </svg>
    </section>
  )
}
