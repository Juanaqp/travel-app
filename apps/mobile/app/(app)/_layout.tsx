import { Redirect, Stack } from 'expo-router'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// Protección de ruta — redirige a login si no hay sesión activa
export default function AppLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Obtener sesión almacenada al montar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setIsLoading(false)
    })

    // Escuchar cambios de estado de autenticación (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isLoading) return null

  if (!session) {
    return <Redirect href="/(auth)" />
  }

  return <Stack screenOptions={{ headerShown: false }} />
}
