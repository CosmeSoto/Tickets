'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ReportsDebugPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [apiResults, setApiResults] = useState<any>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDebugInfo({
      sessionStatus: status,
      session: session,
      userRole: session?.user?.role,
      userId: session?.user?.id,
      userName: session?.user?.name,
      userEmail: session?.user?.email
    })
  }, [session, status])

  const testAPI = async (endpoint: string, name: string) => {
    setLoading(true)
    try {
      console.log(`🧪 Probando ${name}: ${endpoint}`)
      const response = await fetch(endpoint)
      const data = await response.json()
      
      setApiResults((prev: any) => ({
        ...prev,
        [name]: {
          status: response.status,
          ok: response.ok,
          data: data,
          timestamp: new Date().toISOString()
        }
      }))
      
      console.log(`✅ ${name} resultado:`, { status: response.status, data })
    } catch (error) {
      console.error(`❌ Error en ${name}:`, error)
      setApiResults((prev: any) => ({
        ...prev,
        [name]: {
          error: error instanceof Error ? error.message : 'Error desconocido',
          timestamp: new Date().toISOString()
        }
      }))
    } finally {
      setLoading(false)
    }
  }

  const testAllAPIs = async () => {
    await testAPI('/api/auth/session', 'Session')
    await testAPI('/api/reports?type=tickets', 'Reports Tickets')
    await testAPI('/api/reports?type=technicians', 'Reports Technicians')
    await testAPI('/api/reports?type=categories', 'Reports Categories')
    await testAPI('/api/users', 'Users')
    await testAPI('/api/categories', 'Categories')
  }

  if (status === 'loading') {
    return <div>Cargando sesión...</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Debug de Reportes</h1>
      
      {/* Información de sesión */}
      <Card>
        <CardHeader>
          <CardTitle>Información de Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded text-sm overflow-auto">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Botones de prueba */}
      <Card>
        <CardHeader>
          <CardTitle>Pruebas de API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => testAPI('/api/auth/session', 'Session')}
              disabled={loading}
            >
              Probar Sesión
            </Button>
            <Button 
              onClick={() => testAPI('/api/reports?type=tickets', 'Reports Tickets')}
              disabled={loading}
            >
              Probar Reportes Tickets
            </Button>
            <Button 
              onClick={() => testAPI('/api/reports?type=technicians', 'Reports Technicians')}
              disabled={loading}
            >
              Probar Reportes Técnicos
            </Button>
            <Button 
              onClick={() => testAPI('/api/users', 'Users')}
              disabled={loading}
            >
              Probar Usuarios
            </Button>
            <Button 
              onClick={testAllAPIs}
              disabled={loading}
              variant="outline"
            >
              Probar Todas las APIs
            </Button>
          </div>
          
          {loading && <div>Probando APIs...</div>}
        </CardContent>
      </Card>

      {/* Resultados de APIs */}
      {Object.keys(apiResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de APIs</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(apiResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={() => router.push('/login')}>
            Ir a Login
          </Button>
          <Button onClick={() => router.push('/admin/reports')} variant="outline">
            Ir a Reportes Normal
          </Button>
          <Button onClick={() => window.location.reload()} variant="outline">
            Recargar Página
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}