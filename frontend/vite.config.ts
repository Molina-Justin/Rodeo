import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5199,
    proxy: {
      "/api": process.env.RODEO_API_PROXY ?? "http://127.0.0.1:8000",
    },
  },
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
})
