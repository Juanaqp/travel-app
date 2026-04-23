import { View, Text, Pressable } from 'react-native'

// Pantalla de login — autenticación por Magic Link (Fase 3)
export default function LoginScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-900 px-6">
      <Text className="mb-2 text-4xl font-bold text-white">TravelApp</Text>
      <Text className="mb-12 text-base text-slate-400">
        Planifica tus viajes con inteligencia artificial
      </Text>

      <Pressable className="w-full rounded-xl bg-indigo-500 py-4 active:bg-indigo-600">
        <Text className="text-center text-base font-semibold text-white">
          Continuar con email
        </Text>
      </Pressable>

      <Text className="mt-4 text-sm text-slate-500">
        Te enviaremos un enlace mágico, sin contraseña
      </Text>
    </View>
  )
}
