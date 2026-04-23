import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { logger } from '@/lib/logger'

// Deep link del Magic Link — debe coincidir con additional_redirect_urls en config.toml
const MAGIC_LINK_REDIRECT = 'travelapp://'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  // true cuando el primer evento de onAuthStateChange fue procesado
  isInitialized: boolean
}

interface AuthActions {
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
  // Configura el listener de auth y retorna la función de limpieza
  initialize: () => () => void
}

type AuthStore = AuthState & AuthActions

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  isInitialized: false,

  initialize: () => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isInitialized: true,
      })
    })

    // El caller (root layout) llama al cleanup al desmontar
    return () => subscription.unsubscribe()
  },

  signInWithEmail: async (email: string) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: MAGIC_LINK_REDIRECT },
      })
      if (error) throw error
      logger.info('Magic Link enviado', { email })
    } catch (error) {
      logger.error('Error al enviar Magic Link', { error, email })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    set({ isLoading: true })
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      logger.info('Sesión cerrada correctamente')
    } catch (error) {
      logger.error('Error al cerrar sesión', { error })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },
}))
