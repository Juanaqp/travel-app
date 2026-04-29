import { View, Text, Image, Pressable, Alert } from 'react-native'
import { Badge } from '@/components/Badge'
import type { TravelDocument, DocumentType, DocumentExtractedData } from '@travelapp/types'

// ─── Configuración visual por tipo de documento ───────────────────────────────

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

const TYPE_EMOJIS: Record<DocumentType, string> = {
  flight: '✈️',
  hotel: '🏨',
  visa: '🛂',
  passport: '📗',
  car_rental: '🚗',
  insurance: '🛡️',
  tour: '🗺️',
  other: '📄',
}

const TYPE_BADGE_VARIANTS: Record<DocumentType, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  flight: 'info',
  hotel: 'success',
  visa: 'warning',
  passport: 'warning',
  car_rental: 'default',
  insurance: 'default',
  tour: 'success',
  other: 'default',
}

// ─── Nivel de confianza ───────────────────────────────────────────────────────

const getConfidenceLabel = (confidence: number): string => {
  if (confidence >= 0.8) return 'Alta'
  if (confidence >= 0.5) return 'Media'
  return 'Baja'
}

const getConfidenceVariant = (
  confidence: number
): 'success' | 'warning' | 'danger' => {
  if (confidence >= 0.8) return 'success'
  if (confidence >= 0.5) return 'warning'
  return 'danger'
}

// ─── Campos clave según tipo de documento ────────────────────────────────────
// Retorna los 4 campos más relevantes para mostrar en la tarjeta

const KEY_FIELDS_BY_TYPE: Record<string, string[]> = {
  boarding_pass: ['flightNumber', 'passenger', 'origin', 'destination', 'seat', 'boardingTime'],
  hotel_confirmation: ['hotelName', 'checkInDate', 'checkOutDate', 'roomType', 'confirmationNumber'],
  visa: ['country', 'visaType', 'validFrom', 'validUntil'],
  passport: ['firstName', 'lastName', 'documentNumber', 'nationality', 'expiryDate'],
  car_rental: ['company', 'pickupDate', 'returnDate', 'carType'],
  insurance: ['provider', 'coverageType', 'validFrom', 'validUntil'],
  tour: ['tourName', 'date', 'time', 'participants'],
  ticket: ['eventName', 'venue', 'date', 'seat'],
  receipt: ['merchant', 'date', 'totalAmount', 'currency'],
}

const getKeyFields = (
  parsedType: string,
  fields: Record<string, unknown>
): Array<{ label: string; value: string }> => {
  const priorityKeys = KEY_FIELDS_BY_TYPE[parsedType] ?? Object.keys(fields)
  const result: Array<{ label: string; value: string }> = []

  for (const key of priorityKeys) {
    if (result.length >= 4) break
    const value = fields[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      // Convierte camelCase a texto legible: "flightNumber" → "flight Number"
      const label = key.replace(/([A-Z])/g, ' $1').trim()
      result.push({ label, value: String(value) })
    }
  }

  return result
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DocumentCardProps {
  document: TravelDocument
  thumbnailUrl?: string        // URL firmada de miniatura generada por Supabase image transform
  isCachedOffline?: boolean    // true si el archivo está descargado localmente
  onDelete?: (id: string) => void
}

// ─── Componente principal ─────────────────────────────────────────────────────

export const DocumentCard = ({ document, thumbnailUrl, isCachedOffline, onDelete }: DocumentCardProps) => {
  const extracted = document.extractedData as Partial<DocumentExtractedData>
  const parsedType = extracted.type ?? document.type
  const confidence = extracted.confidence ?? 0
  const fields = (extracted.fields as Record<string, unknown>) ?? {}
  const keyFields = getKeyFields(parsedType, fields)
  const hasAiData = extracted.confidence !== undefined

  const handleDelete = () => {
    Alert.alert(
      'Eliminar documento',
      `¿Eliminar "${document.title}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => onDelete?.(document.id),
        },
      ]
    )
  }

  const handleCorrect = () => {
    Alert.alert('Próximamente', 'La edición manual de datos estará disponible pronto.')
  }

  return (
    <View className="mb-3 rounded-xl border border-slate-700 bg-slate-800 p-4">
      {/* Header: thumbnail/emoji + título + tipo badge + indicador offline */}
      <View className="mb-3 flex-row items-start justify-between">
        <View className="mr-3 flex-1 flex-row items-center gap-3">
          {/* Miniatura del documento si hay URL, si no muestra emoji */}
          {thumbnailUrl ? (
            <Image
              source={{ uri: thumbnailUrl }}
              className="h-12 w-10 rounded-md"
              resizeMode="cover"
              accessibilityElementsHidden
            />
          ) : (
            <Text className="text-3xl" accessibilityElementsHidden>
              {TYPE_EMOJIS[document.type]}
            </Text>
          )}
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Text className="flex-1 text-sm font-semibold text-white" numberOfLines={1}>
                {document.title}
              </Text>
              {/* Indicador de disponibilidad offline */}
              {isCachedOffline ? (
                <Text
                  className="text-xs text-emerald-400"
                  accessibilityLabel="Disponible sin conexión"
                >
                  ✓
                </Text>
              ) : null}
            </View>
            <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
              {document.fileName}
            </Text>
          </View>
        </View>
        <Badge
          label={TYPE_LABELS[document.type]}
          variant={TYPE_BADGE_VARIANTS[document.type]}
        />
      </View>

      {/* Campos clave extraídos por IA */}
      {keyFields.length > 0 ? (
        <View className="mb-3 gap-1.5">
          {keyFields.map(({ label, value }) => (
            <View key={label} className="flex-row gap-2">
              <Text className="w-28 text-xs capitalize text-slate-500">{label}</Text>
              <Text
                className="flex-1 text-xs font-medium text-slate-200"
                numberOfLines={1}
              >
                {value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Footer: indicador IA + confianza + acciones */}
      <View className="flex-row items-center justify-between border-t border-slate-700 pt-3">
        <View className="flex-row items-center gap-2">
          {hasAiData ? (
            <View className="flex-row items-center gap-1.5">
              <Text className="text-xs text-indigo-400">✨ IA</Text>
              <Badge
                label={getConfidenceLabel(confidence)}
                variant={getConfidenceVariant(confidence)}
                accessibilityLabel={`Confianza de extracción: ${getConfidenceLabel(confidence)}`}
              />
            </View>
          ) : null}
        </View>

        <View className="flex-row gap-4">
          <Pressable
            onPress={handleCorrect}
            accessibilityRole="button"
            accessibilityLabel="Corregir datos del documento"
          >
            <Text className="text-xs text-indigo-400">Corregir datos</Text>
          </Pressable>
          {onDelete ? (
            <Pressable
              onPress={handleDelete}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar documento ${document.title}`}
            >
              <Text className="text-xs text-red-400">Eliminar</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  )
}
