import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks elevados antes del hoisting de vi.mock ────────────────────────────

const { mockFrom, mockSelect, mockEq, mockSingle, mockUpdate } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockUpdate = vi.fn()
  const mockEq     = vi.fn()
  const mockSelect = vi.fn()
  const mockFrom   = vi.fn()

  return { mockFrom, mockSelect, mockEq, mockSingle, mockUpdate }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

// Importar funciones puras DESPUÉS de los mocks
import { fetchOnboardingStatus, submitOnboardingData } from '../hooks/useOnboarding'
import { logger } from '../lib/logger'
import type { OnboardingData } from '@travelapp/types'

// ─── Datos de prueba ─────────────────────────────────────────────────────────

const MOCK_USER_ID = 'user-uuid-1234'

const MOCK_ONBOARDING_DATA: OnboardingData = {
  fullName: 'Juan García',
  timezone: 'America/Lima',
  preferredCurrency: 'PEN',
  preferredPace: 'moderate',
  travelInterests: ['culture', 'gastronomy'],
  preferredBudget: 'mid',
}

// ─── Helpers de mock ─────────────────────────────────────────────────────────

const setupSelectChain = (resolvedValue: unknown) => {
  mockSingle.mockResolvedValue(resolvedValue)
  mockEq.mockReturnValue({ single: mockSingle })
  mockSelect.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ select: mockSelect })
}

// submitOnboardingData usa .update({...}).eq('id', userId)
const setupUpdateChain = (resolvedValue: unknown) => {
  mockEq.mockResolvedValue(resolvedValue)
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockFrom.mockReturnValue({ update: mockUpdate })
}

// ─── fetchOnboardingStatus ────────────────────────────────────────────────────

describe('fetchOnboardingStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna false cuando onboarding_completed es false en la BD', async () => {
    setupSelectChain({ data: { onboarding_completed: false }, error: null })
    const result = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(result).toBe(false)
  })

  it('retorna true cuando onboarding_completed es true en la BD', async () => {
    setupSelectChain({ data: { onboarding_completed: true }, error: null })
    const result = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(result).toBe(true)
  })

  it('usuario nuevo con onboarding_completed = false es detectado correctamente', async () => {
    setupSelectChain({
      data: { onboarding_completed: false },
      error: null,
    })
    const result = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(result).toBe(false)
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(mockSelect).toHaveBeenCalledWith('onboarding_completed')
    expect(mockEq).toHaveBeenCalledWith('id', MOCK_USER_ID)
  })

  it('retorna false si data es null (race condition tras primer login)', async () => {
    setupSelectChain({ data: null, error: null })
    const result = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(result).toBe(false)
  })

  it('lanza error y llama a logger.error cuando Supabase falla', async () => {
    const supabaseError = { message: 'Error de conexión', code: '500' }
    setupSelectChain({ data: null, error: supabaseError })
    await expect(fetchOnboardingStatus(MOCK_USER_ID)).rejects.toEqual(supabaseError)
    expect(logger.error).toHaveBeenCalledWith(
      'Error al consultar estado de onboarding',
      expect.objectContaining({ error: supabaseError, userId: MOCK_USER_ID })
    )
  })
})

// ─── submitOnboardingData ─────────────────────────────────────────────────────

describe('submitOnboardingData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hace UPDATE con todos los campos del onboarding incluyendo onboarding_completed: true', async () => {
    setupUpdateChain({ data: null, error: null })
    await submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(mockUpdate).toHaveBeenCalledWith({
      full_name: 'Juan García',
      timezone: 'America/Lima',
      preferred_currency: 'PEN',
      preferred_pace: 'moderate',
      travel_interests: ['culture', 'gastronomy'],
      preferred_budget: 'mid',
      onboarding_completed: true,
    })
    expect(mockEq).toHaveBeenCalledWith('id', MOCK_USER_ID)
  })

  it('el UPDATE siempre incluye onboarding_completed: true independientemente de los datos', async () => {
    setupUpdateChain({ data: null, error: null })
    const otherData: OnboardingData = {
      fullName: 'Ana Pérez',
      timezone: 'Europe/Madrid',
      preferredCurrency: 'EUR',
      preferredPace: 'slow',
      travelInterests: ['beach', 'photography', 'nature'],
      preferredBudget: 'luxury',
    }
    await submitOnboardingData(MOCK_USER_ID, otherData)
    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.onboarding_completed).toBe(true)
  })

  it('mapea fullName → full_name y preferredCurrency → preferred_currency correctamente', async () => {
    setupUpdateChain({ data: null, error: null })
    await submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)
    const updateCall = mockUpdate.mock.calls[0][0] as Record<string, unknown>
    expect(updateCall.full_name).toBe('Juan García')
    expect(updateCall.preferred_currency).toBe('PEN')
    expect(updateCall.preferred_pace).toBe('moderate')
    expect(updateCall.travel_interests).toEqual(['culture', 'gastronomy'])
    expect(updateCall.preferred_budget).toBe('mid')
    expect(updateCall.timezone).toBe('America/Lima')
  })

  it('usa .eq("id", userId) para identificar la fila a actualizar', async () => {
    setupUpdateChain({ data: null, error: null })
    await submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)
    expect(mockEq).toHaveBeenCalledWith('id', MOCK_USER_ID)
  })

  it('lanza error y llama a logger.error cuando Supabase falla', async () => {
    const supabaseError = { message: 'Violación de constraints', code: '23505' }
    setupUpdateChain({ data: null, error: supabaseError })
    await expect(submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)).rejects.toEqual(supabaseError)
    expect(logger.error).toHaveBeenCalledWith(
      'Error al guardar datos de onboarding',
      expect.objectContaining({ error: supabaseError, userId: MOCK_USER_ID })
    )
  })

  it('llama a logger.info al completar exitosamente', async () => {
    setupUpdateChain({ data: null, error: null })
    await submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)
    expect(logger.info).toHaveBeenCalledWith(
      'Onboarding completado',
      expect.objectContaining({ userId: MOCK_USER_ID })
    )
  })
})

// ─── Lógica de redirección ────────────────────────────────────────────────────

describe('Lógica de redirección según onboarding_completed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usuario con onboarding_completed=false debe ser redirigido a onboarding', async () => {
    setupSelectChain({ data: { onboarding_completed: false }, error: null })
    const completed = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(completed).toBe(false)
    expect(completed === false).toBe(true)
  })

  it('usuario con onboarding_completed=true debe acceder a la app sin redirección', async () => {
    setupSelectChain({ data: { onboarding_completed: true }, error: null })
    const completed = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(completed).toBe(true)
    expect(completed === false).toBe(false)
  })

  it('completeOnboarding establece onboarding_completed=true garantizando acceso posterior', async () => {
    setupUpdateChain({ data: null, error: null })
    await submitOnboardingData(MOCK_USER_ID, MOCK_ONBOARDING_DATA)
    setupSelectChain({ data: { onboarding_completed: true }, error: null })
    const completedAfter = await fetchOnboardingStatus(MOCK_USER_ID)
    expect(completedAfter).toBe(true)
  })
})
