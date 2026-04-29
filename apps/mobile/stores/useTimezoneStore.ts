import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@travelapp/timezone'

interface TimezoneState {
  activeTimezone: string | null
  originTimezone: string | null
}

interface TimezoneActions {
  setTimezone: (tz: string) => void
  setOriginTimezone: (tz: string) => void
  reset: () => void
  // Carga la preferencia guardada — llamar en app layout al montar
  loadFromStorage: () => Promise<void>
}

type TimezoneStore = TimezoneState & TimezoneActions

export const useTimezoneStore = create<TimezoneStore>((set) => ({
  activeTimezone: null,
  originTimezone: null,

  setTimezone: (tz) => {
    set({ activeTimezone: tz })
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ tz })).catch(() => {})
  },

  setOriginTimezone: (tz) => set({ originTimezone: tz }),

  reset: () => {
    set({ activeTimezone: null, originTimezone: null })
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
  },

  loadFromStorage: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { tz: string }
        if (parsed.tz) set({ activeTimezone: parsed.tz })
      }
    } catch {
      // Si falla la lectura, el estado por defecto es null — no es crítico
    }
  },
}))
