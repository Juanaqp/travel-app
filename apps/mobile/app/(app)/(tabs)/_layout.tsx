// Tab navigation del sistema Roamly
// Orden: Explorar → Mis Viajes → Documentos → Perfil
// Tab bar completamente personalizado: solo iconos, dot indicator activo, animación spring

import { useRef, useEffect } from 'react'
import { View, Pressable, Animated, StyleSheet } from 'react-native'
import { Tabs } from 'expo-router'
import { useTheme } from '@/hooks/useTheme'
import { theme } from '@/constants/theme'
import { Icon } from '@/components/ui/Icon'
import type { IconName } from '@/constants/icons'

// ─── Tipos mínimos del contrato de React Navigation v7 ───────────────────────
// Definidos inline para evitar importar de la dependencia transitiva @react-navigation/bottom-tabs

interface TabRoute {
  key: string
  name: string
}

interface TabBarState {
  index: number
  routes: TabRoute[]
}

interface TabBarNavigation {
  emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean }
  navigate: (name: string) => void
}

interface TabBarInsets {
  bottom: number
  top: number
  left: number
  right: number
}

interface CustomTabBarProps {
  state: TabBarState
  navigation: TabBarNavigation
  insets: TabBarInsets
}

// ─── Config de cada tab ───────────────────────────────────────────────────────

interface TabConfig {
  icon: IconName
  label: string
}

// Mapea el nombre del archivo de ruta al icono y label correspondiente
const TAB_CONFIG: Record<string, TabConfig> = {
  explore:   { icon: 'explore',   label: 'Explorar' },
  index:     { icon: 'trips',     label: 'Mis Viajes' },
  documents: { icon: 'documents', label: 'Documentos' },
  profile:   { icon: 'profile',   label: 'Perfil' },
}

// ─── Tab bar personalizado ────────────────────────────────────────────────────

const CustomTabBar = ({ state, navigation, insets }: CustomTabBarProps) => {
  const { colors, isDark } = useTheme()

  // Animated.Value de escala por tab — inicializado al estado actual del montaje
  const scaleAnims = useRef(
    state.routes.map((_, i) => new Animated.Value(i === state.index ? 1.1 : 1.0))
  ).current

  // Animar la escala al cambiar de tab
  useEffect(() => {
    state.routes.forEach((_, i) => {
      Animated.spring(scaleAnims[i], {
        toValue: i === state.index ? 1.1 : 1.0,
        tension: 300,
        friction: 10,
        useNativeDriver: true,
      }).start()
    })
  }, [state.index]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: isDark
            ? colors.background.surface
            : colors.background.elevated,
          borderTopColor: colors.border,
          paddingBottom: insets.bottom,
          // Sombra solo en modo claro — en oscuro el borde superior es suficiente
          ...(isDark ? {} : theme.shadows.sm),
        },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const isActive = state.index === index
        const config = TAB_CONFIG[route.name] ?? TAB_CONFIG.index

        const handlePress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!isActive && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={handlePress}
            accessibilityRole="button"
            accessibilityLabel={config.label}
            accessibilityState={{ selected: isActive }}
            style={styles.tabItem}
          >
            {/* Icono con animación de escala spring */}
            <Animated.View style={{ transform: [{ scale: scaleAnims[index] }] }}>
              <Icon
                name={config.icon}
                size="lg"
                color={isActive ? colors.primary : colors.text.tertiary}
                filled={isActive}
              />
            </Animated.View>

            {/* Dot indicator — visible solo en el tab activo */}
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: isActive ? colors.primary : 'transparent',
                },
              ]}
            />
          </Pressable>
        )
      })}
    </View>
  )
}

// ─── Layout principal de tabs ─────────────────────────────────────────────────

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...(props as unknown as CustomTabBarProps)} />}
      screenOptions={{ headerShown: false }}
    >
      {/* Orden declarado: Explorar → Mis Viajes → Documentos → Perfil */}
      <Tabs.Screen name="explore"   options={{ title: 'Explorar' }} />
      <Tabs.Screen name="index"     options={{ title: 'Mis Viajes' }} />
      <Tabs.Screen name="documents" options={{ title: 'Documentos' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Perfil' }} />
    </Tabs>
  )
}

// ─── Estilos estáticos de layout ──────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
})
