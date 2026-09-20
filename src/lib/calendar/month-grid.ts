/**
 * Cálculo de grilla de calendario mensual — extraído de
 * patrol-agenda-calendar.tsx para reusarlo también en el calendario de Tareas
 * (planner-calendar-month.tsx) sin duplicar la lógica de fechas. Puramente
 * matemático: no sabe nada de rondas ni de tareas.
 */
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  subMonths,
  addMonths,
} from 'date-fns'

/** Todos los días visibles en la grilla del mes (incluye días del mes anterior/siguiente que completan la semana). */
export function getMonthGridDays(month: Date, weekStartsOn: 0 | 1 = 1): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn })
  const end = endOfWeek(endOfMonth(month), { weekStartsOn })
  return eachDayOfInterval({ start, end })
}

/** Mueve un mes hacia adelante/atrás conservando el día seleccionado (o el último día válido del mes destino). */
export function shiftMonthKeepingDay(month: Date, selectedDay: Date, delta: number): Date {
  const nextMonth = delta < 0 ? subMonths(month, 1) : addMonths(month, 1)
  const targetDay = Math.min(selectedDay.getDate(), endOfMonth(nextMonth).getDate())
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), targetDay)
}
