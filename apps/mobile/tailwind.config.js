/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './stores/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Paleta del design system — sincronizada con constants/theme.ts
        brand: {
          primary: '#6366F1',
          hover: '#4F46E5',
          secondary: '#8B5CF6',
        },
      },
    },
  },
  plugins: [],
}
