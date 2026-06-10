import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

import { server } from "./server"

// Recharts measures its container and draws nothing at zero width, which is
// exactly what jsdom reports. Giving every element a real box is what makes
// chart assertions possible at all.
const BOX = { width: 800, height: 400 }

// Started at module scope, not in `beforeAll`: setup modules are evaluated
// before the test modules import, and `openapi-fetch` captures
// `globalThis.fetch` when the client module loads. Starting the server later
// leaves the API client holding the unpatched fetch, and requests escape to
// whatever is really listening on the origin.
server.listen({ onUnhandledRequest: "error" })

class ResizeObserverStub implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverStub)

  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  )

  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    value: BOX.width,
  })
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    value: BOX.height,
  })
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      ...BOX,
      top: 0,
      left: 0,
      bottom: BOX.height,
      right: BOX.width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  }
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
