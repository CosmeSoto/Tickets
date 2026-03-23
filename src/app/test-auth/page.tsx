'use client'

import { useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function TestAuthPage() {
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('internet.freecom@gmail.com')
  const [password, setPassword] = useState('admin123')
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>({})

  const handleLogin = async () => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      console.log('Login result:', result)
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await signOut({ redirect: false })
  }

  const testAPI = async (endpoint: string, name: string) => {
    try {
      console.log(`Testing ${name}: ${endpoint}`)
      const response = await fetch(endpoint)
      const data = await response.json()
      
      setTestResults((prev: any) => ({
        ...prev,
        [name]: {
          status: response.status,
          ok: response.ok,
          data: data,
          timestamp: new Date().toISOString()
        }
      }))
      
      console.log(`${name} result:`, { status: response.status, data })
    } catch (error) {
      console.error(`Error testing ${name}:`, error)
      setTestResults((prev: any) => ({
        ...prev,
        [name]: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      }))
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test de Autenticación y APIs</h1>
      
      {/* Estado de sesión */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Sesión</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Status:</strong> {status}</p>
            <p><strong>Autenticado:</strong> {session ? 'Sí' : 'No'}</p>
            {session && (
              <>
                <p><strong>Usuario:</strong> {session.user?.name}</p>
                <p><strong>Email:</strong> {session.user?.email}</p>
                <p><strong>Rol:</strong> {session.user?.role}</p>
                <p><strong>ID:</strong> {session.user?.id}</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Login/Logout */}
      <Card>
        <CardHeader>
          <CardTitle>Autenticación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!session ? (
            <>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleLogin} disabled={loading}>
                {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
              </Button>
            </>
          ) : (
            <Button onClick={handleLogout} variant="outline">
              Cerrar Sesión
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Test de APIs */}
      <Card>
        <CardHeader>
          <CardTitle>Pruebas de API</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => testAPI('/api/auth/session', 'Session')}
              size="sm"
            >
              Test Session
            </Button>
            <Button 
              onClick={() => testAPI('/api/reports?type=tickets', 'Reports Tickets')}
              size="sm"
            >
              Test Reports Tickets
            </Button>
            <Button 
              onClick={() => testAPI('/api/reports?type=technicians', 'Reports Technicians')}
              size="sm"
            >
              Test Reports Technicians
            </Button>
            <Button 
              onClick={() => testAPI('/api/reports?type=categories', 'Reports Categories')}
              size="sm"
            >
              Test Reports Categories
            </Button>
            <Button 
              onClick={() => testAPI('/api/users', 'Users')}
              size="sm"
            >
              Test Users
            </Button>
            <Button 
              onClick={() => testAPI('/api/categories', 'Categories')}
              size="sm"
            >
              Test Categories
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {Object.keys(testResults).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados de Pruebas</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto max-h-96">
              {JSON.stringify(testResults, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Acciones rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button 
            onClick={() => window.location.href = '/admin/reports'}
            disabled={!session || session.user?.role !== 'ADMIN'}
          >
            Ir a Reportes (Admin)
          </Button>
          <Button 
            onClick={() => window.location.href = '/admin/reports/debug'}
            disabled={!session || session.user?.role !== 'ADMIN'}
          >
            Ir a Debug de Reportes
          </Button>
          <Button 
            onClick={() => window.location.href = '/login'}
            variant="outline"
          >
            Ir a Login Normal
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}