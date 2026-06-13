import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterAll, afterEach, beforeAll, vi } from "vitest"

import { server } from "./server"

const BOX = { width: 800, height: 400 }

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
