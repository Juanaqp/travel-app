import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// En SSR (Expo Router web server), Platform.OS === 'web' y window no existe.
// AsyncStorage accede a window en su inicialización, lo que rompe el SSR.
// Pasamos undefined para que Supabase use storage en memoria durante SSR.
const isSSR = Platform.OS === 'web' && typeof window === 'undefined'

// Cliente Supabase singleton — única instancia del proyecto
// En nativo y web browser: persiste la sesión en AsyncStorage
// En SSR: sin persistencia (el cliente se rehidrata en el browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isSSR ? undefined : AsyncStorage,
    autoRefreshToken: !isSSR,
    persistSession: !isSSR,
    detectSessionInUrl: false,
  },
})
