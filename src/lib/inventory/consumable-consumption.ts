import prisma from '@/lib/prisma'

export type ConsumableConsumptionSummary = {
  today: number
  week: number
  month: number
  last30Days: number
  avgPerDay30: number
  /** Días estimados de stock al ritmo de los últimos 30 días (null si no hay consumo) */
  daysOfStockLeft: number | null
}

function startOfLocalDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Lunes 00:00 local de la semana que contiene `d`. */
function startOfLocalWeek(d: Date) {
  const x = startOfLocalDay(d)
  const day = x.getDay() // 0=domingo
  const diff = day === 0 ? 6 : day - 1
  x.setDate(x.getDate() - diff)
  return x
}

function startOfLocalMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

/**
 * Agrega salidas (EXIT) para responder: ¿cuánto se consume al día / semana / mes?
 */
export async function getConsumableConsumptionSummary(
  consumableId: string,
  currentStock: number
): Promise<ConsumableConsumptionSummary> {
  const now = new Date()
  const dayStart = startOfLocalDay(now)
  const weekStart = startOfLocalWeek(now)
  const monthStart = startOfLocalMonth(now)
  const last30Start = new Date(dayStart)
  last30Start.setDate(last30Start.getDate() - 29)
  const from = monthStart < last30Start ? monthStart : last30Start

  const exits = await prisma.stock_movements.findMany({
    where: {
      consumableId,
      type: 'EXIT',
      createdAt: { gte: from },
    },
    select: { quantity: true, createdAt: true },
  })

  let today = 0
  let week = 0
  let month = 0
  let last30Days = 0

  for (const m of exits) {
    const t = m.createdAt
    const q = m.quantity
    if (t >= dayStart) today += q
    if (t >= weekStart) week += q
    if (t >= monthStart) month += q
    if (t >= last30Start) last30Days += q
  }

  const avgPerDay30 = last30Days / 30
  const daysOfStockLeft = avgPerDay30 > 0 ? Math.floor(currentStock / avgPerDay30) : null

  return {
    today,
    week,
    month,
    last30Days,
    avgPerDay30: Math.round(avgPerDay30 * 100) / 100,
    daysOfStockLeft,
  }
}
