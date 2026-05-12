/**
 * Servicio de generación y validación de tokens QR para checkpoints de patrulla.
 *
 * Seguridad:
 * - Tokens HMAC-SHA256 con ventana de tiempo rotante (QR dinámico)
 * - Token estático firmado para zonas sin conectividad (QR estático)
 * - Comparación en tiempo constante (timingSafeEqual) para prevenir timing attacks
 * - qrSecret NUNCA se expone en respuestas de API
 */

import { createHmac, randomBytes, timingSafeEqual, createHash } from 'crypto'
import QRCode from 'qrcode'

export class PatrolQRService {
  // ── Token dinámico ──────────────────────────────────────────────────────────

  /**
   * Genera el token HMAC-SHA256 para una ventana de tiempo dada.
   *
   * @param secret         - Secreto del checkpoint (hex, 32 bytes)
   * @param windowIndex    - Índice de ventana: floor(unixSeconds / windowSeconds)
   * @returns Token hex de 32 caracteres
   */
  static generateToken(secret: string, windowIndex: number): string {
    return createHmac('sha256', secret).update(String(windowIndex)).digest('hex').slice(0, 32)
  }

  /**
   * Valida un token QR dinámico.
   * Acepta la ventana actual y la inmediatamente anterior (tolerancia de borde).
   *
   * @param token          - Token enviado por el guardia
   * @param secret         - Secreto del checkpoint
   * @param qrWindowMinutes - Duración de cada ventana en minutos
   * @param nowMs          - Timestamp actual en milisegundos (inyectable para tests)
   * @returns true si el token es válido
   */
  static validateToken(
    token: string,
    secret: string,
    qrWindowMinutes: number,
    nowMs: number = Date.now()
  ): boolean {
    const windowSeconds = qrWindowMinutes * 60
    const currentWindow = Math.floor(nowMs / 1000 / windowSeconds)

    // Aceptar ventana actual y la inmediatamente anterior
    const windowsToCheck = [currentWindow, currentWindow - 1]

    for (const windowIndex of windowsToCheck) {
      const expected = this.generateToken(secret, windowIndex)
      try {
        const tokenBuf = Buffer.from(token.padEnd(expected.length, '\0').slice(0, expected.length))
        const expectedBuf = Buffer.from(expected)
        if (tokenBuf.length === expectedBuf.length && timingSafeEqual(tokenBuf, expectedBuf)) {
          return true
        }
      } catch {
        // Buffer de longitud diferente — token inválido
      }
    }

    return false
  }

  /**
   * Valida el token de un checkpoint con QR estático (comparación en tiempo constante).
   * El valor escaneado debe coincidir exactamente con `qrStaticToken` almacenado.
   */
  static validateStaticToken(token: string, staticToken: string | null | undefined): boolean {
    if (!staticToken || !token) return false
    try {
      const a = Buffer.from(token, 'utf8')
      const b = Buffer.from(staticToken, 'utf8')
      if (a.length !== b.length) return false
      return timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  // ── Generación de secretos ──────────────────────────────────────────────────

  /**
   * Genera un nuevo secreto criptográficamente seguro para un checkpoint.
   * @returns Hex string de 64 caracteres (32 bytes)
   */
  static generateSecret(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * Genera un token estático para checkpoints sin conectividad.
   * El token es un UUID aleatorio en formato hex compacto.
   * @returns Hex string de 32 caracteres
   */
  static generateStaticToken(): string {
    return randomBytes(16).toString('hex')
  }

  // ── Hash para almacenamiento ────────────────────────────────────────────────

  /**
   * Genera el hash SHA-256 de un token para almacenamiento seguro.
   * El token raw NUNCA se almacena en la base de datos.
   *
   * @param token - Token a hashear
   * @returns SHA-256 hex del token
   */
  static hashTokenForStorage(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  // ── Generación de imagen QR ─────────────────────────────────────────────────

  /**
   * Genera una imagen PNG del código QR para un checkpoint.
   * El payload incluye checkpointId y el token (dinámico o estático).
   *
   * @param checkpointId   - ID del checkpoint
   * @param token          - Token a codificar en el QR
   * @returns Buffer PNG listo para enviar como respuesta HTTP
   */
  static async generateQRImage(checkpointId: string, token: string): Promise<Buffer> {
    const payload = JSON.stringify({ cid: checkpointId, t: token })
    return QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    })
  }
}
