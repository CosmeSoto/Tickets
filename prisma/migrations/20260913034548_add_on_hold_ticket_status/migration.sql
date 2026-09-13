-- El estado "En Espera" (ON_HOLD) ya estaba implementado en toda la UI y la
-- API (botón "Poner en espera", colores, reglas de transición, reportes,
-- traducciones) pero nunca se agregó al enum real de la base de datos,
-- causando un 500 ("Invalid value for argument `status`. Expected
-- TicketStatus.") cada vez que alguien intentaba usarlo.
ALTER TYPE "TicketStatus" ADD VALUE 'ON_HOLD';
