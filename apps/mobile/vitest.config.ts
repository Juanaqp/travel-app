import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx}', '**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.expo', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        '.expo/**',
        'dist/**',
        '**/__tests__/**',
        '**/*.config.{ts,js}',
        '**/*.d.ts',
        '**/vitest.setup.ts',
        'app/**',            // pantallas de Expo Router — testear con E2E
        'components/**',     // componentes UI puros — testear con Maestro E2E
        'constants/**',
        'assets/**',
        'lib/offline/db.ts', // módulo nativo SQLite — sin API mockeada completa
      ],
      thresholds: {
        lines: 55,
        functions: 55,
        branches: 70,
        statements: 55,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
      // Alias para importar tipos compartidos del monorepo en tests
      '@travelapp/types': resolve(__dirname, '../../packages/types'),
      // Redirige el runtime JSX de NativeWind al de React en el entorno de tests.
      // jsxImportSource:'nativewind' en babel.config.js hace que los componentes
      // retornen null con react-test-renderer — React's runtime es compatible.
      'nativewind/jsx-runtime': resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'nativewind/jsx-dev-runtime': resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
    },
  },
})
