const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{}'
const ALL_CHARS = LOWERCASE + UPPERCASE + DIGITS + SYMBOLS

function randomIndex(max: number): number {
  const array = new Uint32Array(1)
  crypto.getRandomValues(array)
  return array[0] % max
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Genera una contraseña aleatoria (Web Crypto, no Math.random) garantizando
 * al menos un carácter de cada categoría: minúscula, mayúscula, dígito y símbolo.
 */
export function generatePassword(length: number): string {
  const len = Math.max(length, 4)
  const required = [LOWERCASE, UPPERCASE, DIGITS, SYMBOLS].map(
    charset => charset[randomIndex(charset.length)]
  )

  const chars = [...required]
  while (chars.length < len) {
    chars.push(ALL_CHARS[randomIndex(ALL_CHARS.length)])
  }

  return shuffle(chars).join('')
}
