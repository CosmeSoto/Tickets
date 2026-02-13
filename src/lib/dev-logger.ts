/**
 * Utilidad de logging para desarrollo que respeta el nivel de log configurado
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE'

const LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'INFO'

const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL]
}

export const devLogger = {
  debug: (message: string, ...args: any[]) => {
    if (shouldLog('DEBUG')) {
      console.log(`🔍 ${message}`, ...args)
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (shouldLog('INFO')) {
      console.log(`ℹ️ ${message}`, ...args)
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (shouldLog('WARN')) {
      console.warn(`⚠️ ${message}`, ...args)
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (shouldLog('ERROR')) {
      console.error(`❌ ${message}`, ...args)
    }
  },
  
  success: (message: string, ...args: any[]) => {
    if (shouldLog('INFO')) {
      console.log(`✅ ${message}`, ...args)
    }
  }
}