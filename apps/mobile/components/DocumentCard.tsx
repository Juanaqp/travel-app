import { Alert, Pressable, StyleSheet, View } from 'react-native'
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import type { TravelDocument, DocumentType, DocumentExtractedData } from '@travelapp/types'
import type { IconName } from '@/constants/icons'

// ─── Configuración visual por tipo ───────────────────────────────────────────

const TYPE_LABELS: Record<DocumentType, string> = {
  flight: 'Vuelo',
  hotel: 'Hotel',
  visa: 'Visa',
  passport: 'Pasaporte',
  car_rental: 'Auto',
  insurance: 'Seguro',
  tour: 'Tour',
  other: 'Otro',
}

const TYPE_ICON_NAME: Partial<Record<DocumentType, IconName>> = {
  passport: 'passport',
  visa: 'visa',
  flight: 'flight',
  hotel: 'hotel',
  insurance: 'checkin',
}

const TYPE_ICON_COLOR: Partial<Record<DocumentType, string>> = {
  passport: '#007AFF',
  visa: '#8B5CF6',
  flight: '#FF9500',
  hotel: '#00A699',
  insurance: '#00A699',
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentCardProps {
  document: TravelDocument
  onPress?: () => void
  onDelete?: (id: string) => void
}

// ─── DocumentCard ─────────────────────────────────────────────────────────────

export const DocumentCard = ({ document, onPress, onDelete }: DocumentCardProps) => {
  const { colors } = useTheme()

  const extracted = document.extractedData as Partial<DocumentExtractedData> | null
  const hasAiData = extracted?.confidence !== undefined
  const fields = (extracted?.fields ?? {}) as Record<string, string>
  const expiryDate = fields.expiryDate ?? fields.validUntil ?? null
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false

  const iconName: IconName = TYPE_ICON_NAME[document.type] ?? 'documents'
  const iconColor = TYPE_ICON_COLOR[document.type] ?? colors.text.tertiary

  const handleDeleteConfirm = () => {
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${document.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => onDelete?.(document.id) },
      ]
    )
  }

  const renderRightActions = () => (
    <Pressable
      onPress={handleDeleteConfirm}
      style={[styles.deleteAction, { backgroundColor: colors.semantic.danger }]}
      accessibilityRole="button"
      accessibilityLabel={`Eliminar ${document.title}`}
    >
      <Icon name="delete" size="sm" color="#FFFFFF" />
      <Text variant="caption" weight="semibold" color="#FFFFFF">
        Eliminar
      </Text>
    </Pressable>
  )

  return (
    <ReanimatedSwipeable
      renderRightActions={onDelete ? renderRightActions : undefined}
      friction={2}
      rightThreshold={40}
    >
      <Pressable
        onPress={onPress}
        style={[
          styles.card,
          {
            backgroundColor: colors.background.elevated,
            borderBottomColor: colors.border,
          },
        ]}
        accessibilityRole={onPress ? 'button' : 'none'}
        accessibilityLabel={document.title}
      >
        {/* Icono de tipo */}
        <View style={[styles.iconBox, { backgroundColor: `${iconColor}18` }]}>
          <Icon name={iconName} size="md" color={iconColor} />
        </View>

        {/* Contenido central */}
        <View style={styles.content}>
          <Text variant="body" weight="semibold" color={colors.text.primary} numberOfLines={1}>
            {document.title}
          </Text>
          <View style={styles.subtitleRow}>
            <Text variant="caption" color={colors.text.tertiary}>
              {TYPE_LABELS[document.type]}
            </Text>
            {expiryDate ? (
              <Text
                variant="caption"
                color={isExpired ? colors.semantic.danger : colors.text.tertiary}
              >
                {' '}·{isExpired ? ' Vencido' : ''} {expiryDate}
              </Text>
            ) : null}
            {hasAiData ? (
              <View style={[styles.aiBadge, { backgroundColor: `${colors.primary}18` }]}>
                <Text style={[styles.aiBadgeText, { color: colors.primary }]}>✨ IA</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Chevron derecho */}
        {onPress ? <Icon name="forward" size="sm" color={colors.text.tertiary} /> : null}
      </Pressable>
    </ReanimatedSwipeable>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  aiBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  deleteAction: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
})
