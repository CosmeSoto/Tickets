'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Link,
  Unlink,
  CheckCircle,
  AlertTriangle,
  Mail,
  Calendar,
  ExternalLink
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface OAuthAccount {
  id: string
  provider: 'google' | 'microsoft'
  providerId: string
  email?: string
  name?: string
  picture?: string
  verified: boolean
  createdAt: string
  lastUsed?: string
}

interface OAuthAccountsManagerProps {
  userId: string
  accounts: OAuthAccount[]
  onAccountLinked: () => void
  onAccountUnlinked: () => void
  canModify?: boolean
}

const providerInfo = {
  google: {
    name: 'Google',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '🔴', // En producción usar iconos apropiados
    description: 'Cuenta de Google/Gmail'
  },
  microsoft: {
    name: 'Microsoft',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '🔵', // En producción usar iconos apropiados
    description: 'Cuenta de Microsoft/Outlook'
  }
}

export function OAuthAccountsManager({
  userId,
  accounts,
  onAccountLinked,
  onAccountUnlinked,
  canModify = true
}: OAuthAccountsManagerProps) {
  const [unlinkingAccount, setUnlinkingAccount] = useState<string | null>(null)
  const [linking, setLinking] = useState<string | null>(null)
  const { toast } = useToast()

  const handleLinkAccount = async (provider: 'google' | 'microsoft') => {
    if (!canModify) return

    setLinking(provider)
    try {
      // Redirigir a OAuth flow
      const callbackUrl = encodeURIComponent(window.location.href)
      window.location.href = `/api/auth/oauth/link?provider=${provider}&userId=${userId}&callbackUrl=${callbackUrl}`
    } catch (error) {
      console.error('Error linking account:', error)
      toast({
        title: 'Error al vincular cuenta',
        description: 'No se pudo iniciar el proceso de vinculación',
        variant: 'destructive'
      })
      setLinking(null)
    }
  }

  const handleUnlinkAccount = async (accountId: string) => {
    if (!canModify) return

    try {
      const response = await fetch(`/api/users/${userId}/oauth-accounts/${accountId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast({
          title: 'Cuenta desvinculada',
          description: 'La cuenta OAuth ha sido desvinculada exitosamente'
        })
        onAccountUnlinked()
      } else {
        throw new Error('Error al desvincular cuenta')
      }
    } catch (error) {
      console.error('Error unlinking account:', error)
      toast({
        title: 'Error al desvincular',
        description: 'No se pudo desvincular la cuenta OAuth',
        variant: 'destructive'
      })
    } finally {
      setUnlinkingAccount(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const availableProviders = ['google', 'microsoft'] as const
  const linkedProviders = accounts.map(acc => acc.provider)
  const unlinkedProviders = availableProviders.filter(provider => !linkedProviders.includes(provider))

  return (
    <div className="space-y-6">
      {/* Cuentas vinculadas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Link className="h-5 w-5" />
            <span>Cuentas Vinculadas</span>
          </CardTitle>
          <CardDescription>
            Gestiona las cuentas OAuth vinculadas a este usuario
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length > 0 ? (
            <div className="space-y-4">
              {accounts.map(account => {
                const provider = providerInfo[account.provider]
                return (
                  <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={account.picture || undefined} alt={account.name || account.email} />
                        <AvatarFallback className="bg-muted">
                          {provider.icon}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium">{account.name || account.email}</h4>
                          <Badge className={provider.color}>
                            {provider.name}
                          </Badge>
                          {account.verified && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          {account.email && (
                            <div className="flex items-center space-x-1">
                              <Mail className="h-3 w-3" />
                              <span>{account.email}</span>
                            </div>
                          )}
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-3 w-3" />
                            <span>Vinculada: {formatDate(account.createdAt)}</span>
                          </div>
                          {account.lastUsed && (
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>Último uso: {formatDate(account.lastUsed)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {!account.verified && (
                        <div title="Cuenta no verificada">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        </div>
                      )}
                      
                      {canModify && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setUnlinkingAccount(account.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Unlink className="h-4 w-4 mr-1" />
                          Desvincular
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Link className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p>No hay cuentas OAuth vinculadas</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vincular nuevas cuentas */}
      {canModify && unlinkedProviders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ExternalLink className="h-5 w-5" />
              <span>Vincular Nueva Cuenta</span>
            </CardTitle>
            <CardDescription>
              Conecta cuentas adicionales para facilitar el acceso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              {unlinkedProviders.map(provider => {
                const info = providerInfo[provider]
                return (
                  <div key={provider} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl">
                        {info.icon}
                      </div>
                      <div>
                        <h4 className="font-medium">{info.name}</h4>
                        <p className="text-sm text-muted-foreground">{info.description}</p>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleLinkAccount(provider)}
                      disabled={linking === provider}
                      className="flex items-center space-x-2"
                    >
                      <Link className="h-4 w-4" />
                      <span>{linking === provider ? 'Vinculando...' : 'Vincular'}</span>
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Información importante */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-700">
              <h4 className="font-medium mb-2">Información sobre cuentas OAuth</h4>
              <ul className="space-y-1 text-xs">
                <li>• Las cuentas OAuth permiten iniciar sesión sin contraseña</li>
                <li>• Puedes tener múltiples cuentas vinculadas</li>
                <li>• Desvincular una cuenta no afecta el acceso con contraseña</li>
                <li>• Los datos se sincronizan automáticamente cuando es posible</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de confirmación para desvincular */}
      <AlertDialog open={!!unlinkingAccount} onOpenChange={() => setUnlinkingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular cuenta OAuth?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción desvinculará la cuenta OAuth seleccionada. El usuario ya no podrá 
              iniciar sesión usando esta cuenta, pero mantendrá acceso con su contraseña.
              
              <div className="mt-3 p-3 bg-muted rounded text-sm">
                <strong>Nota:</strong> Esta acción no se puede deshacer. Para volver a vincular 
                la cuenta será necesario repetir el proceso de autorización.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkingAccount && handleUnlinkAccount(unlinkingAccount)}
              className="bg-red-600 hover:bg-red-700"
            >
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}