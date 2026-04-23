import { describe, it, expect } from 'vitest'

// Test de verificación de la configuración de Vitest
describe('Configuración de Vitest', () => {
  it('debe ejecutarse correctamente', () => {
    expect(1 + 1).toBe(2)
  })

  it('debe manejar strings correctamente', () => {
    const appName = 'TravelApp'
    expect(appName).toBe('TravelApp')
  })
})
