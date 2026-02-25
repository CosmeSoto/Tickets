'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, AlertCircle, Info, Minus } from 'lucide-react'

interface PriorityDistributionChartProps {
  data: Record<string, number>
  title?: string
  description?: string
}

const PRIORITY_COLORS = {
  URGENT: '#EF4444',
  HIGH: '#F97316', 
  MEDIUM: '#EAB308',
  LOW: '#22C55E'
}

const PRIORITY_LABELS = {
  URGENT: 'Urgente',
  HIGH: 'Alta',
  MEDIUM: 'Media', 
  LOW: 'Baja'
}

const PRIORITY_ICONS = {
  URGENT: AlertTriangle,
  HIGH: AlertCircle,
  MEDIUM: Info,
  LOW: Minus
}

export function PriorityDistributionChart({ 
  data, 
  title = "Distribución por Prioridad", 
  description = "Tickets agrupados por nivel de prioridad" 
}: PriorityDistributionChartProps) {
  const chartData = Object.entries(data)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      name: PRIORITY_LABELS[key as keyof typeof PRIORITY_LABELS] || key,
      value,
      color: PRIORITY_COLORS[key as keyof typeof PRIORITY_COLORS] || '#6B7280',
      key
    }))

  const total = chartData.reduce((sum, item) => sum + item.value, 0)
  const hasLimitedData = total < 10

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : '0'
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} tickets ({percentage}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Advertencia de datos limitados */}
        {hasLimitedData && (
          <div className="mb-4 text-sm text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Datos limitados</p>
              <p className="text-xs text-amber-600 mt-1">
                Solo {total} ticket{total !== 1 ? 's' : ''} en el período seleccionado. 
                Los porcentajes pueden no ser representativos. Use filtros más amplios para obtener más datos.
              </p>
            </div>
          </div>
        )}
        
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-6">
          <div className="w-full lg:w-1/2">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="w-full lg:w-1/2 space-y-3">
            {chartData.map((item) => {
              const Icon = PRIORITY_ICONS[item.key as keyof typeof PRIORITY_ICONS]
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0'
              
              return (
                <div key={item.key} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: item.color }}
                    >
                      {Icon && <Icon className="h-2 w-2 text-white" />}
                    </div>
                    <span className="font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-foreground">{item.value}</div>
                    <div className="text-sm text-muted-foreground">{percentage}%</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}