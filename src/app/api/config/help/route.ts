import { NextRequest, NextResponse } from 'next/server'
import { ConfigService } from '@/lib/services/config-service'

// API pública para obtener configuración del sistema de ayuda
export async function GET(request: NextRequest) {
  try {
    const config = await ConfigService.getHelpSystemConfig()

    // Solo información necesaria para contacto/ayuda (minimización de datos).
    // No inventar teléfonos, direcciones ni URLs de marcas demo.
    const publicConfig = {
      supportEmail: config.supportEmail || null,
      supportPhone: config.supportPhone || null,
      supportHours: config.supportHours,
      responseTimes: config.responseTimes,
      companyName: config.companyName,
      chatEnabled: Boolean(config.chatEnabled && config.chatUrl),
      chatUrl: config.chatEnabled && config.chatUrl ? config.chatUrl : null,
      documentationUrl: config.documentationUrl || null,
      videoTutorialsUrl: config.videoTutorialsUrl || null,
      statusPageUrl: config.statusPageUrl || null,
      bugReportEnabled: config.bugReportEnabled,
      feedbackEnabled: config.feedbackEnabled,
      privacyUrl: '/privacidad',
      termsUrl: '/help/terms',
    }

    return NextResponse.json({
      success: true,
      data: publicConfig,
    })
  } catch (error) {
    console.error('Error fetching public help config:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor',
      },
      { status: 500 }
    )
  }
}