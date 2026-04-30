// Tarjeta de viaje del sistema Roamly
// Soporta variante completa (lista) y compacta (widgets)

import { useRef, useState } from 'react'
import { Image, Pressable, View, StyleSheet, Animated } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Trip, TripStatus, BudgetTier } from '@travelapp/types'

// ─── Etiquetas de estado ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<TripStatus, string> = {
  planning: 'Planificando',
  confirmed: 'Confirmado',
  active: 'En curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

// Color de texto del pill de estado — siempre sobre fondo blanco semitransparente
const STATUS_TEXT_COLOR: Record<TripStatus, string> = {
  planning: '#007AFF',
  confirmed: '#007AFF',
  active: '#00A699',
  completed: '#636366',
  cancelled: '#FF5A5F',
}

const BUDGET_LABEL: Record<BudgetTier, string> = {
  budget: 'Económico',
  mid: 'Estándar',
  premium: 'Premium',
  luxury: 'Lujo',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Formatea 'YYYY-MM-DD' como '12 abr 2026' sin librerías externas
const formatShortDate = (dateStr: string): string => {
  const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const parts = dateStr.split('-')
  const year = parseInt(parts[0] ?? '0', 10)
  const month = parseInt(parts[1] ?? '1', 10)
  const day = parseInt(parts[2] ?? '1', 10)
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`
}

// Calcula la leyenda dinámica de días según estado y fechas
const buildDaysLabel = (trip: Trip): string => {
  if (!trip.startDate) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(trip.startDate)

  if (trip.status === 'active' && trip.endDate) {
    const end = new Date(trip.endDate)
    const remaining = Math.ceil((end.getTime() - today.getTime()) / 864e5)
    if (remaining > 1) return `${remaining} días restantes`
    if (remaining === 1) return 'Último día'
    return 'Viaje finalizado'
  }

  if (trip.status === 'planning' || trip.status === 'confirmed') {
    const daysToGo = Math.ceil((start.getTime() - today.getTime()) / 864e5)
    if (daysToGo > 1) return `En ${daysToGo} días`
    if (daysToGo === 1) return 'Mañana'
    if (daysToGo === 0) return '¡Hoy!'
  }

  return ''
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TripCardProps {
  trip: Trip
  onPress: () => void
  variant?: 'full' | 'compact'
}

// ─── Variante completa ────────────────────────────────────────────────────────

const FULL_HEIGHT = 220
const COMPACT_WIDTH = 160
const COMPACT_HEIGHT = 120

export const TripCard = ({ trip, onPress, variant = 'full' }: TripCardProps) => {
  const { colors, isDark } = useTheme()
  const scaleAnim = useRef(new Animated.Value(1)).current
  const [imageLoaded, setImageLoaded] = useState(false)
  const primaryDest = trip.destinations[0]
  const daysLabel = buildDaysLabel(trip)
  const statusColor = STATUS_TEXT_COLOR[trip.status]

  const handlePressIn = () => {
    Animated.timing(scaleAnim, {
      toValue: 0.98,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: theme.animation.fast,
      useNativeDriver: true,
    }).start()
  }

  const cardHeight = variant === 'full' ? FULL_HEIGHT : COMPACT_HEIGHT
  const cardStyle = [
    styles.card,
    variant === 'compact' && { width: COMPACT_WIDTH },
    { borderColor: isDark ? colors.border : 'transparent', borderWidth: isDark ? StyleSheet.hairlineWidth : 0 },
    ...(isDark ? [] : [theme.shadows.md]),
  ]

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Viaje a ${primaryDest?.city ?? trip.title}, estado: ${STATUS_LABEL[trip.status]}`}
    >
      <Animated.View style={[cardStyle, { transform: [{ scale: scaleAnim }] }]}>
        {/* Imagen de portada + gradiente */}
        <View style={[styles.imageContainer, { height: cardHeight }]}>
          {/* Skeleton mientras carga */}
          {!imageLoaded && (
            <Skeleton width="100%" height={cardHeight} radius="lg" style={styles.absoluteFill} />
          )}

          {trip.coverImageUrl ? (
            <Image
              source={{ uri: trip.coverImageUrl }}
              style={styles.absoluteFill}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
              accessibilityLabel={`Foto de portada de ${trip.title}`}
            />
          ) : (
            // Fondo de gradiente visual cuando no hay imagen
            <View style={[styles.absoluteFill, styles.placeholderBg]}>
              <View style={styles.placeholderIcon}>
                <Icon name="flight" size="xl" color="rgba(255,255,255,0.4)" />
              </View>
            </View>
          )}

          {/* Gradiente simulado: espaciador + bandas oscuras al bottom */}
          <View style={[styles.absoluteFill, styles.gradientContainer]}>
            <View style={{ flex: 1 }} />
            <View style={{ height: 20, backgroundColor: 'rgba(0,0,0,0.08)' }} />
            <View style={{ height: 25, backgroundColor: 'rgba(0,0,0,0.22)' }} />
            <View style={{ height: 30, backgroundColor: 'rgba(0,0,0,0.40)' }} />
            <View style={{ height: variant === 'full' ? 70 : 45, backgroundColor: 'rgba(0,0,0,0.60)' }} />
          </View>

          {/* Pill de estado — top-left */}
          <View style={[styles.statusPill, { backgroundColor: 'rgba(255,255,255,0.92)' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABEL[trip.status]}
            </Text>
          </View>

          {/* Contenido inferior — solo en variante full */}
          {variant === 'full' && (
            <View style={styles.bottomContent}>
              {/* Nombre del viaje */}
              <Text
                variant="subheading"
                weight="bold"
                color="#FFFFFF"
                numberOfLines={1}
              >
                {trip.title}
              </Text>

              {/* Destino + fechas */}
              <View style={styles.metaRow}>
                {primaryDest && (
                  <View style={styles.metaItem}>
                    <Icon name="attraction" size="sm" color="rgba(255,255,255,0.85)" />
                    <Text
                      variant="caption"
                      color="rgba(255,255,255,0.85)"
                      numberOfLines={1}
                      style={styles.metaText}
                    >
                      {primaryDest.city}, {primaryDest.country}
                    </Text>
                  </View>
                )}
                {trip.startDate && (
                  <View style={styles.metaItem}>
                    <Icon name="calendar" size="sm" color="rgba(255,255,255,0.85)" />
                    <Text
                      variant="caption"
                      color="rgba(255,255,255,0.85)"
                      numberOfLines={1}
                      style={styles.metaText}
                    >
                      {formatShortDate(trip.startDate)}
                      {trip.endDate ? ` → ${formatShortDate(trip.endDate)}` : ''}
                    </Text>
                  </View>
                )}
              </View>

              {/* Budget pill + días restantes */}
              <View style={styles.footerRow}>
                {trip.budget && (
                  <View style={styles.budgetPill}>
                    <Text variant="caption" weight="semibold" color="#FFFFFF" style={styles.pillText}>
                      {BUDGET_LABEL[trip.budget]}
                    </Text>
                  </View>
                )}
                {daysLabel ? (
                  <Text
                    variant="caption"
                    weight="semibold"
                    color="#FFFFFF"
                    style={styles.daysLabel}
                  >
                    {daysLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* Contenido inferior — variante compact: solo nombre y destino */}
          {variant === 'compact' && (
            <View style={styles.compactContent}>
              <Text
                variant="label"
                weight="bold"
                color="#FFFFFF"
                numberOfLines={1}
              >
                {trip.title}
              </Text>
              {primaryDest && (
                <Text
                  variant="caption"
                  color="rgba(255,255,255,0.8)"
                  numberOfLines={1}
                >
                  {primaryDest.city}
                </Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </Pressable>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    backgroundColor: '#2C2C2E',
  },
  absoluteFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  placeholderBg: {
    backgroundColor: '#3D2B6B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    opacity: 0.5,
  },
  gradientContainer: {
    flexDirection: 'column',
  },
  statusPill: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  statusText: {
    fontSize: theme.typography.size.xs,
    fontWeight: theme.typography.weight.semibold,
  },
  bottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  metaText: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  budgetPill: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  pillText: {
    fontSize: 11,
  },
  daysLabel: {
    fontSize: theme.typography.size.xs,
  },
  compactContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.sm,
  },
})
