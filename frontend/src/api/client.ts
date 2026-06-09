import createClient from "openapi-fetch"

import type { paths } from "@/api/schema"

/** The browser only talks to the same Vite/API origin boundary. */
export const api = createClient<paths>({ baseUrl: "/api/v1" })
