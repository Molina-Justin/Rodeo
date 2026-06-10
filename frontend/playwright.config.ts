import { defineConfig, devices } from "@playwright/test"

/**
 * Drives the real stack: a FastAPI process on its own throwaway SQLite
 * database, and Vite proxying to it. Nothing here is mocked, so a failure
 * means the app is actually broken.
 */

const API_PORT = 8123
const WEB_PORT = 5198

// Vite binds to localhost, so the browser and the Origin header use that name.
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : [["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: WEB_ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: [
        ".venv/bin/python -m uvicorn rodeo.main:app",
        `--host 127.0.0.1 --port ${API_PORT}`,
      ].join(" "),
      cwd: "../backend",
      port: API_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        RODEO_ENVIRONMENT: "test",
        // A per-run directory, so an E2E run never touches real practice data.
        RODEO_DATA_DIR: "./.e2e-data",
        RODEO_STATIC_DIR: "./.e2e-data/static",
        RODEO_TIMEZONE: "America/New_York",
        RODEO_TRANSCRIPTION_ENABLED: "false",
        RODEO_ALLOWED_HOSTS: '["127.0.0.1", "localhost"]',
        RODEO_ALLOWED_ORIGINS: `["${WEB_ORIGIN}", "http://127.0.0.1:${WEB_PORT}"]`,
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { RODEO_API_PROXY: `http://127.0.0.1:${API_PORT}` },
    },
  ],
})
