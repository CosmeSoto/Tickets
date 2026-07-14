import nodemailer from 'nodemailer'
import type { ReportExportFormat } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { InventoryScheduledReportService } from '@/lib/services/inventory-scheduled-report.service'
import { runSavedReportById } from '@/lib/inventory/reports/run-saved-report'
import {
  computeNextRunAt,
  exportFormatLabel,
  frequencyLabel,
} from '@/lib/inventory/reports/schedule-utils'
import { AuditActionsComplete, AuditServiceComplete } from '@/lib/services/audit-service-complete'

async function getSmtpConfig() {
  const settings = await prisma.system_settings.findMany({
    where: {
      key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_secure', 'email_from'] },
    },
  })
  if (!settings.length) return null
  const config: Record<string, string> = {}
  for (const s of settings) config[s.key] = s.value
  return {
    host: config.smtp_host,
    port: parseInt(config.smtp_port || '587', 10),
    secure: config.smtp_secure === 'true',
    user: config.smtp_user,
    password: config.smtp_password,
    from: config.email_from || config.smtp_user,
  }
}

async function sendReportEmail(options: {
  to: string[]
  subject: string
  html: string
  csv?: string
  pdf?: Buffer
  baseFilename: string
  exportFormat: ReportExportFormat
}) {
  const smtp = await getSmtpConfig()
  if (!smtp?.host) {
    throw new Error('SMTP no configurado')
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.password },
  })

  const safeName =
    options.baseFilename.replace(/[^a-zA-Z0-9-_áéíóúñ ]/gi, '').trim() || 'reporte'

  const attachments: nodemailer.SendMailOptions['attachments'] = []
  if (
    (options.exportFormat === 'CSV' || options.exportFormat === 'BOTH') &&
    options.csv
  ) {
    attachments.push({
      filename: `${safeName}.csv`,
      content: options.csv,
      contentType: 'text/csv; charset=utf-8',
    })
  }
  if (
    (options.exportFormat === 'PDF' || options.exportFormat === 'BOTH') &&
    options.pdf
  ) {
    attachments.push({
      filename: `${safeName}.pdf`,
      content: options.pdf,
      contentType: 'application/pdf',
    })
  }

  if (!attachments.length) {
    throw new Error('No hay archivos para adjuntar según el formato configurado')
  }

  for (const recipient of options.to) {
    await transporter.sendMail({
      from: smtp.from,
      to: recipient,
      subject: options.subject,
      html: options.html,
      attachments,
    })
  }
}

export async function runScheduledInventoryReports(): Promise<{
  processed: number
  sent: number
  failed: number
}> {
  const due = await InventoryScheduledReportService.listDue()
  let sent = 0
  let failed = 0

  for (const schedule of due) {
    const nextRunAt = computeNextRunAt({
      frequency: schedule.frequency,
      scheduleTime: schedule.scheduleTime,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
    })

    try {
      const result = await runSavedReportById(schedule.savedReportId)
      if (!result) {
        throw new Error('No se pudo ejecutar el reporte guardado')
      }

      const recipients =
        (schedule.recipients as string[])?.length > 0
          ? (schedule.recipients as string[])
          : schedule.owner.email
            ? [schedule.owner.email]
            : []

      if (!recipients.length) {
        throw new Error('Sin destinatarios configurados')
      }

      const exportFormat = schedule.exportFormat ?? 'BOTH'
      const formatLabel = exportFormatLabel(exportFormat)

      const summaryHtml = result.summary
        .slice(0, 3)
        .map(s => `<li><strong>${s.title}:</strong> ${s.value}</li>`)
        .join('')

      await sendReportEmail({
        to: recipients,
        subject: `[Inventario] Reporte programado: ${result.reportName}`,
        html: `
          <p>Hola ${schedule.owner.name},</p>
          <p>Adjunto encontrarás el reporte <strong>${result.reportName}</strong> (${formatLabel}, ${result.rowCount} registros).</p>
          <ul>${summaryHtml}</ul>
          <p>Frecuencia: ${frequencyLabel(schedule.frequency)} a las ${schedule.scheduleTime}</p>
          <p style="color:#666;font-size:12px">Generado automáticamente por el Centro de Reportes.</p>
        `,
        csv: result.csv,
        pdf: result.pdf,
        baseFilename: result.reportName,
        exportFormat,
      })

      await InventoryScheduledReportService.markRunResult(schedule.id, {
        success: true,
        nextRunAt,
      })

      await AuditServiceComplete.logAction({
        userId: schedule.userId,
        action: AuditActionsComplete.REPORT_SCHEDULED,
        entityType: 'report',
        entityId: schedule.id,
        details: {
          savedReportId: schedule.savedReportId,
          recipients,
          rowCount: result.rowCount,
          exportFormat,
        },
      })

      sent += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido'
      await InventoryScheduledReportService.markRunResult(schedule.id, {
        success: false,
        error: message,
        nextRunAt,
      })
      failed += 1
      console.error(`[SCHEDULED-REPORTS] Error schedule ${schedule.id}:`, message)
    }
  }

  return { processed: due.length, sent, failed }
}
