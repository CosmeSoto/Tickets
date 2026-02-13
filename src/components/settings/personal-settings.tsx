'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useTheme } from '@/hooks/use-theme'
import {
  Settings,
  Eye,
  Moon,
  Sun,
  Save
} from 'lucide-react'

interface PersonalSettingsProps {
  onSave: () => void
  loading: boolean
}

export function PersonalSettings({ onSave, loading }: PersonalSettingsProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Cargar tema desde la base de datos al montar el componente
    loadThemeFromDatabase()
  }, [])

  const loadThemeFromDatabase = async () => {
    try {
      const response = await fetch('/api/users/preferences')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.preferences.theme) {
          // Solo actualizar si es diferente al actual
          if (data.preferences.theme !== theme) {
            setTheme(data.preferences.theme)
          }
        }
      }
    } catch (error) {
      console.error('Error loading theme from database:', error)
    }
  }

  // No renderizar hasta que esté montado
  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Preferencias</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <span>Preferencias</span>
        </CardTitle>
        <CardDescription>
          Personaliza la apariencia y comportamiento del sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tema de la Interfaz</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Personaliza la apariencia del sistema según tus preferencias
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant={theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
                disabled={loading}
              >
                <Sun className="h-4 w-4 mr-2" />
                Claro
              </Button>
              <Button
                variant={theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
                disabled={loading}
              >
                <Moon className="h-4 w-4 mr-2" />
                Oscuro
              </Button>
              <Button
                variant={theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
                disabled={loading}
              >
                <Eye className="h-4 w-4 mr-2" />
                Sistema
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              El tema se aplicará inmediatamente y se guardará automáticamente
            </p>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={loading} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Guardando...' : 'Guardar Preferencias'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}