import { NextResponse } from 'next/server'
import { MaintenanceModeService } from '@/lib/services/maintenance-mode-service'

/** Configuración pública de modo mantenimiento (sin datos sensibles). */
export async function GET() {
  try {
    const config = await MaintenanceModeService.getConfig()
    return NextResponse.json({
      enabled: config.enabled,
      message: config.message,
      allowAdmins: config.allowAdmins,
    })
  } catch {
    return NextResponse.json({
      enabled: false,
      message: '',
      allowAdmins: true,
    })
  }
}
