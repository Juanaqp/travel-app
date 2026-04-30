// Store de preferencia de tema — persiste en AsyncStorage entre sesiones
// Usa patrón manual (sin zustand/middleware) porque Metro bundler no soporta
// el import.meta de ESM que usa zustand/middleware en web.

import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@roamly/theme-preference'

export type ThemePreference = 'light' | 'dark' | 'auto'

interface ThemeStoreState {
  preference: ThemePreference
}

interface ThemeStoreActions {
  setPreference: (p: ThemePreference) => void
  /** Carga la preferencia guardada — llamar en _layout.tsx al montar */
  loadFromStorage: () => Promise<void>
}

type ThemeStore = ThemeStoreState & ThemeStoreActions

export const useThemeStore = create<ThemeStore>((set) => ({
  /** Por defecto sigue el esquema del sistema operativo */
  preference: 'auto',

  setPreference: (p) => {
    set({ preference: p })
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {})
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw === 'light' || raw === 'dark' || raw === 'auto') {
        set({ preference: raw })
      }
    } catch {
      // Si falla la lectura, el valor por defecto 'auto' es seguro
    }
  },
}))
