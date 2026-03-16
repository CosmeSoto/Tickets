import crypto from 'crypto'

/**
 * Servicio para encriptación/desencriptación de datos sensibles
 * Usa AES-256-GCM para encriptación segura
 */
export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly IV_LENGTH = 16
  private static readonly AUTH_TAG_LENGTH = 16
  private static readonly SALT_LENGTH = 64

  /**
   * Obtiene la clave de encriptación desde variables de entorno
   * Si no existe, genera una advertencia (en producción debe estar configurada)
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY
    
    if (!key) {
      console.warn('⚠️ ENCRYPTION_KEY no configurada. Usando clave por defecto (NO SEGURO EN PRODUCCIÓN)')
      // Clave por defecto solo para desarrollo
      return crypto.scryptSync('default-dev-key-change-in-production', 'salt', 32)
    }

    // Derivar clave de 32 bytes desde la clave configurada
    return crypto.scryptSync(key, 'salt', 32)
  }

  /**
   * Encripta un texto usando AES-256-GCM
   * @param text Texto a encriptar
   * @returns Texto encriptado en formato: iv:authTag:encrypted
   */
  static encrypt(text: string): string {
    try {
      const key = this.getEncryptionKey()
      const iv = crypto.randomBytes(this.IV_LENGTH)
      
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)
      
      let encrypted = cipher.update(text, 'utf8', 'hex')
      encrypted += cipher.final('hex')
      
      const authTag = cipher.getAuthTag()
      
      // Formato: iv:authTag:encrypted
      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
    } catch (error) {
      console.error('Error encriptando:', error)
      throw new Error('Error al encriptar datos')
    }
  }

  /**
   * Desencripta un texto encriptado con AES-256-GCM
   * @param encryptedText Texto encriptado en formato: iv:authTag:encrypted
   * @returns Texto desencriptado
   */
  static decrypt(encryptedText: string): string {
    try {
      const key = this.getEncryptionKey()
      const parts = encryptedText.split(':')
      
      if (parts.length !== 3) {
        throw new Error('Formato de texto encriptado inválido')
      }
      
      const iv = Buffer.from(parts[0], 'hex')
      const authTag = Buffer.from(parts[1], 'hex')
      const encrypted = parts[2]
      
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)
      decipher.setAuthTag(authTag)
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      
      return decrypted
    } catch (error) {
      console.error('Error desencriptando:', error)
      throw new Error('Error al desencriptar datos')
    }
  }

  /**
   * Enmascara una clave mostrando solo los primeros y últimos caracteres
   * @param key Clave a enmascarar
   * @param visibleChars Número de caracteres visibles al inicio y final
   * @returns Clave enmascarada
   */
  static maskKey(key: string, visibleChars: number = 4): string {
    if (key.length <= visibleChars * 2) {
      return '*'.repeat(key.length)
    }
    
    const start = key.substring(0, visibleChars)
    const end = key.substring(key.length - visibleChars)
    const middle = '*'.repeat(key.length - (visibleChars * 2))
    
    return `${start}${middle}${end}`
  }

  /**
   * Genera un hash SHA-256 de un texto
   * @param text Texto a hashear
   * @returns Hash en formato hexadecimal
   */
  static hash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex')
  }

  /**
   * Verifica si un texto encriptado es válido
   * @param encryptedText Texto encriptado a verificar
   * @returns true si el formato es válido
   */
  static isValidEncryptedFormat(encryptedText: string): boolean {
    const parts = encryptedText.split(':')
    return parts.length === 3 && 
           parts[0].length === this.IV_LENGTH * 2 &&
           parts[1].length === this.AUTH_TAG_LENGTH * 2
  }
}
