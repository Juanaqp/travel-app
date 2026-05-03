import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useAuthStore } from '@/stores/useAuthStore'
import { useTheme } from '@/hooks/useTheme'
import { ScreenWrapper } from '@/components/ui/ScreenWrapper'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

// Pantalla de login con Magic Link — sin contraseña
export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const { signInWithEmail, isLoading } = useAuthStore()
  const { colors, spacing, typography } = useTheme()

  const isEmailValid = email.trim().includes('@')
  const isDisabled = isLoading || !isEmailValid

  const handleSend = async () => {
    setErrorMessage(null)
    try {
      await signInWithEmail(email.trim().toLowerCase())
      setSent(true)
    } catch {
      setErrorMessage('No pudimos enviar el enlace. Verifica el email e inténtalo de nuevo.')
    }
  }

  // Pantalla de confirmación tras enviar el enlace
  if (sent) {
    return (
      <ScreenWrapper scroll={false} padding={false}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
          <Text style={{ marginBottom: spacing.xl, fontSize: typography.size.xxxl }}>✉️</Text>
          <Text style={{ marginBottom: spacing.sm, textAlign: 'center', fontSize: typography.size.xl, fontWeight: '700', color: colors.text.primary }}>
            Revisa tu email
          </Text>
          <Text style={{ marginBottom: spacing.xs, textAlign: 'center', fontSize: typography.size.md, color: colors.text.secondary }}>
            Enviamos un enlace mágico a:
          </Text>
          <Text style={{ marginBottom: spacing.xxl, textAlign: 'center', fontSize: typography.size.md, fontWeight: '500', color: colors.primary }}>
            {email.trim().toLowerCase()}
          </Text>
          <Text style={{ marginBottom: spacing.xxl, textAlign: 'center', fontSize: typography.size.sm, color: colors.text.tertiary }}>
            Toca el enlace del email para entrar a la app.{'\n'}
            Puede tardar unos segundos en llegar.
          </Text>
          <Button
            label="Usar otro email"
            variant="secondary"
            onPress={() => { setSent(false); setEmail('') }}
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </ScreenWrapper>
    )
  }

  return (
    <ScreenWrapper scroll={false} padding={false}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg }}>
        {/* Cabecera */}
        <Text style={{ marginBottom: spacing.xs, fontSize: typography.size.xxl, fontWeight: '700', color: colors.text.primary }}>TravelApp</Text>
        <Text style={{ marginBottom: spacing.xxl, textAlign: 'center', fontSize: typography.size.md, color: colors.text.secondary }}>
          Planifica tus viajes con inteligencia artificial
        </Text>

        {/* Campo de email */}
        <Input
          label="Email"
          placeholder="tu@email.com"
          value={email}
          onChangeText={(text) => { setEmail(text); setErrorMessage(null) }}
          editable={!isLoading}
          style={{ marginBottom: spacing.sm, width: '100%' }}
        />

        {/* Mensaje de error inline */}
        {errorMessage !== null && (
          <Text style={{ marginBottom: spacing.sm, width: '100%', fontSize: typography.size.sm, color: colors.semantic.danger }}>
            {errorMessage}
          </Text>
        )}

        {/* Botón principal */}
        <Button
          label={isLoading ? 'Enviando...' : 'Enviar enlace mágico'}
          variant="primary"
          onPress={handleSend}
          disabled={isDisabled}
          loading={isLoading}
          style={{ width: '100%', marginTop: spacing.sm }}
        />

        <Text style={{ marginTop: spacing.md, fontSize: typography.size.sm, color: colors.text.tertiary }}>
          Sin contraseña — acceso instantáneo por email
        </Text>
      </View>
    </ScreenWrapper>
  )
}
