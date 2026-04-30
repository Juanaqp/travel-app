import { useState, useRef } from 'react'
import {
  View,
  ScrollView,
  FlatList,
  Pressable,
  TextInput,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useExploreFeed } from '@/hooks/useExploreFeed'
import { useAskAI } from '@/hooks/useAskAI'
import { useTrips } from '@/hooks/useTrips'
import { useAuthStore } from '@/stores/useAuthStore'
import { useExploreStore } from '@/stores/useExploreStore'
import { useToastStore } from '@/stores/useToastStore'
import { useTheme } from '@/hooks/useTheme'
import { useEffect } from 'react'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  DestinationCard,
  DestinationCardSkeleton,
} from '@/components/DestinationCard'
import type { ExploreDestination, Trip } from '@travelapp/types'
import type { Continent } from '@travelapp/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Retorna el primer viaje (useTrips ya filtra deleted_at y ordena por created_at DESC)
export const getActiveTrip = (trips: Trip[]): Trip | null => trips[0] ?? null

// Genera las iniciales del usuario a partir del email
const getInitials = (email: string | null | undefined): string => {
  if (!email) return '?'
  return email[0].toUpperCase()
}

// ─── Filtros de continente ────────────────────────────────────────────────────

interface ContinentFilter {
  label: string
  value: Continent | null
}

const CONTINENT_FILTERS: ContinentFilter[] = [
  { label: 'Todo', value: null },
  { label: 'Europa', value: 'Europe' },
  { label: 'Asia', value: 'Asia' },
  { label: 'Américas', value: 'Americas' },
  { label: 'África', value: 'Africa' },
  { label: 'Oceanía', value: 'Oceania' },
]

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface QuickAccessCardProps {
  iconName: 'add' | 'flight' | 'budget' | 'ai'
  label: string
  onPress: () => void
  cardWidth: number
}

