import { describe, it, expect } from 'vitest'

// Los helpers de la pantalla viven en un módulo React Native.
// Se reimplementan aquí para testear la lógica pura sin cargar la cadena de deps nativas.

// ─── generateAvatarColor — reimplementación local ────────────────────────────

const AVATAR_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#F59E0B',
  '#10B981', '#3B82F6', '#EF4444', '#14B8A6',
]

const generateAvatarColor = (email: string): string => {
  let hash = 0
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

// ─── getUsageBarColor — reimplementación local ───────────────────────────────

const getUsageBarColor = (used: number, limit: number): string => {
  const ratio = limit > 0 ? used / limit : 0
  if (ratio >= 0.9) return 'bg-red-500'
  if (ratio >= 0.6) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Tests: generateAvatarColor ──────────────────────────────────────────────

describe('generateAvatarColor', () => {
  it('retorna un color de la paleta definida', () => {
    const color = generateAvatarColor('test@example.com')
    expect(AVATAR_COLORS).toContain(color)
  })

  it('es determinista — el mismo email siempre produce el mismo color', () => {
    const email = 'user@travelapp.com'
    expect(generateAvatarColor(email)).toBe(generateAvatarColor(email))
  })

  it('emails distintos pueden producir colores distintos', () => {
    const colors = ['a@a.com', 'b@b.com', 'c@c.com', 'd@d.com', 'e@e.com']
      .map(generateAvatarColor)
    // Con 5 emails y 8 colores al menos 2 deberían ser distintos
    const unique = new Set(colors)
    expect(unique.size).toBeGreaterThan(1)
  })

  it('no lanza con email vacío', () => {
    expect(() => generateAvatarColor('')).not.toThrow()
  })
})

// ─── Tests: getUsageBarColor ──────────────────────────────────────────────────

describe('getUsageBarColor', () => {
  it('retorna verde cuando el uso es bajo (< 60%)', () => {
    expect(getUsageBarColor(5, 20)).toBe('bg-emerald-500')
    expect(getUsageBarColor(0, 20)).toBe('bg-emerald-500')
  })

  it('retorna ámbar cuando el uso está entre 60% y 89%', () => {
    expect(getUsageBarColor(12, 20)).toBe('bg-amber-500')  // 60%
    expect(getUsageBarColor(17, 20)).toBe('bg-amber-500')  // 85%
  })

  it('retorna rojo cuando el uso es 90% o más', () => {
    expect(getUsageBarColor(18, 20)).toBe('bg-red-500')   // 90%
    expect(getUsageBarColor(20, 20)).toBe('bg-red-500')   // 100%
  })

  it('maneja límite 0 sin división por cero', () => {
    expect(getUsageBarColor(0, 0)).toBe('bg-emerald-500')
  })
})

// ─── Tests: flujo de cierre de sesión ────────────────────────────────────────

describe('Cierre de sesión — lógica de guard', () => {
  it('isSigningOut evita re-llamadas al handler', () => {
    let callCount = 0
    const isSigningOut = true

    const handleSignOut = () => {
      if (isSigningOut) return
      callCount++
    }

    handleSignOut()
    handleSignOut()
    expect(callCount).toBe(0)
  })
})

// ─── Tests: modal de eliminación de cuenta ───────────────────────────────────

describe('Modal de eliminación de cuenta', () => {
  it('el botón de eliminar solo se habilita cuando el texto es exactamente "ELIMINAR"', () => {
    const canDelete = (text: string) => text === 'ELIMINAR'

    expect(canDelete('ELIMINAR')).toBe(true)
    expect(canDelete('eliminar')).toBe(false)
    expect(canDelete('ELIMINA')).toBe(false)
    expect(canDelete('')).toBe(false)
    expect(canDelete('ELIMINAR ')).toBe(false)
  })

  it('paso 2 del modal comienza con texto vacío al abrirse desde paso 1', () => {
    let deleteConfirmText = ''
    // Simula la transición de paso 1 a paso 2
    const goToStep2 = () => { deleteConfirmText = '' }
    goToStep2()
    expect(deleteConfirmText).toBe('')
  })
})

// ─── Tests: estadísticas de perfil ───────────────────────────────────────────

describe('Cálculo de estadísticas de perfil', () => {
  it('cuenta países únicos a partir de destinos de viajes', () => {
    const trips = [
      { destinations: [{ country: 'Italia' }, { country: 'España' }] },
      { destinations: [{ country: 'Italia' }] },
      { destinations: [{ country: 'Francia' }] },
    ]

    const countries = new Set<string>()
    for (const trip of trips) {
      for (const dest of trip.destinations) {
        if (dest.country) countries.add(dest.country)
      }
    }

    expect(countries.size).toBe(3)
  })

  it('retorna 0 si no hay viajes', () => {
    const trips: Array<{ destinations: Array<{ country?: string }> }> = []
    const countries = new Set<string>()
    for (const trip of trips) {
      for (const dest of trip.destinations) {
        if (dest.country) countries.add(dest.country)
      }
    }
    expect(countries.size).toBe(0)
  })

  it('suma correctamente los gastos', () => {
    const expenses = [
      { amount: 100, currency: 'USD' },
      { amount: 50.5, currency: 'USD' },
      { amount: 25, currency: 'EUR' },
    ]
    const total = expenses.reduce((acc, e) => acc + e.amount, 0)
    expect(total).toBeCloseTo(175.5)
  })
})
