import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/call-details': {
        target: 'https://ai-powered-voice-based-appointment.onrender.com',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})
