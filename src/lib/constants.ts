/**
 * Constantes globales del sistema.
 *
 * Para el timezone: por ahora es una constante estática. En el futuro se puede
 * leer desde system_settings o user_settings para soporte multi-timezone.
 * Centralizado aquí para facilitar el cambio en un solo lugar.
 */

/** Timezone por defecto del sistema (configurable en el futuro) */
export const DEFAULT_TIMEZONE = 'America/Guayaquil'

/** Locale por defecto para formateo de fechas */
export const DEFAULT_LOCALE = 'es-EC'

/** Idioma por defecto del sistema */
export const DEFAULT_LANGUAGE = 'es'
