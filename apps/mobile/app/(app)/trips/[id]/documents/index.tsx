import { useState, useMemo } from 'react'
import { View, SectionList, Pressable, Alert, Modal, Platform, ScrollView, StyleSheet } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Skeleton } from '@/components/ui/Skeleton'
import { DocumentCard } from '@/components/DocumentCard'
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import type { TravelDocument, DocumentType, DocumentExtractedData } from '@travelapp/types'
import type { IconName } from '@/constants/icons'

// ─── Lectura de archivo multiplataforma ──────────────────────────────────────

const readFileAsBase64 = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    const response = await fetch(uri)
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
}

// ─── Filtros de tipo ──────────────────────────────────────────────────────────

type TypeFilter = 'all' | 'passport' | 'visa' | 'flight' | 'hotel' | 'other'

const TYPE_FILTER_LABELS: Record<TypeFilter, string> = {
  all: 'Todos',
  passport: 'Pasaporte',
  visa: 'Visa',
  flight: 'Vuelo',
  hotel: 'Hotel',
  other: 'Otros',
}

const TYPE_FILTERS: TypeFilter[] = ['all', 'passport', 'visa', 'flight', 'hotel', 'other']

const matchesFilter = (type: DocumentType, filter: TypeFilter): boolean => {
  if (filter === 'all') return true
  if (filter === 'other') return !['passport', 'visa', 'flight', 'hotel'].includes(type)
  return type === filter
}

// ─── Agrupación por tipo ──────────────────────────────────────────────────────

const SECTION_LABELS: Record<DocumentType, string> = {
  flight: '✈️ Vuelos',
  hotel: '🏨 Hoteles',
  passport: '📗 Pasaportes',
  visa: '🛂 Visas',
  car_rental: '🚗 Autos',
  insurance: '🛡️ Seguros',
  tour: '🗺️ Tours',
  other: '📄 Otros',
}

const SECTION_ORDER: DocumentType[] = ['flight', 'hotel', 'passport', 'visa', 'car_rental', 'insurance', 'tour', 'other']

interface DocumentSection {
  title: string
  type: DocumentType
  data: TravelDocument[]
}

