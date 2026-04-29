import {
  View,
  Text,
  ScrollView,
  Pressable,
  ImageBackground,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { useDestinationInfo } from '@/hooks/useDestinationInfo'
import { useExploreStore } from '@/stores/useExploreStore'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { DESTINATION_META, GENERIC_TRAVEL_IMAGE } from '@/constants/destinations'
import type { DestinationInfo } from '@travelapp/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Meses del año en español
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

// Clasifica un mes como ideal (verde) o aceptable (ámbar) según su posición en la lista
const getMonthColor = (month: string, bestMonths: string[]): string => {
  const idx = bestMonths.indexOf(month)
  if (idx === -1) return 'bg-slate-700'
  return idx < Math.ceil(bestMonths.length / 2) ? 'bg-emerald-600' : 'bg-amber-600'
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface InfoCardProps {
  title: string
  children: React.ReactNode
}

const InfoCard = ({ title, children }: InfoCardProps) => (
  <View className="mb-3 rounded-2xl bg-slate-800 p-4">
    <Text className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
      {title}
    </Text>
    {children}
  </View>
)

const ContentSkeleton = () => (
  <View className="px-4 pt-4">
    <LoadingSkeleton count={4} height={80} />
  </View>
)

interface DestinationContentProps {
  info: DestinationInfo
}

const DestinationContent = ({ info }: DestinationContentProps) => (
  <View className="px-4 pb-32 pt-4">
    {/* Mejor época */}
    <InfoCard title="Mejor época para visitar">
      <View className="flex-row flex-wrap gap-2">
        {MONTHS_ES.filter((m) => info.best_months.includes(m)).map((month) => (
          <View key={month} className={`rounded-full px-3 py-1 ${getMonthColor(month, info.best_months)}`}>
            <Text className="text-xs font-medium text-white">{month}</Text>
          </View>
        ))}
        {info.best_months
          .filter((m) => !MONTHS_ES.includes(m))
          .map((month) => (
            <View key={month} className="rounded-full bg-emerald-600 px-3 py-1">
              <Text className="text-xs font-medium text-white">{month}</Text>
            </View>
          ))}
      </View>
    </InfoCard>

    {/* Presupuesto estimado */}
    <InfoCard title="Presupuesto estimado">
      <Text className="text-2xl font-bold text-white">
        ${info.avg_budget_per_day_usd}{' '}
        <Text className="text-base font-normal text-slate-400">USD / día</Text>
      </Text>
      <Text className="mt-1 text-xs text-slate-500">Valor aproximado — varía según alojamiento y estilo</Text>
    </InfoCard>

    {/* Días recomendados */}
    <InfoCard title="Días recomendados">
      <Text className="text-2xl font-bold text-white">
        {info.recommended_days}{' '}
        <Text className="text-base font-normal text-slate-400">
          {info.recommended_days === 1 ? 'día' : 'días'}
        </Text>
      </Text>
    </InfoCard>

    {/* Highlights */}
    <InfoCard title="Imprescindibles">
      {info.highlights.map((place) => (
        <View key={place} className="mb-2 flex-row items-start">
          <Text className="mr-2 mt-0.5">📍</Text>
          <Text className="flex-1 text-sm text-slate-200">{place}</Text>
        </View>
      ))}
    </InfoCard>

    {/* Gastronomía */}
    <InfoCard title="Gastronomía">
      {info.cuisine.map((dish) => (
        <View key={dish} className="mb-2 flex-row items-start">
          <Text className="mr-2 mt-0.5">🍽️</Text>
          <Text className="flex-1 text-sm text-slate-200">{dish}</Text>
        </View>
      ))}
    </InfoCard>

    {/* Consejos prácticos */}
    <InfoCard title="Consejos prácticos">
      {info.tips.map((tip) => (
        <View key={tip} className="mb-2 flex-row items-start">
          <Text className="mr-2 mt-0.5">💡</Text>
          <Text className="flex-1 text-sm text-slate-200">{tip}</Text>
        </View>
      ))}
    </InfoCard>

    {/* Info útil */}
    <InfoCard title="Info útil">
      <View className="gap-2">
        <View className="flex-row justify-between">
          <Text className="text-sm text-slate-400">Zona horaria</Text>
          <Text className="text-sm font-medium text-white">{info.timezone}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-slate-400">Moneda</Text>
          <Text className="text-sm font-medium text-white">{info.currency}</Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-sm text-slate-400">Idioma principal</Text>
          <Text className="text-sm font-medium text-white">{info.language}</Text>
        </View>
      </View>
    </InfoCard>
  </View>
)

// ─── Pantalla ─────────────────────────────────────────────────────────────────

export default function DestinationDetailScreen() {
  const { name: rawName } = useLocalSearchParams<{ name: string }>()
  const name = rawName ? decodeURIComponent(rawName) : ''

  const { lastSearchResult, lastSearchQuery } = useExploreStore()
  // Usar datos del store si corresponden a este destino (evita un fetch extra tras búsqueda)
  const storeData = lastSearchQuery === name ? lastSearchResult : null

  // React Query: solo fetchea si no hay datos del store
  const { info: queryInfo, isLoading } = useDestinationInfo(storeData ? null : name)
  const info = storeData ?? queryInfo

  const meta = DESTINATION_META[name]
  const imageUrl = meta?.image_url ?? GENERIC_TRAVEL_IMAGE

  const handleCreateTrip = () => {
    router.push({
      pathname: '/(app)/trips/new',
      params: { destination: name },
    } as never)
  }

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header con imagen */}
      <ImageBackground
        source={{ uri: imageUrl }}
        style={{ height: 260 }}
        resizeMode="cover"
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.48)',
            justifyContent: 'space-between',
            paddingTop: 56,
            paddingBottom: 20,
            paddingHorizontal: 16,
          }}
        >
          {/* Botón atrás */}
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={{
              alignSelf: 'flex-start',
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 20,
              paddingHorizontal: 14,
              paddingVertical: 8,
            }}
          >
            <Text className="font-semibold text-white">← Volver</Text>
          </Pressable>

          {/* Nombre del destino */}
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#fff' }}>{name}</Text>
        </View>
      </ImageBackground>

      {/* Contenido scrollable */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {isLoading && !info ? (
          <ContentSkeleton />
        ) : info ? (
          <DestinationContent info={info} />
        ) : (
          <View className="px-4 pt-8">
            <Text className="text-center text-slate-400">
              No se pudo cargar la información de {name}.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* CTA fijo en la parte inferior */}
      <View
        className="border-t border-slate-700 bg-slate-900 px-4 pb-8 pt-4"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
      >
        <Pressable
          onPress={handleCreateTrip}
          accessibilityRole="button"
          accessibilityLabel={`Crear viaje a ${name}`}
          className="items-center rounded-2xl bg-indigo-500 py-4 active:bg-indigo-600"
        >
          <Text className="text-base font-bold text-white">Crear viaje a {name}</Text>
        </Pressable>
      </View>
    </View>
  )
}
