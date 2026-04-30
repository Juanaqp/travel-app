import { useState } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import type { ItineraryNode, TransportNode } from '@travelapp/types'
import type { IconName } from '@/constants/icons'

// ─── Color de franja izquierda por tipo de nodo ───────────────────────────────

const NODE_TYPE_STRIP_COLOR: Record<ItineraryNode['type'], string> = {
  flight: '#007AFF',
  hotel_checkin: '#8B5CF6',
  restaurant: '#FF9500',
  activity: '#00A699',
  transport: '#FF9500',
  poi: '#FF5A5F',
  free_time: '#8E8E93',
  note: '#8E8E93',
}

const NODE_TYPE_ICON: Record<ItineraryNode['type'], IconName> = {
  poi: 'attraction',
  restaurant: 'restaurant',
  transport: 'transport',
  hotel_checkin: 'hotel',
  activity: 'activity',
  free_time: 'calendar',
  note: 'filter',
  flight: 'flight',
}

const NODE_TYPE_LABELS: Record<ItineraryNode['type'], string> = {
  poi: 'Lugar',
  restaurant: 'Restaurante',
  transport: 'Transporte',
  hotel_checkin: 'Hotel',
  activity: 'Actividad',
  free_time: 'Tiempo libre',
  note: 'Nota',
  flight: 'Vuelo',
}

const TRANSPORT_MODE_EMOJIS: Record<NonNullable<TransportNode['transportMode']>, string> = {
  metro: '🚇',
  bus: '🚌',
  taxi: '🚕',
  walking: '🚶',
  ferry: '⛴️',
  train: '🚂',
  car: '🚗',
}

// ─── TransferBadge ────────────────────────────────────────────────────────────

interface TransferBadgeProps {
  node: TransportNode
}

