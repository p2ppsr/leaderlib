import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8090,
    open: true
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      output: {
        manualChunks: {
          // Split heavy vendor libraries into separate chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-mui': [
            '@mui/material',
            '@mui/icons-material',
            '@mui/system',
            '@emotion/react',
            '@emotion/styled'
          ],
          'vendor-bsv': ['@bsv/sdk'],
          'leaderlib': ['@leaderlib/client', '@leaderlib/core']
        }
      }
    }
  },
  optimizeDeps: {
    // Pre-bundle these to avoid the dynamic import warning
    include: ['@leaderlib/core', '@leaderlib/client']
  }
})
