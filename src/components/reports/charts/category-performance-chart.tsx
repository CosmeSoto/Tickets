'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Clock, CheckCircle } from 'lucide-react'

interface CategoryPerformanceChartProps {
  data: Array<{
    categoryName: string
    count: number
    percentage: number
  }>
  title?: string
  description?: string
}

export function CategoryPerformanceChart({ 
  data, 
  title = "Rendimiento por Categoría", 
  description = "Distribución de tickets por categoría" 
}: CategoryPerformanceChartProps) {
  // Preparar datos para el gráfico
  const chartData = data.map((item, index) => ({
    ...item,
    fill: `hsl(${(index * 137.5) % 360}, 70%, 50%)` // Colores dinámicos
  }))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card p-3 border border-border rounded-lg shadow-lg">
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">
            {data.count} tickets ({data.percentage.toFixed(1)}%)
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            {data.length} categorías
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gráfico de barras */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="categoryName" 
                tick={{ fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
                name="Tickets"
              />
            </BarChart>
          </ResponsiveContainer>

          {/* Lista detallada */}
          <div className="space-y-2">
            <h4 className="font-medium text-foreground mb-3">Desglose detallado</h4>
            {data.slice(0, 5).map((category, index) => (
              <div key={category.categoryName} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium text-foreground">{category.categoryName}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <CheckCircle className="h-4 w-4" />
                    <span>{category.count} tickets</span>
                  </div>
                  <Badge variant="secondary">
                    {category.percentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            ))}
            
            {data.length > 5 && (
              <div className="text-center pt-2">
                <Badge variant="outline" className="text-xs">
                  +{data.length - 5} categorías más
                </Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}