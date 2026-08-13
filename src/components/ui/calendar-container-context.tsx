'use client'

import * as React from 'react'

export const CalendarContainerContext =
  React.createContext<React.RefObject<HTMLDivElement | null> | null>(null)

export function useCalendarContainer() {
  return React.useContext(CalendarContainerContext)
}
