import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted crea variables ANTES de que vi.mock sea elevado al top del archivo.
// Sin esto, los const declarados después de vi.mock no están inicializados cuando
// la factory del mock intenta usarlos → ReferenceError.
const { mockSignInWithOtp, mockSignOut, mockOnAuthStateChange } = vi.hoisted(() => ({
  mockSignInWithOtp: vi.fn(),
  mockSignOut: vi.fn(),
  mockOnAuthStateChange: vi.fn(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  })),
}))

vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}))

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() },
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: mockSignInWithOtp,
      signOut: mockSignOut,
      onAuthStateChange: mockOnAuthStateChange,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Importar el store DESPUÉS de los mocks para que usen las versiones mockeadas
import { useAuthStore } from '../stores/useAuthStore'

// Resetea el estado del store entre tests para evitar contaminación
beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({
    user: null,
    session: null,
    isLoading: false,
    isInitialized: false,
  })
  // Restaura onAuthStateChange al mock por defecto
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  })
})

describe('useAuthStore — estado inicial', () => {
  it('tiene el estado inicial correcto', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.session).toBeNull()
    expect(state.isLoading).toBe(false)
    expect(state.isInitialized).toBe(false)
  })
})

describe('useAuthStore — initialize', () => {
  it('llama a supabase.auth.onAuthStateChange al inicializar', () => {
    const cleanup = useAuthStore.getState().initialize()
    expect(mockOnAuthStateChange).toHaveBeenCalledTimes(1)
    cleanup()
  })

  it('retorna una función de limpieza que llama a unsubscribe', () => {
    const mockUnsubscribe = vi.fn()
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })

    const cleanup = useAuthStore.getState().initialize()
    cleanup()
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('useAuthStore — signInWithEmail', () => {
  it('llama a supabase.auth.signInWithOtp con el email correcto', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })

    await useAuthStore.getState().signInWithEmail('test@example.com')

    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { emailRedirectTo: 'travelapp://' },
    })
  })

  it('restablece isLoading a false tras el envío exitoso', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null })

    await useAuthStore.getState().signInWithEmail('test@example.com')

    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('lanza el error y restablece isLoading si Supabase falla', async () => {
    const supabaseError = new Error('Rate limit exceeded')
    mockSignInWithOtp.mockResolvedValue({ data: null, error: supabaseError })

    await expect(
      useAuthStore.getState().signInWithEmail('test@example.com')
    ).rejects.toThrow('Rate limit exceeded')

    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})

describe('useAuthStore — signOut', () => {
  it('llama a supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    await useAuthStore.getState().signOut()

    expect(mockSignOut).toHaveBeenCalledTimes(1)
  })

  it('restablece isLoading a false tras el cierre de sesión exitoso', async () => {
    mockSignOut.mockResolvedValue({ error: null })

    await useAuthStore.getState().signOut()

    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('lanza el error y restablece isLoading si Supabase falla', async () => {
    const supabaseError = new Error('Network error')
    mockSignOut.mockResolvedValue({ error: supabaseError })

    await expect(useAuthStore.getState().signOut()).rejects.toThrow('Network error')

    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
