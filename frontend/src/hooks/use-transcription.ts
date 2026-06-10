import * as React from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import type { Attempt } from "@/types"

export interface TranscriptionState {
  status: NonNullable<Attempt["transcriptionStatus"]>
  text: string | null
  errorMessage: string | null
}

interface TranscriptionPayload {
  status: NonNullable<Attempt["transcriptionStatus"]>
  raw_text: string | null
  corrected_text: string | null
  error_message: string | null
}

function toTranscriptionState(
  payload: TranscriptionPayload
): TranscriptionState {
  return {
    status: payload.status,
    text: payload.corrected_text ?? payload.raw_text,
    errorMessage: payload.error_message,
  }
}

function transcriptionQueryKey(attemptId: string | undefined) {
  return ["transcription", attemptId ?? "none"]
}

/**
 * Loads the transcript for an attempt, auto-requesting one the first time a
 * saved attempt with audio is seen (the create endpoint is idempotent), and
 * polls while the backend worker is still transcribing.
 */
export function useTranscription(
  attemptId: string | undefined,
  hasAudio: boolean
) {
  const queryClient = useQueryClient()
  const enabled = Boolean(attemptId) && hasAudio

  const query = useQuery({
    queryKey: transcriptionQueryKey(attemptId),
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/api/v1/attempts/{attempt_id}/transcription",
        { params: { path: { attempt_id: attemptId! } } }
      )
      if (response.status === 404) {
        return null
      }
      if (error || !data) {
        throw new Error("The transcript could not be loaded")
      }
      return toTranscriptionState(data)
    },
    enabled,
  })

  // A plain interval rather than `refetchInterval`: that option only
  // re-evaluates on the query's own fetch lifecycle, so it never notices a
  // status pushed in via `setQueryData` from the mutations below (observed
  // to leave polling permanently off after the initial auto-request).
  React.useEffect(() => {
    if (!enabled) {
      return
    }
    const status = query.data?.status
    const pending =
      query.data === undefined || status === "queued" || status === "processing"
    if (!pending) {
      return
    }
    const intervalId = window.setInterval(() => {
      void queryClient.invalidateQueries({
        queryKey: transcriptionQueryKey(attemptId),
      })
    }, 2000)
    return () => window.clearInterval(intervalId)
  }, [enabled, query.data, attemptId, queryClient])

  const request = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST(
        "/api/v1/attempts/{attempt_id}/transcription",
        { params: { path: { attempt_id: attemptId! } } }
      )
      if (error || !data) {
        throw new Error("The transcript could not be requested")
      }
      return toTranscriptionState(data)
    },
    onSuccess: (data) =>
      queryClient.setQueryData(transcriptionQueryKey(attemptId), data),
  })

  const requestTranscription = request.mutate

  React.useEffect(() => {
    if (enabled && query.isSuccess && query.data === null) {
      requestTranscription()
    }
  }, [enabled, query.isSuccess, query.data, requestTranscription])

  const retry = useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST(
        "/api/v1/attempts/{attempt_id}/transcription/retry",
        { params: { path: { attempt_id: attemptId! } } }
      )
      if (error || !data) {
        throw new Error("The transcript could not be retried")
      }
      return toTranscriptionState(data)
    },
    onSuccess: (data) =>
      queryClient.setQueryData(transcriptionQueryKey(attemptId), data),
  })

  return {
    transcription: query.data ?? undefined,
    isLoading: query.isLoading || request.isPending,
    retry,
  }
}

export { transcriptionQueryKey }
