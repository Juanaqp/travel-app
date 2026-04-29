// Declaraciones de tipos para módulos de Expo opcionales (no instalados en el MVP).
// Permiten typecheck sin que los paquetes estén presentes en node_modules.
// Para activar estas funciones: npx expo install expo-document-picker expo-file-system

declare module 'expo-document-picker' {
  export interface DocumentPickerAsset {
    uri: string
    name: string
    mimeType?: string
    size?: number
  }

  export interface DocumentPickerResult {
    canceled: boolean
    assets?: DocumentPickerAsset[]
  }

  export function getDocumentAsync(options: {
    type?: string[]
    copyToCacheDirectory?: boolean
    multiple?: boolean
  }): Promise<DocumentPickerResult>
}

declare module 'expo-file-system' {
  export const EncodingType: {
    Base64: string
    UTF8: string
  }

  export function readAsStringAsync(
    fileUri: string,
    options?: { encoding?: string }
  ): Promise<string>

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: string }
  ): Promise<void>

  export function deleteAsync(fileUri: string, options?: { idempotent?: boolean }): Promise<void>

  export function getInfoAsync(fileUri: string): Promise<{
    exists: boolean
    uri: string
    size?: number
    isDirectory: boolean
    modificationTime?: number
  }>

  export const documentDirectory: string | null
  export const cacheDirectory: string | null
}
