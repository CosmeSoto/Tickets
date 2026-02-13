'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

export function ReportsDebug() {
  const { data: session, status } = useSession()
  const [apiTests, setApiTests] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(false)

  const runDiagnostics = async () => {
    setLoading(true)
    const tests: Record<string, any> = {}

    try {
      // Test 1: Session
      tests.session = {
        status: status,
        hasSession: !!session,
        userRole: session?.user?.role,
        userName: session?.user?.name,
        userEmail: session?.user?.email,
        isAdmin: session?.user?.role === 'ADMIN'
      }

      // Test 2: API Categories
      try {
        const categoriesRes = await fetch('/api/categories')
        tests.categoriesAPI = {
          status: categoriesRes.status,
          ok: categoriesRes.ok,
          data: categoriesRes.ok ? await categoriesRes.json() : null
        }
      } catch (error) {
        tests.categoriesAPI = { error: error instanceof Error ? error.message : 'Unknown error' }
      }

      // Test 3: API Users
      try {
        const usersRes = await fetch('/api/users?role=TECHNICIAN')
        tests.usersAPI = {
          status: usersRes.status,
          ok: usersRes.ok,
          data: usersRes.ok ? await usersRes.json() : null
        }
      } catch (error) {
        tests.usersAPI = { error: error instanceof Error ? error.message : 'Unknown error' }
      }

      // Test 4: API Reports
      try {
        const reportsRes = await fetch('/api/reports?type=tickets')
        tests.reportsAPI = {
          status: reportsRes.status,
          ok: reportsRes.ok,
          data: reportsRes.ok ? await reportsRes.json() : await reportsRes.text()
        }
      } catch (error) {
        tests.reportsAPI = { error: error instanceof Error ? error.message : 'Unknown error' }
      }

    } catch (error) {
      console.error('Error running diagnostics:', error)
    }

    setApiTests(tests)
    setLoading(false)
  }

  useEffect(() => {
    runDiagnostics()
  }, [session, status])

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>🔍 Diagnóstico de Reportes</span>
            <Button onClick={runDiagnostics} disabled={loading} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Session Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <h4 className="font-medium">Estado de Sesión</h4>
              <p className="text-sm text-muted-foreground">
                Status: {apiTests.session?.status} | 
                Usuario: {apiTests.session?.userName || 'No logueado'} | 
                Rol: {apiTests.session?.userRole || 'N/A'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusIcon(apiTests.session?.hasSession)}
              {getStatusIcon(apiTests.session?.isAdmin)}
            </div>
          </div>

          {/* API Tests */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">API Categorías</h4>
                {getStatusIcon(apiTests.categoriesAPI?.ok)}
              </div>
              <p className="text-sm text-muted-foreground">
                Status: {apiTests.categoriesAPI?.status || 'N/A'}
              </p>
              {apiTests.categoriesAPI?.data?.data && (
                <p className="text-xs text-green-600">
                  {apiTests.categoriesAPI.data.data.length} categorías encontradas
                </p>
              )}
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">API Técnicos</h4>
                {getStatusIcon(apiTests.usersAPI?.ok)}
              </div>
              <p className="text-sm text-muted-foreground">
                Status: {apiTests.usersAPI?.status || 'N/A'}
              </p>
              {apiTests.usersAPI?.data?.data && (
                <p className="text-xs text-green-600">
                  {apiTests.usersAPI.data.data.length} técnicos encontrados
                </p>
              )}
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">API Reportes</h4>
                {getStatusIcon(apiTests.reportsAPI?.ok)}
              </div>
              <p className="text-sm text-muted-foreground">
                Status: {apiTests.reportsAPI?.status || 'N/A'}
              </p>
              {apiTests.reportsAPI?.data?.totalTickets !== undefined && (
                <p className="text-xs text-green-600">
                  {apiTests.reportsAPI.data.totalTickets} tickets encontrados
                </p>
              )}
            </div>
          </div>

          {/* Detailed Results */}
          {apiTests.reportsAPI?.data && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">✅ Datos de Reportes Encontrados</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>Total: {apiTests.reportsAPI.data.totalTickets}</div>
                <div>Abiertos: {apiTests.reportsAPI.data.openTickets}</div>
                <div>En Progreso: {apiTests.reportsAPI.data.inProgressTickets}</div>
                <div>Resueltos: {apiTests.reportsAPI.data.resolvedTickets}</div>
              </div>
            </div>
          )}

          {/* Error Messages */}
          {!apiTests.session?.isAdmin && apiTests.session?.hasSession && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800">❌ Error de Permisos</h4>
              <p className="text-sm text-red-600">
                Necesitas estar logueado como ADMIN. Tu rol actual es: {apiTests.session?.userRole}
              </p>
            </div>
          )}

          {!apiTests.session?.hasSession && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800">⚠️ Sin Sesión</h4>
              <p className="text-sm text-yellow-600">
                Necesitas iniciar sesión como admin@tickets.com con contraseña admin123
              </p>
            </div>
          )}

          {apiTests.reportsAPI?.status === 401 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800">❌ Error de Autenticación</h4>
              <p className="text-sm text-red-600">
                La API de reportes requiere autenticación. Verifica tu sesión.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}