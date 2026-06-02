import * as React from "react"

import type { Problem } from "@/types"

type ProblemsStatus = "loading" | "ready" | "error"

interface ProblemsState {
  problems: Problem[]
  status: ProblemsStatus
}

const CATALOG_URL = "/data/leetcode-problems.json"

export function useProblems(): ProblemsState {
  const [state, setState] = React.useState<ProblemsState>({
    problems: [],
    status: "loading",
  })

  React.useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      try {
        const response = await fetch(CATALOG_URL, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Catalog request failed with ${response.status}`)
        }

        const problems = (await response.json()) as Problem[]
        setState({ problems, status: "ready" })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        console.error(error)
        setState({ problems: [], status: "error" })
      }
    }

    load()

    return () => {
      controller.abort()
    }
  }, [])

  return state
}
