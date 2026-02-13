import { NextRequest, NextResponse } from 'next/server'
import { ConfigService } from '@/lib/services/config-service'

// API pública para obtener configuración del sistema de ayuda
export async function GET(request: NextRequest) {
  try {
    const config = await ConfigService.getHelpSystemConfig()

    // Solo devolver información pública
    const publicConfig = {
      supportEmail: config.supportEmail,
      supportPhone: config.supportPhone,
      supportHours: config.supportHours,
      responseTimes: config.responseTimes,
      companyName: config.companyName,
      chatEnabled: config.chatEnabled,
      chatUrl: config.chatEnabled ? config.chatUrl : null,
      documentationUrl: config.documentationUrl,
      videoTutorialsUrl: config.videoTutorialsUrl,
      statusPageUrl: config.statusPageUrl,
      bugReportEnabled: config.bugReportEnabled,
      feedbackEnabled: config.feedbackEnabled
    }

    return NextResponse.json({
      success: true,
      data: publicConfig
    })
  } catch (error) {
    console.error('Error fetching public help config:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Error interno del servidor' 
    }, { status: 500 })
  }
}