const groupByType = (docs: TravelDocument[]): DocumentSection[] => {
  const grouped: Partial<Record<DocumentType, TravelDocument[]>> = {}
  for (const doc of docs) {
    if (!grouped[doc.type]) grouped[doc.type] = []
    grouped[doc.type]!.push(doc)
  }
  return SECTION_ORDER
    .filter((type) => (grouped[type]?.length ?? 0) > 0)
    .map((type) => ({ title: SECTION_LABELS[type], type, data: grouped[type]! }))
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

const TYPE_ICON_NAME: Partial<Record<DocumentType, IconName>> = {
  passport: 'passport', visa: 'visa', flight: 'flight',
  hotel: 'hotel', insurance: 'checkin',
}

const TYPE_ICON_COLOR: Partial<Record<DocumentType, string>> = {
  passport: '#007AFF', visa: '#8B5CF6', flight: '#FF9500',
  hotel: '#00A699', insurance: '#00A699',
}

const TYPE_LABELS: Record<DocumentType, string> = {
  flight: 'Vuelo', hotel: 'Hotel', visa: 'Visa', passport: 'Pasaporte',
  car_rental: 'Auto', insurance: 'Seguro', tour: 'Tour', other: 'Otro',
}

interface DetailSheetProps {
  document: TravelDocument | null
  onClose: () => void
}

const DetailSheet = ({ document: doc, onClose }: DetailSheetProps) => {
  const { colors } = useTheme()
  if (!doc) return null

  const extracted = doc.extractedData as Partial<DocumentExtractedData> | null
  const fields = (extracted?.fields ?? {}) as Record<string, string | number | null>
  const fieldEntries = Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && String(v).trim())
  const iconName: IconName = TYPE_ICON_NAME[doc.type] ?? 'documents'
  const iconColor = TYPE_ICON_COLOR[doc.type] ?? colors.text.tertiary

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheetContainer, { backgroundColor: colors.background.base }]}>
        {/* Handle */}
        <View style={styles.sheetHandleRow}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        </View>

        {/* Header */}
        <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.sheetIconBox, { backgroundColor: `${iconColor}18` }]}>
            <Icon name={iconName} size="lg" color={iconColor} />
          </View>
          <View style={styles.sheetTitleBlock}>
            <Text variant="subheading" weight="bold" color={colors.text.primary} numberOfLines={2}>
              {doc.title}
            </Text>
            <Text variant="caption" color={colors.text.tertiary}>
              {TYPE_LABELS[doc.type]}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cerrar">
            <Icon name="close" size="md" color={colors.text.tertiary} />
          </Pressable>
        </View>

        {/* Campos extraídos */}
        <ScrollView contentContainerStyle={styles.sheetContent}>
          {fieldEntries.length > 0 ? (
            <View style={[styles.fieldsCard, { backgroundColor: colors.background.surface, borderColor: colors.border }]}>
              {fieldEntries.map(([key, value], i) => (
                <View
                  key={key}
                  style={[
                    styles.fieldRow,
                    i < fieldEntries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}
                >
                  <Text
                    variant="caption"
                    color={colors.text.tertiary}
                    style={styles.fieldKey}
                    numberOfLines={1}
                  >
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Text>
                  <Text variant="caption" weight="semibold" color={colors.text.primary} style={styles.fieldValue}>
                    {String(value)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text variant="body" color={colors.text.tertiary} align="center" style={{ marginTop: theme.spacing.lg }}>
              No hay datos extraídos para este documento.
            </Text>
          )}

          {doc.storagePath ? (
            <Pressable
              style={[styles.viewOriginalBtn, { borderColor: colors.border, backgroundColor: colors.background.surface }]}
              accessibilityRole="button"
              accessibilityLabel="Ver original"
            >
              <Icon name="documents" size="sm" color={colors.text.secondary} />
              <Text variant="body" weight="semibold" color={colors.text.secondary}>
                Ver original
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  )
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const { colors } = useTheme()
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: documents, isLoading, error, refetch } = useDocuments(tripId)
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const [isPickingFile, setIsPickingFile] = useState(false)
  const [activeFilter, setActiveFilter] = useState<TypeFilter>('all')
  const [selectedDoc, setSelectedDoc] = useState<TravelDocument | null>(null)

  const handleUpload = async () => {
    try {
      setIsPickingFile(true)
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
        copyToCacheDirectory: true,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      const fileBase64 = await readFileAsBase64(asset.uri)
      await uploadMutation.mutateAsync({
        tripId,
        fileName: asset.name,
        mimeType: asset.mimeType ?? 'application/octet-stream',
        fileBase64,
        fileSizeBytes: asset.size ?? 0,
      })
      Alert.alert('¡Documento procesado!', 'Los datos se extrajeron automáticamente con IA.')
    } catch {
      Alert.alert('Error al subir', 'No se pudo procesar el documento. Intenta de nuevo.')
    } finally {
      setIsPickingFile(false)
    }
  }

  const handleDelete = (documentId: string) => {
    deleteMutation.mutate(documentId)
  }

  const isUploading = isPickingFile || uploadMutation.isPending

  // Filtrado por tipo
  const filteredDocs = useMemo(
    () => (documents ?? []).filter((d) => matchesFilter(d.type, activeFilter)),
    [documents, activeFilter]
  )
  const sections = groupByType(filteredDocs)

  if (isLoading) {
    return (
      <ScreenWrapper
        header={{ title: 'Documentos', showBack: true, rightAction: { icon: 'add', onPress: handleUpload, label: 'Subir documento' } }}
        padding={false}
      >
        <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
          <Skeleton height={72} radius="lg" />
        </View>
      </ScreenWrapper>
    )
  }

  if (error) {
    return (
      <ScreenWrapper
        header={{ title: 'Documentos', showBack: true }}
        padding={false}
      >
        <View style={styles.emptyContainer}>
          <Icon name="offline" size="xl" color={colors.text.tertiary} />
          <Text variant="subheading" weight="semibold" color={colors.text.primary} align="center">
            Error al cargar
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
          >
            <Text variant="body" weight="semibold" color="#FFFFFF">Reintentar</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <>
      <ScreenWrapper
        header={{
          title: 'Documentos',
          showBack: true,
          rightAction: {
            icon: 'add',
            onPress: handleUpload,
            label: isUploading ? 'Procesando…' : 'Subir documento',
          },
        }}
        padding={false}
      >
        {/* Pills de filtro por tipo */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPills}
        >
          {TYPE_FILTERS.map((filter) => {
            const isActive = activeFilter === filter
            return (
              <Pressable
                key={filter}
                onPress={() => setActiveFilter(filter)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.filterPill,
                  isActive
                    ? { backgroundColor: colors.primary, borderColor: 'transparent' }
                    : { backgroundColor: colors.background.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  variant="caption"
                  weight="semibold"
                  color={isActive ? '#FFFFFF' : colors.text.secondary}
                >
                  {TYPE_FILTER_LABELS[filter]}
                </Text>
              </Pressable>
            )
          })}
        </ScrollView>

        {/* Lista o estado vacío */}
        {!sections.length ? (
          <View style={styles.emptyContainer}>
            <Icon name="documents" size="xl" color={colors.text.tertiary} />
            <Text variant="subheading" weight="semibold" color={colors.text.primary} align="center">
              Sin documentos
            </Text>
            <Text variant="body" color={colors.text.secondary} align="center">
              {activeFilter === 'all'
                ? 'Sube pasaportes, visas, boarding passes y confirmaciones de hotel'
                : `No hay documentos de tipo "${TYPE_FILTER_LABELS[activeFilter]}"`}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <Text
                variant="caption"
                weight="semibold"
                color={colors.text.tertiary}
                style={styles.sectionTitle}
              >
                {section.title}
              </Text>
            )}
            renderSectionFooter={() => <View style={styles.sectionGap} />}
            renderItem={({ item }) => (
              <View style={[styles.cardWrapper, { backgroundColor: colors.background.elevated, borderColor: colors.border }]}>
                <DocumentCard
                  document={item}
                  onPress={() => setSelectedDoc(item)}
                  onDelete={handleDelete}
                />
              </View>
            )}
          />
        )}

        {/* Área de subida (dashed) */}
        <Pressable
          onPress={handleUpload}
          disabled={isUploading}
          style={[styles.uploadArea, { borderColor: colors.primary }]}
          accessibilityRole="button"
          accessibilityLabel="Subir documento"
        >
          <Icon name="add" size="md" color={isUploading ? colors.text.tertiary : colors.primary} />
          <Text
            variant="body"
            weight="semibold"
            color={isUploading ? colors.text.tertiary : colors.primary}
          >
            {isUploading ? 'Procesando…' : 'Upload document'}
          </Text>
        </Pressable>
      </ScreenWrapper>

      {/* Detail bottom sheet */}
      {selectedDoc ? (
        <DetailSheet document={selectedDoc} onClose={() => setSelectedDoc(null)} />
      ) : null}
    </>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  filterPills: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  listContent: {
    paddingBottom: 16,
  },
  sectionTitle: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
    letterSpacing: 0.5,
  },
  cardWrapper: {
    marginHorizontal: theme.spacing.md,
    marginBottom: 1,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionGap: {
    height: theme.spacing.xs,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  retryBtn: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    borderRadius: theme.radius.lg,
  },
  uploadArea: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 56,
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  // Detail sheet
  sheetContainer: {
    flex: 1,
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetIconBox: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sheetContent: {
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  fieldsCard: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: theme.spacing.sm,
  },
  fieldKey: {
    width: 120,
    textTransform: 'capitalize',
    flexShrink: 0,
  },
  fieldValue: {
    flex: 1,
  },
  viewOriginalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 50,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
  },
})
