import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": import.meta.dirname + "/src",
    },
  },
  test: {
    environment: "jsdom",
    // Pin the document origin: the API client resolves its relative paths
    // against it, and the MSW handlers are registered on the same origin.
    environmentOptions: { jsdom: { url: "http://localhost:5199" } },
    // The engine works in local calendar days, so the zone is part of the
    // contract. The parity fixture is recorded in this zone.
    env: { TZ: "America/New_York" },
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    restoreMocks: true,
  },
})
