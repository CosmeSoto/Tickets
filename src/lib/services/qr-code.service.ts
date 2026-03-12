import QRCode from 'qrcode'
import { randomUUID } from 'crypto'

/**
 * Servicio para generación de códigos QR
 */
export class QRCodeService {
  /**
   * Genera un código QR único para un equipo
   * @param equipmentId ID del equipo
   * @param equipmentCode Código del equipo
   * @returns Código QR como string base64
   */
  static async generateEquipmentQR(
    equipmentId: string,
    equipmentCode: string
  ): Promise<string> {
    try {
      // Generar URL de verificación del equipo
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const verificationUrl = `${baseUrl}/inventory/equipment/${equipmentId}/verify`
      
      // Datos del QR: URL + código del equipo
      const qrData = JSON.stringify({
        type: 'equipment',
        id: equipmentId,
        code: equipmentCode,
        url: verificationUrl,
        timestamp: new Date().toISOString()
      })
      
      // Generar QR code como base64
      const qrCodeBase64 = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      return qrCodeBase64
    } catch (error) {
      console.error('Error generando QR de equipo:', error)
      throw new Error('No se pudo generar el código QR del equipo')
    }
  }

  /**
   * Genera un código QR para verificación de acta
   * @param actId ID del acta
   * @param actFolio Folio del acta
   * @param verificationHash Hash de verificación
   * @returns Código QR como string base64
   */
  static async generateActVerificationQR(
    actId: string,
    actFolio: string,
    verificationHash: string
  ): Promise<string> {
    try {
      // Generar URL de verificación del acta
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const verificationUrl = `${baseUrl}/inventory/acts/${actId}/verify?hash=${verificationHash}`
      
      // Datos del QR: URL + folio + hash
      const qrData = JSON.stringify({
        type: 'act_verification',
        id: actId,
        folio: actFolio,
        hash: verificationHash,
        url: verificationUrl,
        timestamp: new Date().toISOString()
      })
      
      // Generar QR code como base64
      const qrCodeBase64 = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      
      return qrCodeBase64
    } catch (error) {
      console.error('Error generando QR de acta:', error)
      throw new Error('No se pudo generar el código QR del acta')
    }
  }

  /**
   * Genera un identificador único para QR
   * @param prefix Prefijo del identificador
   * @returns Identificador único
   */
  static generateUniqueQRId(prefix: string): string {
    const uuid = randomUUID()
    const timestamp = Date.now().toString(36)
    return `${prefix}-${timestamp}-${uuid.substring(0, 8)}`
  }

  /**
   * Valida que un string sea un QR code válido en base64
   * @param qrCode String del QR code
   * @returns true si es válido
   */
  static isValidQRCode(qrCode: string): boolean {
    try {
      // Verificar que sea base64 válido
      const base64Regex = /^data:image\/(png|jpeg|jpg);base64,/
      return base64Regex.test(qrCode)
    } catch {
      return false
    }
  }

  /**
   * Extrae datos de un QR code
   * @param qrData Datos del QR escaneado
   * @returns Objeto con los datos parseados
   */
  static parseQRData(qrData: string): any {
    try {
      return JSON.parse(qrData)
    } catch {
      throw new Error('Datos de QR inválidos')
    }
  }
}
