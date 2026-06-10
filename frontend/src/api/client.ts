import createClient from "openapi-fetch"

import type { paths } from "@/api/schema"

/**
 * The browser only talks to the same Vite/API origin boundary. The origin is
 * stated rather than left implicit so the client can be exercised outside a
 * browser, where a bare path has nothing to resolve against.
 */
export const api = createClient<paths>({ baseUrl: window.location.origin })
