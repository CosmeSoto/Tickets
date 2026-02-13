import prisma from '@/lib/prisma'
import { randomUUID } from 'crypto'

export interface HelpSystemConfig {
  supportEmail: string
  supportPhone: string
  supportHours: {
    monday: string
    tuesday: string
    wednesday: string
    thursday: string
    friday: string
    saturday: string
    sunday: string
  }
  responseTimes: {
    urgent: string
    high: string
    medium: string
    low: string
  }
  companyName: string
  companyAddress: string
  chatEnabled: boolean
  chatUrl: string
  documentationUrl: string
  videoTutorialsUrl: string
  statusPageUrl: string
  bugReportEnabled: boolean
  feedbackEnabled: boolean
}

export interface SiteConfig {
  name: string
  description: string
  logoUrl: string
  faviconUrl: string
  primaryColor: string
  secondaryColor: string
}

export class ConfigService {
  // Obtener configuración del sistema de ayuda
  static async getHelpSystemConfig(): Promise<HelpSystemConfig> {
    const settings = await prisma.system_settings.findMany({
      where: {
        key: {
          startsWith: 'help.'
        }
      }
    })

    const config: any = {}
    
    for (const setting of settings) {
      const key = setting.key.replace('help.', '')
      let value: any = setting.value

      // Parsear JSON si es necesario
      if (key === 'support_hours' || key === 'response_times') {
        try {
          value = JSON.parse(value)
        } catch (e) {
          console.error(`Error parsing ${key}:`, e)
        }
      }

      // Convertir booleanos
      if (key === 'chat_enabled' || key === 'bug_report_enabled' || key === 'feedback_enabled') {
        value = value === 'true'
      }

      // Mapear nombres de claves
      const keyMap: { [key: string]: string } = {
        'support_email': 'supportEmail',
        'support_phone': 'supportPhone',
        'support_hours': 'supportHours',
        'response_times': 'responseTimes',
        'company_name': 'companyName',
        'company_address': 'companyAddress',
        'chat_enabled': 'chatEnabled',
        'chat_url': 'chatUrl',
        'documentation_url': 'documentationUrl',
        'video_tutorials_url': 'videoTutorialsUrl',
        'status_page_url': 'statusPageUrl',
        'bug_report_enabled': 'bugReportEnabled',
        'feedback_enabled': 'feedbackEnabled'
      }

      const mappedKey = keyMap[key] || key
      config[mappedKey] = value
    }

    // Valores por defecto si no existen
    return {
      supportEmail: config.supportEmail || 'soporte@ticketpro.com',
      supportPhone: config.supportPhone || '+1 (555) 123-4567',
      supportHours: config.supportHours || {
        monday: '9:00-18:00',
        tuesday: '9:00-18:00',
        wednesday: '9:00-18:00',
        thursday: '9:00-18:00',
        friday: '9:00-18:00',
        saturday: '10:00-14:00',
        sunday: 'closed'
      },
      responseTimes: config.responseTimes || {
        urgent: '1-2 horas',
        high: '4-8 horas',
        medium: '1-2 días',
        low: '2-5 días'
      },
      companyName: config.companyName || 'TicketPro',
      companyAddress: config.companyAddress || '123 Tech Street, Silicon Valley, CA 94000',
      chatEnabled: config.chatEnabled !== undefined ? config.chatEnabled : true,
      chatUrl: config.chatUrl || 'https://chat.ticketpro.com',
      documentationUrl: config.documentationUrl || 'https://docs.ticketpro.com',
      videoTutorialsUrl: config.videoTutorialsUrl || 'https://videos.ticketpro.com',
      statusPageUrl: config.statusPageUrl || 'https://status.ticketpro.com',
      bugReportEnabled: config.bugReportEnabled !== undefined ? config.bugReportEnabled : true,
      feedbackEnabled: config.feedbackEnabled !== undefined ? config.feedbackEnabled : true
    }
  }

  // Obtener configuración del sitio
  static async getSiteConfig(): Promise<SiteConfig> {
    const settings = await prisma.site_config.findMany({
      where: {
        key: {
          startsWith: 'site.'
        }
      }
    })

    const config: any = {}
    
    for (const setting of settings) {
      const key = setting.key.replace('site.', '')
      config[key] = setting.value
    }

    return {
      name: config.name || 'TicketPro',
      description: config.description || 'Sistema de gestión de tickets',
      logoUrl: config.logo_url || '/logo.png',
      faviconUrl: config.favicon_url || '/favicon.ico',
      primaryColor: config.primary_color || '#3B82F6',
      secondaryColor: config.secondary_color || '#6B7280'
    }
  }

