import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { api } from "@/api/client"
import { toAttempt } from "@/api/models"
import type { AttemptDraft } from "@/types"

function attemptBody(draft: AttemptDraft) {
  return {
    completed_at: draft.completedAt,
    duration_seconds: Math.max(1, Math.round(draft.durationMinutes * 60)),
    outcome: draft.outcome,
    effort: draft.effort,
    blocker: draft.blocker,
    notes: draft.notes,
  }
}

function invalidateAttempts(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["attempts"] }),
    queryClient.invalidateQueries({ queryKey: ["problem-list"] }),
    queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["review-queue"] }),
  ])
}

export function useAttempts(problemId?: number, enabled = true) {
  return useQuery({
    queryKey: ["attempts", problemId ?? "all"],
    queryFn: async () => {
      const attempts = []
      let offset = 0
      let total: number
      do {
        const { data, error } = await api.GET("/api/v1/attempts", {
          params: {
            query: {
              problem_id: problemId,
              offset,
              limit: 200,
            },
          },
        })
        if (error || !data) {
          throw new Error("Attempts could not be loaded")
        }
        attempts.push(...data.items.map(toAttempt))
        total = data.total
        offset += data.items.length
      } while (offset < total)
      return attempts
    },
    enabled,
    placeholderData: keepPreviousData,
  })
}

export function useCreateAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      problemId,
      draft,
    }: {
      problemId: number
      draft: AttemptDraft
    }) => {
      const { data, error } = await api.POST(
        "/api/v1/problems/{problem_id}/attempts",
        {
          params: {
            path: { problem_id: problemId },
            header: { "Idempotency-Key": crypto.randomUUID() },
          },
          body: attemptBody(draft),
        }
      )
      if (error || !data) {
        throw new Error("The attempt could not be logged")
      }
      return toAttempt(data)
    },
    onSuccess: () => invalidateAttempts(queryClient),
  })
}

export function useUpdateAttempt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: AttemptDraft }) => {
      const { data, error } = await api.PATCH("/api/v1/attempts/{attempt_id}", {
        params: { path: { attempt_id: id } },
        body: attemptBody(draft),
      })
      if (error || !data) {
        throw new Error("The attempt could not be updated")
      }
      return toAttempt(data)
    },
    onSuccess: () => invalidateAttempts(queryClient),
  })
}

export function useFinalizeSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      sessionId,
      draft,
    }: {
      sessionId: string
      draft: AttemptDraft
    }) => {
      const { data, error } = await api.POST(
        "/api/v1/practice-sessions/{session_id}/finalize",
        {
          params: {
            path: { session_id: sessionId },
            header: { "Idempotency-Key": `practice-session:${sessionId}` },
          },
          body: {
            duration_seconds: Math.max(
              1,
              Math.round(draft.durationMinutes * 60)
            ),
            outcome: draft.outcome,
            effort: draft.effort,
            blocker: draft.blocker,
            notes: draft.notes,
          },
        }
      )
      if (error || !data) {
        throw new Error("The practice session could not be finalized")
      }
      return toAttempt(data.attempt)
    },
    onSuccess: () => invalidateAttempts(queryClient),
  })
}

export function useDeleteAttemptRecording() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (attemptId: string) => {
      const { error, response } = await api.DELETE(
        "/api/v1/attempts/{attempt_id}/recording",
        { params: { path: { attempt_id: attemptId } } }
      )
      if (error && response.status !== 204) {
        throw new Error("The recording could not be deleted")
      }
    },
    onSuccess: (_data, attemptId) => {
      queryClient.removeQueries({ queryKey: ["transcription", attemptId] })
      return invalidateAttempts(queryClient)
    },
  })
}

export { invalidateAttempts }
