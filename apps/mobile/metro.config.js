const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

// Metro no resuelve .wasm como módulo — registrarlo como asset para expo-sqlite web
config.resolver.assetExts.push('wasm')

module.exports = withNativeWind(config, { input: './global.css' })
