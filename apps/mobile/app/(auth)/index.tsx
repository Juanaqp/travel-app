import { useState } from 'react'
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuthStore } from '@/stores/useAuthStore'

// Pantalla de login con Magic Link — sin contraseña
export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { signInWithEmail, isLoading } = useAuthStore()

  const isEmailValid = email.trim().includes('@')
  const isDisabled = isLoading || !isEmailValid

  const handleSend = async () => {
    setErrorMessage(null)
    try {
      await signInWithEmail(email.trim().toLowerCase())
      setSent(true)
    } catch {
      setErrorMessage('No pudimos enviar el enlace. Verifica el email e inténtalo de nuevo.')
    }
  }

  // Pantalla de confirmación tras enviar el enlace
  if (sent) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-900 px-6">
        <Text className="mb-6 text-6xl">✉️</Text>
        <Text className="mb-3 text-center text-2xl font-bold text-white">
          Revisa tu email
        </Text>
        <Text className="mb-2 text-center text-base text-slate-400">
          Enviamos un enlace mágico a:
        </Text>
        <Text className="mb-10 text-center text-base font-medium text-indigo-400">
          {email.trim().toLowerCase()}
        </Text>
        <Text className="mb-10 text-center text-sm text-slate-500">
          Toca el enlace del email para entrar a la app.{'\n'}
          Puede tardar unos segundos en llegar.
        </Text>
        <Pressable
          onPress={() => { setSent(false); setEmail('') }}
          className="rounded-xl border border-slate-700 px-6 py-3 active:bg-slate-800"
        >
          <Text className="text-sm font-medium text-slate-400">
            Usar otro email
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-900"
    >
      <View className="flex-1 items-center justify-center px-6">
        {/* Cabecera */}
        <Text className="mb-2 text-4xl font-bold text-white">TravelApp</Text>
        <Text className="mb-12 text-center text-base text-slate-400">
          Planifica tus viajes con inteligencia artificial
        </Text>

        {/* Campo de email */}
        <TextInput
          className="mb-3 w-full rounded-xl bg-slate-800 px-4 py-4 text-base text-white"
          placeholder="tu@email.com"
          placeholderTextColor="#64748B"
          value={email}
          onChangeText={(text) => { setEmail(text); setErrorMessage(null) }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          returnKeyType="send"
          onSubmitEditing={isDisabled ? undefined : handleSend}
          editable={!isLoading}
        />

        {/* Mensaje de error inline */}
        {errorMessage !== null && (
          <Text className="mb-3 w-full text-sm text-red-400">
            {errorMessage}
          </Text>
        )}

        {/* Botón principal */}
        <Pressable
          onPress={handleSend}
          disabled={isDisabled}
          className={`w-full rounded-xl bg-indigo-500 py-4 active:bg-indigo-600 ${isDisabled ? 'opacity-50' : ''}`}
        >
          <Text className="text-center text-base font-semibold text-white">
            {isLoading ? 'Enviando...' : 'Enviar enlace mágico'}
          </Text>
        </Pressable>

        <Text className="mt-4 text-sm text-slate-500">
          Sin contraseña — acceso instantáneo por email
        </Text>
      </View>
    </KeyboardAvoidingView>
  )
}
