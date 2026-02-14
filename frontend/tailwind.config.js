/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aegis: {
          dark: '#0a0a0a',     // Background
          glass: 'rgba(255, 255, 255, 0.1)',
          cyan: '#00f0ff',     // The "Pivot" Path Color
          alert: '#ff2a2a',    // Emergency Red
          warning: '#facc15'   // Caution Yellow
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'], // For that "Technical" look
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}