export const TransferBadge = ({ node }: TransferBadgeProps) => {
  const { colors } = useTheme()
  const modeEmoji = node.transportMode
    ? (TRANSPORT_MODE_EMOJIS[node.transportMode] ?? '🚶')
    : '🚶'

  return (
    <View style={styles.transferRow}>
      <View style={[styles.transferLine, { backgroundColor: colors.border }]} />
      <View
        style={[
          styles.transferPill,
          { backgroundColor: colors.background.surface, borderColor: colors.border },
        ]}
      >
        <Text variant="caption" color={colors.text.tertiary}>
          {modeEmoji}
        </Text>
        {node.fromLocation && node.toLocation ? (
          <Text
            variant="caption"
            color={colors.text.secondary}
            numberOfLines={1}
            style={{ maxWidth: 160 }}
          >
            → {node.toLocation}
          </Text>
        ) : null}
        {node.durationMinutes ? (
          <Text variant="caption" color={colors.text.tertiary}>
            {node.durationMinutes} min
          </Text>
        ) : null}
      </View>
      <View style={[styles.transferLine, { backgroundColor: colors.border }]} />
    </View>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ItineraryNodeCardProps {
  node: ItineraryNode
  mode?: 'review' | 'view'
  onApprove?: () => void
  onReject?: () => void
  onEdit: () => void
  onAIEdit?: () => void
  dragHandle?: React.ReactNode
  isDragging?: boolean
}

// ─── ItineraryNodeCard ────────────────────────────────────────────────────────

export const ItineraryNodeCard = ({
  node,
  mode = 'review',
  onApprove,
  onReject,
  onEdit,
  onAIEdit,
  dragHandle,
  isDragging = false,
}: ItineraryNodeCardProps) => {
  const { colors, isDark } = useTheme()
  const [isTipExpanded, setIsTipExpanded] = useState(false)

  const isRejected = node.userStatus === 'rejected'
  const isApproved = node.userStatus === 'approved'
  const stripColor = NODE_TYPE_STRIP_COLOR[node.type]
  const typeLabel = NODE_TYPE_LABELS[node.type]
  const typeIcon = NODE_TYPE_ICON[node.type]

  const costLabel =
    node.cost.amount !== undefined
      ? node.cost.isIncluded
        ? 'Incluido'
        : `${node.cost.currency ?? '€'} ${node.cost.amount}`
      : null

  const cardShadow = isDragging
    ? theme.shadows.md
    : isDark
    ? {}
    : theme.shadows.sm

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background.surface,
          borderColor: colors.border,
          opacity: isRejected ? 0.45 : 1,
          transform: isDragging ? [{ scale: 1.02 as number }] : undefined,
        },
        cardShadow,
      ]}
    >
      {/* Franja de color izquierda */}
      <View style={[styles.leftStrip, { backgroundColor: stripColor }]} />

      {/* Cuerpo principal */}
      <View style={styles.body}>
        {/* Fila principal: columna de tiempo + contenido + drag handle */}
        <View style={styles.mainRow}>
          {/* Columna de tiempo (40px) */}
          <View style={styles.timeColumn}>
            <Icon name={typeIcon} size="sm" color={isRejected ? colors.text.tertiary : stripColor} />
            <Text
              variant="caption"
              weight="semibold"
              color={isRejected ? colors.text.tertiary : stripColor}
              style={styles.timeText}
            >
              {node.time}
            </Text>
          </View>

          {/* Contenido */}
          <View style={styles.content}>
            <Text
              variant="body"
              weight="semibold"
              color={isRejected ? colors.text.tertiary : colors.text.primary}
              numberOfLines={2}
              style={isRejected ? styles.strikethrough : undefined}
            >
              {node.emoji} {node.name}
            </Text>

            {/* Tipo + duración + costo */}
            <View style={styles.metaRow}>
              <View style={[styles.typePill, { backgroundColor: `${stripColor}18` }]}>
                <Text variant="caption" weight="semibold" style={{ color: stripColor }}>
                  {typeLabel}
                </Text>
              </View>
              <Text variant="caption" color={colors.text.tertiary}>
                {node.durationMinutes} min
              </Text>
              {costLabel ? (
                <Text variant="caption" color={colors.text.tertiary}>
                  · {costLabel}
                </Text>
              ) : null}
            </View>

            {/* Dirección */}
            {node.location.address ? (
              <Text
                variant="caption"
                color={colors.text.tertiary}
                numberOfLines={1}
                style={styles.locationText}
              >
                {node.location.address}
              </Text>
            ) : null}
          </View>

          {/* Drag handle (slot externo) */}
          {dragHandle ? <View style={styles.dragSlot}>{dragHandle}</View> : null}
        </View>

        {/* Descripción */}
        {node.description ? (
          <Text
            variant="caption"
            color={colors.text.secondary}
            numberOfLines={2}
            style={styles.description}
          >
            {node.description}
          </Text>
        ) : null}

        {/* AI tip colapsable */}
        {node.aiTip ? (
          <Pressable
            onPress={() => setIsTipExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={isTipExpanded ? 'Ocultar consejo' : 'Ver consejo de IA'}
            style={[styles.aiTipBox, { backgroundColor: `${colors.primary}10` }]}
          >
            <Text variant="caption" weight="semibold" color={colors.primary}>
              💡 {isTipExpanded ? 'Ocultar consejo' : 'Ver consejo'}
            </Text>
            {isTipExpanded ? (
              <Text variant="caption" color={colors.text.secondary} style={styles.aiTipText}>
                {node.aiTip}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {/* Modificado por el usuario */}
        {node.isUserModified ? (
          <Text
            variant="caption"
            color={colors.semantic.warning}
            style={styles.modifiedLabel}
          >
            ✏️ Modificado por ti
          </Text>
        ) : null}

        {/* Acciones — modo revisión */}
        {mode === 'review' ? (
          <View style={styles.actionsSection}>
            {/* Fila 1: Editar (secundario) + Aprobar (primario) */}
            <View style={styles.actionsRow}>
              <Pressable
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel="Editar actividad manualmente"
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: colors.background.elevated ?? colors.background.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text variant="caption" weight="semibold" color={colors.text.secondary}>
                  ✏️ Editar
                </Text>
              </Pressable>

              <Pressable
                onPress={onApprove}
                accessibilityRole="button"
                accessibilityLabel="Aprobar actividad"
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: isApproved
                      ? colors.semantic.success
                      : colors.primary,
                    borderColor: 'transparent',
                  },
                ]}
              >
                <Text variant="caption" weight="semibold" color="#FFFFFF">
                  {isApproved ? '✓ Aprobado' : '✓ Aprobar'}
                </Text>
              </Pressable>
            </View>

            {/* Fila 2: Saltar (ghost) + IA */}
            <View style={[styles.actionsRow, { marginTop: theme.spacing.xs }]}>
              <Pressable
                onPress={onReject}
                accessibilityRole="button"
                accessibilityLabel="Saltar esta actividad"
                style={styles.ghostBtn}
              >
                <Text
                  variant="caption"
                  weight="semibold"
                  color={isRejected ? colors.semantic.danger : colors.text.tertiary}
                >
                  {isRejected ? 'Saltado' : 'Saltar'}
                </Text>
              </Pressable>

              {onAIEdit ? (
                <Pressable
                  onPress={onAIEdit}
                  accessibilityRole="button"
                  accessibilityLabel="Editar con IA"
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: `${colors.primary}15`,
                      borderColor: `${colors.primary}35`,
                    },
                  ]}
                >
                  <Text variant="caption" weight="semibold" color={colors.primary}>
                    ✨ IA
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          // Acciones — modo vista
          <View style={[styles.actionsSection, styles.actionsRow]}>
            <Pressable
              onPress={onEdit}
              accessibilityRole="button"
              accessibilityLabel="Editar actividad manualmente"
              style={[
                styles.actionBtn,
                {
                  backgroundColor: colors.background.elevated ?? colors.background.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text variant="caption" weight="semibold" color={colors.text.secondary}>
                ✏️ Editar
              </Text>
            </Pressable>

            {onAIEdit ? (
              <Pressable
                onPress={onAIEdit}
                accessibilityRole="button"
                accessibilityLabel="Editar con IA"
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: `${colors.primary}15`,
                    borderColor: `${colors.primary}35`,
                  },
                ]}
              >
                <Text variant="caption" weight="semibold" color={colors.primary}>
                  ✨ IA
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  leftStrip: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: theme.spacing.md,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  timeColumn: {
    width: 40,
    alignItems: 'center',
    gap: 4,
    paddingTop: 2,
  },
  timeText: {
    textAlign: 'center',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  typePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  locationText: {
    marginTop: 2,
  },
  dragSlot: {
    marginLeft: theme.spacing.xs,
  },
  description: {
    marginTop: theme.spacing.sm,
  },
  aiTipBox: {
    marginTop: theme.spacing.sm,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: 4,
  },
  aiTipText: {
    marginTop: 4,
    lineHeight: 18,
  },
  modifiedLabel: {
    marginTop: theme.spacing.xs,
  },
  actionsSection: {
    marginTop: theme.spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  actionBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
  },
  ghostBtn: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  // TransferBadge
  transferRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  transferLine: {
    flex: 1,
    height: 1,
  },
  transferPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    marginHorizontal: theme.spacing.sm,
  },
})
