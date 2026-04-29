// Pantalla de documentos del viaje
// Lista documentos agrupados por tipo, permite subir nuevos con IA y eliminar existentes.

import { useState } from 'react'
import { View, Text, SectionList, Pressable, Alert, Platform } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'

// Lee un archivo como base64 de forma compatible con native (file URI) y web (blob URI)
const readFileAsBase64 = async (uri: string): Promise<string> => {
  if (Platform.OS === 'web') {
    const response = await fetch(uri)
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        resolve(dataUrl.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
}
import { useDocuments, useUploadDocument, useDeleteDocument } from '@/hooks/useDocuments'
import { DocumentCard } from '@/components/DocumentCard'
import { LoadingSkeleton } from '@/components/LoadingSkeleton'
import { EmptyState } from '@/components/EmptyState'
import type { TravelDocument, DocumentType } from '@travelapp/types'

// ─── Agrupación por tipo con orden predefinido ────────────────────────────────

const SECTION_LABELS: Record<DocumentType, string> = {
  flight: '✈️ Vuelos y boarding passes',
  hotel: '🏨 Hoteles',
  passport: '📗 Pasaportes y DNI',
  visa: '🛂 Visas y permisos',
  car_rental: '🚗 Alquiler de autos',
  insurance: '🛡️ Seguros',
  tour: '🗺️ Tours y actividades',
  other: '📄 Otros documentos',
}

const SECTION_ORDER: DocumentType[] = [
  'flight', 'hotel', 'passport', 'visa', 'car_rental', 'insurance', 'tour', 'other',
]

interface DocumentSection {
  title: string
  type: DocumentType
  data: TravelDocument[]
}

const groupDocumentsByType = (docs: TravelDocument[]): DocumentSection[] => {
  const grouped: Partial<Record<DocumentType, TravelDocument[]>> = {}

  for (const doc of docs) {
    if (!grouped[doc.type]) grouped[doc.type] = []
    grouped[doc.type]!.push(doc)
  }

  return SECTION_ORDER
    .filter((type) => (grouped[type]?.length ?? 0) > 0)
    .map((type) => ({
      title: SECTION_LABELS[type],
      type,
      data: grouped[type]!,
    }))
}

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function DocumentsScreen() {
  const { id: tripId } = useLocalSearchParams<{ id: string }>()
  const { data: documents, isLoading, error, refetch } = useDocuments(tripId)
  const uploadMutation = useUploadDocument()
  const deleteMutation = useDeleteDocument()
  const [isPickingFile, setIsPickingFile] = useState(false)

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

  if (isLoading) {
    return (
      <View className="flex-1 bg-slate-900 pt-16">
        <View className="px-4">
          <LoadingSkeleton count={3} height={120} />
        </View>
      </View>
    )
  }

  if (error) {
    return (
      <View className="flex-1 bg-slate-900">
        <View className="px-4 pt-14">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver al viaje"
          >
            <Text className="text-indigo-400">← Volver</Text>
          </Pressable>
        </View>
        <EmptyState
          title="Error al cargar documentos"
          subtitle="No pudimos cargar tus documentos"
          actionLabel="Reintentar"
          onAction={refetch}
        />
      </View>
    )
  }

  const sections = groupDocumentsByType(documents ?? [])
  const isUploading = isPickingFile || uploadMutation.isPending

  return (
    <View className="flex-1 bg-slate-900">
      {/* Header */}
      <View className="px-4 pb-3 pt-14">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver al viaje"
        >
          <Text className="mb-4 text-indigo-400">← Volver</Text>
        </Pressable>

        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Documentos</Text>
          <Pressable
            onPress={handleUpload}
            disabled={isUploading}
            accessibilityRole="button"
            accessibilityLabel="Subir nuevo documento"
            className="rounded-lg bg-indigo-600 px-4 py-2 active:bg-indigo-700 disabled:opacity-50"
          >
            <Text className="text-sm font-semibold text-white">
              {isUploading ? 'Procesando…' : '+ Subir'}
            </Text>
          </Pressable>
        </View>

        {(documents?.length ?? 0) > 0 ? (
          <Text className="mt-1 text-sm text-slate-400">
            {documents!.length} documento{documents!.length !== 1 ? 's' : ''}
          </Text>
        ) : null}
      </View>

      {/* Estado vacío */}
      {!sections.length ? (
        <EmptyState
          title="Sin documentos"
          subtitle="Sube pasaportes, visas, boarding passes y confirmaciones de hotel"
          actionLabel="Subir primer documento"
          onAction={handleUpload}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text className="mb-2 mt-4 text-sm font-semibold text-slate-400">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => (
            <DocumentCard document={item} onDelete={handleDelete} />
          )}
        />
      )}
    </View>
  )
}
