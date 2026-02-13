import React from 'react'

// Componente Select simplificado para testing
export function SimpleSelect({ 
  value, 
  onValueChange, 
  disabled, 
  children 
}: {
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select 
      value={value} 
      onChange={(e) => onValueChange(e.target.value)}
      disabled={disabled}
      className="w-full p-2 border border-gray-300 rounded-md"
    >
      {children}
    </select>
  )
}

export function SimpleSelectItem({ 
  value, 
  children 
}: {
  value: string
  children: React.ReactNode
}) {
  return <option value={value}>{children}</option>
}