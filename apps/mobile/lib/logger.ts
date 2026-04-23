// Wrapper sobre Sentry — nunca usar console.log directamente en la app
// Fase 9: reemplazar stubs de Sentry por implementación real

const isDev = process.env.NODE_ENV === 'development'

// Stub de Sentry — se reemplaza en Fase 9 con la integración real
const Sentry = {
  addBreadcrumb: (_opts: { message: string; data?: Record<string, unknown>; level: string }) => {},
  captureMessage: (_message: string, _opts: { level: string; extra?: Record<string, unknown> }) => {},
  captureException: (_error: unknown, _opts: { extra?: Record<string, unknown> }) => {},
}

export const logger = {
  info: (message: string, context?: Record<string, unknown>): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[TravelApp] INFO: ${message}`, context ?? '')
    } else {
      Sentry.addBreadcrumb({ message, data: context, level: 'info' })
    }
  },

  warn: (message: string, context?: Record<string, unknown>): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[TravelApp] WARN: ${message}`, context ?? '')
    } else {
      Sentry.captureMessage(message, { level: 'warning', extra: context })
    }
  },

  error: (message: string, context?: Record<string, unknown>): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[TravelApp] ERROR: ${message}`, context ?? '')
    } else {
      Sentry.captureException(context?.error, { extra: { message, ...context } })
    }
  },

  debug: (message: string, context?: Record<string, unknown>): void => {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.log(`[TravelApp] DEBUG: ${message}`, context ?? '')
    }
  },
}