const QuickAccessCard = ({ iconName, label, onPress, cardWidth }: QuickAccessCardProps) => {
  const { colors, isDark } = useTheme()

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quickCard,
        {
          width: cardWidth,
          backgroundColor: colors.background.surface,
          borderColor: colors.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          ...(isDark ? {} : theme.shadows.sm),
        },
      ]}
    >
      <Icon name={iconName} size="lg" color={colors.primary} />
      <Text
        variant="label"
        weight="semibold"
        color={colors.text.primary}
        style={styles.quickCardLabel}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeContinent, setActiveContinent] = useState<Continent | null>(null)
  const searchInputRef = useRef<TextInput>(null)
  const scrollRef = useRef<ScrollView>(null)

  const { destinations, isLoading: feedLoading, error: feedError, refetch } = useExploreFeed()
  const { search, status: askStatus } = useAskAI()
  const { data: tripsData } = useTrips()
  const trips = tripsData ?? []
  const { user } = useAuthStore()
  const { setActiveTrip } = useExploreStore()
  const showToast = useToastStore.getState().showToast
  const { colors, isDark } = useTheme()
  const insets = useSafeAreaInsets()
  const { width: screenWidth } = useWindowDimensions()

  const activeTrip = getActiveTrip(trips)
  const isSearching = askStatus === 'loading'
  const userInitials = getInitials(user?.email)

  // Ancho de cada card en la grilla 2×2 (padding horizontal 16×2 + gap 12)
  const quickCardWidth = (screenWidth - theme.spacing.md * 2 - theme.spacing.sm) / 2

  // Destinos filtrados por continente para la sección inferior
  const filteredDestinations: ExploreDestination[] = activeContinent
    ? destinations.filter((d) => d.continent === activeContinent)
    : destinations

  // Sincronizar el viaje activo en el store cuando cambia la lista de viajes
  useEffect(() => {
    setActiveTrip(activeTrip)
  }, [activeTrip, setActiveTrip])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    if (!user) {
      showToast('Inicia sesión para buscar', 'warning')
      router.push('/(auth)' as never)
      return
    }

    const result = await search(searchQuery.trim())
    if (result) {
      router.push(
        `/(app)/explore/destination/${encodeURIComponent(searchQuery.trim())}` as never
      )
    }
  }

  const handleDestinationPress = (name: string) => {
    router.push(`/(app)/explore/destination/${encodeURIComponent(name)}` as never)
  }

  const requireActiveTrip = (label: string, onHasTrip: (trip: Trip) => void) => {
    if (!activeTrip) {
      Alert.alert(
        'Sin viaje activo',
        `Para ${label} necesitas tener un viaje creado primero.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Crear viaje', onPress: () => router.push('/(app)/trips/new' as never) },
        ]
      )
      return
    }
    onHasTrip(activeTrip)
  }

  const focusSearch = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
    searchInputRef.current?.focus()
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background.base }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ── 1. Hero Header ─────────────────────────────────────────────── */}
        <View
          style={[
            styles.hero,
            {
              paddingTop: insets.top + theme.spacing.md,
              backgroundColor: colors.background.base,
            },
          ]}
        >
          {/* Fila de marca: Roamly + notificación + avatar */}
          <View style={styles.heroTopRow}>
            <Text variant="heading" weight="bold" color={colors.primary}>
              Roamly
            </Text>
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel="Notificaciones"
                hitSlop={8}
                style={styles.iconButton}
              >
                <Icon name="notification" size="lg" color={colors.text.primary} />
              </Pressable>
              {/* Avatar de iniciales */}
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text variant="caption" weight="bold" color="#FFFFFF">
                  {userInitials}
                </Text>
              </View>
            </View>
          </View>

          {/* ── 2. Barra de búsqueda con IA ─── */}
          <View
            style={[
              styles.searchBar,
              {
                backgroundColor: colors.background.surface,
                borderColor: colors.border,
                ...(isDark ? {} : theme.shadows.sm),
              },
            ]}
          >
            <Icon name="search" size="md" color={colors.primary} />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="¿A dónde quieres ir?"
              placeholderTextColor={colors.text.tertiary}
              style={[styles.searchInput, { color: colors.text.primary }]}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              accessibilityLabel="Buscar destino"
            />
            {/* Pill "Ask AI" */}
            <Pressable
              onPress={handleSearch}
              disabled={isSearching}
              accessibilityRole="button"
              accessibilityLabel="Preguntar a la IA"
              style={[
                styles.askAIPill,
                {
                  backgroundColor: colors.primary,
                  opacity: isSearching ? 0.6 : 1,
                },
              ]}
            >
              {isSearching ? (
                <Text variant="caption" weight="semibold" color="#FFFFFF">
                  ...
                </Text>
              ) : (
                <>
                  <Icon name="ai" size="sm" color="#FFFFFF" />
                  <Text variant="caption" weight="semibold" color="#FFFFFF">
                    Ask AI
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>

        {/* ── 3. Trending destinations ───────────────────────────────────── */}
        {(feedLoading || destinations.length > 0) && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="heading" weight="bold" color={colors.text.primary}>
                Tendencias
              </Text>
              <Pressable
                onPress={() => {}}
                accessibilityRole="button"
                accessibilityLabel="Ver todos los destinos"
              >
                <Text variant="caption" weight="semibold" color={colors.primary}>
                  Ver todos
                </Text>
              </Pressable>
            </View>

            {feedLoading ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
                scrollEnabled={false}
              >
                {[0, 1, 2].map((i) => (
                  <DestinationCardSkeleton key={i} size="large" />
                ))}
              </ScrollView>
            ) : (
              <FlatList
                data={destinations}
                keyExtractor={(item) => item.name}
                renderItem={({ item }) => (
                  <DestinationCard
                    destination={item}
                    size="large"
                    onPress={() => handleDestinationPress(item.name)}
                  />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
              />
            )}
          </View>
        )}

        {/* Error state del feed */}
        {feedError && !feedLoading && destinations.length === 0 && (
          <View style={styles.section}>
            <View style={[styles.errorCard, { backgroundColor: colors.background.surface, borderColor: colors.border }]}>
              <Text variant="body" color={colors.text.secondary} align="center">
                No pudimos cargar los destinos
              </Text>
              <Pressable
                onPress={() => { refetch().catch(() => {}) }}
                style={[styles.retryButton, { borderColor: colors.primary }]}
                accessibilityRole="button"
                accessibilityLabel="Reintentar carga de destinos"
              >
                <Text variant="label" weight="semibold" color={colors.primary}>
                  Reintentar
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── 4. Quick access 2×2 ────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text
            variant="heading"
            weight="bold"
            color={colors.text.primary}
            style={styles.sectionTitle}
          >
            Planifica tu viaje
          </Text>
          <View style={styles.quickGrid}>
            <QuickAccessCard
              iconName="add"
              label="Nuevo viaje"
              cardWidth={quickCardWidth}
              onPress={() => router.push('/(app)/trips/new' as never)}
            />
            <QuickAccessCard
              iconName="flight"
              label="Mis viajes"
              cardWidth={quickCardWidth}
              onPress={() => router.navigate('/(app)/(tabs)/' as never)}
            />
          </View>
          <View style={[styles.quickGrid, { marginTop: theme.spacing.sm }]}>
            <QuickAccessCard
              iconName="budget"
              label="Gastos"
              cardWidth={quickCardWidth}
              onPress={() =>
                requireActiveTrip('ver gastos', (trip) =>
                  router.push(`/(app)/trips/${trip.id}/expenses` as never)
                )
              }
            />
            <QuickAccessCard
              iconName="ai"
              label="Preguntar IA"
              cardWidth={quickCardWidth}
              onPress={focusSearch}
            />
          </View>
        </View>

        {/* ── 5. Explorar por continente ─────────────────────────────────── */}
        {destinations.length > 0 && (
          <View style={styles.section}>
            <Text
              variant="heading"
              weight="bold"
              color={colors.text.primary}
              style={styles.sectionTitle}
            >
              Explorar por zona
            </Text>

            {/* Pills de filtro */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContent}
            >
              {CONTINENT_FILTERS.map((filter) => {
                const isActive = activeContinent === filter.value
                return (
                  <Pressable
                    key={filter.label}
                    onPress={() => setActiveContinent(filter.value)}
                    accessibilityRole="button"
                    accessibilityLabel={`Filtrar por ${filter.label}`}
                    accessibilityState={{ selected: isActive }}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isActive
                          ? colors.primary
                          : colors.background.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      variant="caption"
                      weight="semibold"
                      color={isActive ? '#FFFFFF' : colors.text.secondary}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            {/* Cards filtradas */}
            {filteredDestinations.length > 0 ? (
              <FlatList
                data={filteredDestinations}
                keyExtractor={(item) => `${item.name}-small`}
                renderItem={({ item }) => (
                  <DestinationCard
                    destination={item}
                    size="small"
                    onPress={() => handleDestinationPress(item.name)}
                  />
                )}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalListContent}
                style={{ marginTop: theme.spacing.md }}
              />
            ) : (
              <View style={styles.emptyContinent}>
                <Text variant="body" color={colors.text.tertiary} align="center">
                  No hay destinos en esta zona todavía
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconButton: {
    padding: theme.spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.size.base,
    height: '100%',
  },
  askAIPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  section: {
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    marginBottom: theme.spacing.md,
  },
  horizontalListContent: {
    paddingLeft: theme.spacing.md,
    paddingRight: theme.spacing.xs,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  quickCard: {
    height: 100,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  quickCardLabel: {
    flex: 1,
  },
  pillsContent: {
    paddingRight: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  pill: {
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContinent: {
    paddingVertical: theme.spacing.xl,
  },
  errorCard: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
})
