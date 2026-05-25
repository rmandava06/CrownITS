import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Must match the GitHub repo name exactly (case-sensitive on Pages)
  base: command === 'build' ? '/CrownITS/' : '/',
}))
