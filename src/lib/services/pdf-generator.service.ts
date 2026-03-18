import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import { PrismaClient } from '@prisma/client'
import { QRCodeService } from './qr-code.service'
import { generateDeliveryActPDF } from '../templates/delivery-act-pdf.template'
import { generateReturnActPDF } from '../templates/return-act-pdf.template'
import type { DeliveryAct } from '@/types/inventory/delivery-act'

const prisma = new PrismaClient()
const mkdir = promisify(fs.mkdir)
const writeFile = promisify(fs.writeFile)

/**
 * Servicio para generación de PDFs de actas
 */
export class PDFGeneratorService {
  private static readonly UPLOAD_BASE_DIR = path.join(process.cwd(), 'public', 'uploads')
  private static readonly DELIVERY_ACTS_DIR = path.join(this.UPLOAD_BASE_DIR, 'delivery-acts')
  private static readonly RETURN_ACTS_DIR = path.join(this.UPLOAD_BASE_DIR, 'return-acts')

  /**
   * Asegura que los directorios de uploads existan
   */
  private static async ensureDirectories(): Promise<void> {
    try {
      await mkdir(this.DELIVERY_ACTS_DIR, { recursive: true })
      await mkdir(this.RETURN_ACTS_DIR, { recursive: true })
    } catch (error) {
      console.error('Error creando directorios:', error)
      throw error
    }
  }

  /**
   * Genera el PDF de un acta de entrega
   */
  static async generateDeliveryActPDF(actId: string): Promise<string> {
    try {
      // Asegurar que los directorios existan
      await this.ensureDirectories()

      // Obtener el acta
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      if (!act) {
        throw new Error('Acta no encontrada')
      }

      // Generar QR code para verificación
      const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/inventory/acts/${actId}/verify`
      const qrCodeDataUrl = await QRCodeService.generateQRCode(verificationUrl)

      // Generar PDF
      const doc = await generateDeliveryActPDF(act as DeliveryAct, qrCodeDataUrl)

      // Nombre del archivo
      const fileName = `${act.folio.replace(/\//g, '-')}_${Date.now()}.pdf`
      const filePath = path.join(this.DELIVERY_ACTS_DIR, fileName)
      const relativePath = `/uploads/delivery-acts/${fileName}`

      // Guardar PDF
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath)
        doc.pipe(writeStream)
        doc.end()

        writeStream.on('finish', () => resolve())
        writeStream.on('error', reject)
      })

      // Actualizar acta con la ruta del PDF
      await prisma.delivery_acts.update({
        where: { id: actId },
        data: { pdfPath: relativePath }
      })

      return relativePath
    } catch (error) {
      console.error('Error generando PDF de acta de entrega:', error)
      throw error
    }
  }

  /**
   * Genera el PDF de un acta de devolución
   */
  static async generateReturnActPDF(actId: string): Promise<string> {
    try {
      // Asegurar que los directorios existan
      await this.ensureDirectories()

      // Obtener el acta
      const act = await prisma.return_acts.findUnique({
        where: { id: actId },
        include: {
          assignment: {
            include: {
              equipment: true,
              receiver: true,
              deliverer: true,
            }
          }
        }
      })

      if (!act) {
        throw new Error('Acta de devolución no encontrada')
      }

      // Generar QR code para verificación
      const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/inventory/return-acts/${actId}/verify`
      const qrCodeDataUrl = await QRCodeService.generateQRCode(verificationUrl)

      // Generar PDF
      const doc = await generateReturnActPDF(act, qrCodeDataUrl)

      // Nombre del archivo
      const fileName = `${act.folio.replace(/\//g, '-')}_${Date.now()}.pdf`
      const filePath = path.join(this.RETURN_ACTS_DIR, fileName)
      const relativePath = `/uploads/return-acts/${fileName}`

      // Guardar PDF
      await new Promise<void>((resolve, reject) => {
        const writeStream = fs.createWriteStream(filePath)
        doc.pipe(writeStream)
        doc.end()

        writeStream.on('finish', () => resolve())
        writeStream.on('error', reject)
      })

      // Actualizar acta con la ruta del PDF
      await prisma.return_acts.update({
        where: { id: actId },
        data: { pdfPath: relativePath }
      })

      return relativePath
    } catch (error) {
      console.error('Error generando PDF de acta de devolución:', error)
      throw error
    }
  }

  /**
   * Regenera el PDF de un acta de entrega
   * Útil si el PDF se perdió o necesita actualizarse
   */
  static async regenerateDeliveryActPDF(actId: string): Promise<string> {
    try {
      // Eliminar PDF anterior si existe
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        select: { pdfPath: true }
      })

      if (act?.pdfPath) {
        const oldFilePath = path.join(process.cwd(), 'public', act.pdfPath)
        try {
          await promisify(fs.unlink)(oldFilePath)
        } catch (error) {
          // Ignorar si el archivo no existe
          console.warn('No se pudo eliminar el PDF anterior:', error)
        }
      }

      // Generar nuevo PDF
      return await this.generateDeliveryActPDF(actId)
    } catch (error) {
      console.error('Error regenerando PDF:', error)
      throw error
    }
  }

  /**
   * Obtiene la ruta del PDF de un acta de entrega
   */
  static async getDeliveryActPDFPath(actId: string): Promise<string | null> {
    try {
      const act = await prisma.delivery_acts.findUnique({
        where: { id: actId },
        select: { pdfPath: true }
      })

      return act?.pdfPath || null
    } catch (error) {
      console.error('Error obteniendo ruta del PDF:', error)
      throw error
    }
  }

  /**
   * Obtiene la ruta del PDF de un acta de devolución
   */
  static async getReturnActPDFPath(actId: string): Promise<string | null> {
    try {
      const act = await prisma.return_acts.findUnique({
        where: { id: actId },
        select: { pdfPath: true }
      })

      return act?.pdfPath || null
    } catch (error) {
      console.error('Error obteniendo ruta del PDF:', error)
      throw error
    }
  }

  /**
   * Verifica si un PDF existe en el sistema de archivos
   */
  static async pdfExists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(process.cwd(), 'public', relativePath)
      await promisify(fs.access)(fullPath, fs.constants.F_OK)
      return true
    } catch {
      return false
    }
  }
}
