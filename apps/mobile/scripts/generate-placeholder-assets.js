#!/usr/bin/env node
// Genera assets PNG de placeholder para Expo sin dependencias externas
// Uso: node scripts/generate-placeholder-assets.js
// Nota: los assets reales se diseñarán con Figma/Sketch — esto evita que Expo falle en build

const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

// ─── CRC32 (necesario para el formato PNG) ────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < buffer.length; i++) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function writeUInt32BE(val) {
  const b = Buffer.allocUnsafe(4)
  b.writeUInt32BE(val, 0)
  return b
}

// ─── Construcción de chunk PNG ────────────────────────────────────────────────

function makePngChunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBytes, data])
  return Buffer.concat([
    writeUInt32BE(data.length),
    typeBytes,
    data,
    writeUInt32BE(crc32(crcInput)),
  ])
}

// ─── Generador de PNG con color sólido ────────────────────────────────────────
// Soporta tamaños grandes como 1284×2778 gracias a zlib

function generateSolidPng(width, height, r, g, b) {
  // Firma PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // Chunk IHDR
  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8   // bit depth
  ihdr[9] = 2   // color type: RGB
  ihdr[10] = 0  // método de compresión
  ihdr[11] = 0  // método de filtro
  ihdr[12] = 0  // entrelazado: ninguno

  // Datos de imagen: byte de filtro (0) + RGB por pixel, por fila
  const bytesPerRow = 1 + width * 3
  const rawData = Buffer.alloc(bytesPerRow * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * bytesPerRow
    rawData[rowOffset] = 0  // filtro None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3
      rawData[pixelOffset] = r
      rawData[pixelOffset + 1] = g
      rawData[pixelOffset + 2] = b
    }
  }

  // Comprimir con zlib — color sólido comprime a casi 0 bytes
  const compressed = zlib.deflateSync(rawData, { level: 9 })

  // Chunk IEND
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ])
}

// ─── Assets a generar ────────────────────────────────────────────────────────

const ASSETS_DIR = path.join(__dirname, '..', 'assets')

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
}

const ASSETS = [
  // Icono principal — fondo indigo (color primario de la app)
  { filename: 'icon.png',          width: 1024, height: 1024, r: 99,  g: 102, b: 241 },
  // Icono adaptativo Android — mismo color
  { filename: 'adaptive-icon.png', width: 1024, height: 1024, r: 99,  g: 102, b: 241 },
  // Splash screen — fondo oscuro del tema
  { filename: 'splash.png',        width: 1284, height: 2778, r: 15,  g: 23,  b: 42  },
  // Icono de notificación — blanco puro (Android requiere blanco/transparente)
  { filename: 'notification-icon.png', width: 96, height: 96, r: 255, g: 255, b: 255 },
  // Favicon para web
  { filename: 'favicon.png',       width: 48,   height: 48,  r: 99,  g: 102, b: 241 },
]

console.log('Generando assets placeholder para Expo...\n')

for (const asset of ASSETS) {
  const filePath = path.join(ASSETS_DIR, asset.filename)
  const png = generateSolidPng(asset.width, asset.height, asset.r, asset.g, asset.b)
  fs.writeFileSync(filePath, png)
  const kb = (png.length / 1024).toFixed(1)
  console.log(`  ✓ ${asset.filename.padEnd(25)} ${asset.width}×${asset.height}  (${kb} KB)`)
}

console.log('\nAssets generados en apps/mobile/assets/')
console.log('⚠️  Reemplazar con assets reales antes del build de producción.')
