import { View, Text } from 'react-native'

// Tab Mis Viajes — pantalla principal de la app
export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-slate-900">
      <Text className="text-3xl font-bold text-white">TravelApp</Text>
      <Text className="mt-2 text-base text-slate-400">Mis Viajes</Text>
    </View>
  )
}
