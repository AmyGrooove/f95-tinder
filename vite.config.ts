import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const getProxyTarget = () => 'https://f95zone.to'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/f95': {
        target: getProxyTarget(),
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/f95/, ''),
      },
    },
  },
})