  // Actualizar configuración del sistema de ayuda
  static async updateHelpSystemConfig(config: Partial<HelpSystemConfig>): Promise<void> {
    const updates = []

    for (const [key, value] of Object.entries(config)) {
      const dbKey = this.mapConfigKeyToDb(key)
      let dbValue = value

      // Convertir objetos a JSON
      if (typeof value === 'object' && value !== null) {
        dbValue = JSON.stringify(value)
      }

      // Convertir booleanos a string
      if (typeof value === 'boolean') {
        dbValue = value.toString()
      }

      updates.push(
        prisma.system_settings.upsert({
          where: { key: `help.${dbKey}` },
          update: { value: dbValue as string, updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: `help.${dbKey}`,
            value: dbValue as string,
            description: this.getConfigDescription(key),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      )
    }

    await Promise.all(updates)
  }

  // Actualizar configuración del sitio
  static async updateSiteConfig(config: Partial<SiteConfig>): Promise<void> {
    const updates = []

    for (const [key, value] of Object.entries(config)) {
      const dbKey = this.mapSiteConfigKeyToDb(key)
      
      updates.push(
        prisma.site_config.upsert({
          where: { key: `site.${dbKey}` },
          update: { value: value as string, updatedAt: new Date() },
          create: {
            id: randomUUID(),
            key: `site.${dbKey}`,
            value: value as string,
            description: this.getSiteConfigDescription(key),
            updatedAt: new Date()
          }
        })
      )
    }

    await Promise.all(updates)
  }

  // Mapear claves de configuración a base de datos
  private static mapConfigKeyToDb(key: string): string {
    const keyMap: { [key: string]: string } = {
      'supportEmail': 'support_email',
      'supportPhone': 'support_phone',
      'supportHours': 'support_hours',
      'responseTimes': 'response_times',
      'companyName': 'company_name',
      'companyAddress': 'company_address',
      'chatEnabled': 'chat_enabled',
      'chatUrl': 'chat_url',
      'documentationUrl': 'documentation_url',
      'videoTutorialsUrl': 'video_tutorials_url',
      'statusPageUrl': 'status_page_url',
      'bugReportEnabled': 'bug_report_enabled',
      'feedbackEnabled': 'feedback_enabled'
    }
    return keyMap[key] || key
  }

  private static mapSiteConfigKeyToDb(key: string): string {
    const keyMap: { [key: string]: string } = {
      'logoUrl': 'logo_url',
      'faviconUrl': 'favicon_url',
      'primaryColor': 'primary_color',
      'secondaryColor': 'secondary_color'
    }
    return keyMap[key] || key
  }

  private static getConfigDescription(key: string): string {
    const descriptions: { [key: string]: string } = {
      'supportEmail': 'Email de contacto para soporte técnico',
      'supportPhone': 'Teléfono de contacto para soporte',
      'supportHours': 'Horarios de atención al cliente',
      'responseTimes': 'Tiempos de respuesta por prioridad',
      'companyName': 'Nombre de la empresa',
      'companyAddress': 'Dirección de la empresa',
      'chatEnabled': 'Habilitar chat en vivo',
      'chatUrl': 'URL del chat en vivo',
      'documentationUrl': 'URL de la documentación',
      'videoTutorialsUrl': 'URL de video tutoriales',
      'statusPageUrl': 'URL de la página de estado del sistema',
      'bugReportEnabled': 'Habilitar reporte de bugs',
      'feedbackEnabled': 'Habilitar sistema de feedback'
    }
    return descriptions[key] || ''
  }

  private static getSiteConfigDescription(key: string): string {
    const descriptions: { [key: string]: string } = {
      'name': 'Nombre del sitio',
      'description': 'Descripción del sitio',
      'logoUrl': 'URL del logo del sitio',
      'faviconUrl': 'URL del favicon',
      'primaryColor': 'Color primario del sitio',
      'secondaryColor': 'Color secundario del sitio'
    }
    return descriptions[key] || ''
  }
}