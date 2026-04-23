import { describe, it, expect, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { logger } from '../lib/logger'

// Mocks necesarios para módulos nativos que no existen en entorno Node
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
}))

describe('Configuración inicial del proyecto', () => {
  it('el cliente Supabase se instancia sin errores', () => {
    // Verifica que el cliente se creó correctamente con auth disponible
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })

  it('logger.info no lanza excepción', () => {
    // Verifica que el logger funciona correctamente con y sin contexto
    expect(() => logger.info('test de inicio')).not.toThrow()
    expect(() => logger.info('test con contexto', { userId: 'test-123' })).not.toThrow()
  })
})
