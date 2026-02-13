import crypto from 'crypto'

// Usar una clave de encriptación desde variables de entorno
// Si no existe, generar una por defecto (NO RECOMENDADO PARA PRODUCCIÓN)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-change-in-production-32'
const ALGORITHM = 'aes-256-cbc'

// Asegurar que la clave tenga 32 bytes
const getKey = (): Buffer => {
  const key = ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)
  return Buffer.from(key, 'utf-8')
}

/**
 * Encripta un texto usando AES-256-CBC
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Retornar IV + encrypted data
    return iv.toString('hex') + ':' + encrypted
  } catch (error) {
    console.error('Error encrypting:', error)
    throw new Error('Error al encriptar datos')
  }
}

/**
 * Desencripta un texto encriptado con AES-256-CBC
 */
export function decrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':')
    if (parts.length !== 2) {
      throw new Error('Formato de datos encriptados inválido')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const encrypted = parts[1]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Error decrypting:', error)
    throw new Error('Error al desencriptar datos')
  }
}

/**
 * Genera una clave de encriptación segura
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64')
}

/**
 * Valida si un texto está encriptado correctamente
 */
export function isEncrypted(text: string): boolean {
  try {
    const parts = text.split(':')
    return parts.length === 2 && parts[0].length === 32 && parts[1].length > 0
  } catch {
    return false
  }
}
