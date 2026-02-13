'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface TicketTrendsChartProps {
  data: Array<{
    date: string
    created: number
    resolved: number
  }>
  title?: string
  description?: string
}

export function TicketTrendsChart({ data, title = "Tendencia de Tickets", description = "Tickets creados vs resueltos por día" }: TicketTrendsChartProps) {
  // Calcular tendencias
  const totalCreated = data.reduce((sum, item) => sum + item.created, 0)
  const totalResolved = data.reduce((sum, item) => sum + item.resolved, 0)
  const trend = totalResolved - totalCreated
  const trendPercentage = totalCreated > 0 ? ((totalResolved / totalCreated) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <span>{title}</span>
              {trend >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trendPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              Tasa de resolución
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => new Date(value).toLocaleDateString('es-ES', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
              formatter={(value, name) => [value, name === 'created' ? 'Creados' : 'Resueltos']}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="created" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="Creados"
              dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="resolved" 
              stroke="#10B981" 
              strokeWidth={2}
              name="Resueltos"
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}