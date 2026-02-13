'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, Trophy, Clock, Target } from 'lucide-react'

interface TechnicianPerformanceChartProps {
  data: Array<{
    technicianId: string
    technicianName: string
    totalAssigned: number
    resolved: number
    inProgress: number
    avgResolutionTime: string
    resolutionRate: number
    workload: 'Baja' | 'Media' | 'Alta' | 'Sobrecargado'
  }>
  title?: string
  description?: string
}

const WORKLOAD_COLORS = {
  'Baja': '#22C55E',
  'Media': '#EAB308', 
  'Alta': '#F97316',
  'Sobrecargado': '#EF4444'
}

export function TechnicianPerformanceChart({ 
  data, 
  title = "Rendimiento de Técnicos", 
  description = "Análisis de productividad y carga de trabajo" 
}: TechnicianPerformanceChartProps) {
  // Preparar datos para el gráfico
  const chartData = data.map(tech => ({
    ...tech,
    name: tech.technicianName.split(' ')[0], // Solo primer nombre para el gráfico
    fill: WORKLOAD_COLORS[tech.workload]
  }))

  // Encontrar el mejor técnico
  const topTechnician = data.reduce((prev, current) => 
    (prev.resolutionRate > current.resolutionRate) ? prev : current
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-card p-4 border border-border rounded-lg shadow-lg min-w-[200px]">
          <p className="font-medium mb-2">{data.technicianName}</p>
          <div className="space-y-1 text-sm">
            <p>Resueltos: {data.resolved}/{data.totalAssigned}</p>
            <p>Tasa: {data.resolutionRate.toFixed(1)}%</p>
            <p>Tiempo promedio: {data.avgResolutionTime}</p>
            <p>Carga: <span className={`font-medium`} style={{ color: WORKLOAD_COLORS[data.workload as keyof typeof WORKLOAD_COLORS] }}>{data.workload}</span></p>
          </div>
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
              <Users className="h-5 w-5" />
              <span>{title}</span>
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">{topTechnician.technicianName}</span>
            <Badge variant="secondary">{topTechnician.resolutionRate.toFixed(1)}%</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Gráfico de barras */}
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                label={{ value: 'Tasa de Resolución (%)', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="resolutionRate" 
                radius={[4, 4, 0, 0]}
                name="Tasa de Resolución"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Ranking detallado */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center space-x-2">
              <Target className="h-4 w-4" />
              <span>Ranking de Rendimiento</span>
            </h4>
            
            {data
              .sort((a, b) => b.resolutionRate - a.resolutionRate)
              .slice(0, 5)
              .map((tech, index) => (
                <div key={tech.technicianId} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-800' :
                        index === 1 ? 'bg-muted text-foreground' :
                        index === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {index + 1}
                      </div>
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {tech.technicianName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{tech.technicianName}</p>
                      <p className="text-sm text-muted-foreground">
                        {tech.resolved} resueltos • {tech.avgResolutionTime} promedio
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="text-right">
                      <div className="font-bold text-foreground">{tech.resolutionRate.toFixed(1)}%</div>
                      <div className="text-xs text-muted-foreground">resolución</div>
                    </div>
                    <Badge 
                      variant="outline"
                      className="text-xs"
                      style={{ 
                        borderColor: WORKLOAD_COLORS[tech.workload],
                        color: WORKLOAD_COLORS[tech.workload]
                      }}
                    >
                      {tech.workload}
                    </Badge>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}