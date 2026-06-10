import { HttpResponse, http } from "msw"
import { beforeEach, describe, expect, it } from "vitest"

import { AudioTranscriptPanel } from "@/components/problems/audio-transcript-panel"
import { makeAttempt } from "@/test/fixtures"
import { renderWithProviders, screen, waitFor } from "@/test/render"
import { resetStore, seed, server, store } from "@/test/server"

const ATTEMPT_ID = "attempt-with-audio"
const AUDIO_URL = `/api/v1/recordings/recording-1/content`

function transcription(overrides: Record<string, unknown> = {}) {
  return {
    id: "transcription-1",
    recording_id: "recording-1",
    status: "completed",
    raw_text: "I started with the brute force and then reached for a hash map.",
    corrected_text: null,
    error_message: null,
    ...overrides,
  }
}

beforeEach(() => {
  resetStore()
  seed({
    attempts: [
      makeAttempt({
        id: ATTEMPT_ID,
        problemId: 1,
        audioUrl: AUDIO_URL,
        recordingId: "recording-1",
      }),
    ],
  })
})

describe("AudioTranscriptPanel", () => {
  it("offers playback for the attempt's recording", () => {
    store.transcriptions.set(ATTEMPT_ID, transcription() as never)
    const { container } = renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    const audio = container.querySelector("audio")
    expect(audio).toHaveAttribute("src", AUDIO_URL)
    expect(audio).toHaveAttribute("controls")
  })

  it("shows a completed transcript", async () => {
    store.transcriptions.set(ATTEMPT_ID, transcription() as never)
    renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    expect(
      await screen.findByText(/I started with the brute force/)
    ).toBeInTheDocument()
  })

  it("prefers a saved correction over the raw transcript", async () => {
    store.transcriptions.set(
      ATTEMPT_ID,
      transcription({ corrected_text: "Corrected by hand." }) as never
    )
    renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    expect(await screen.findByText("Corrected by hand.")).toBeInTheDocument()
    expect(screen.queryByText(/brute force/)).not.toBeInTheDocument()
  })

  it("says so when the recording carried no speech", async () => {
    store.transcriptions.set(
      ATTEMPT_ID,
      transcription({ raw_text: "   " }) as never
    )
    renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    expect(
      await screen.findByText("No speech was detected in this recording.")
    ).toBeInTheDocument()
  })

  it("reports progress while the worker is still transcribing", async () => {
    store.transcriptions.set(
      ATTEMPT_ID,
      transcription({ status: "processing", raw_text: null }) as never
    )
    renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    expect(await screen.findByText("Transcribing audio…")).toBeInTheDocument()
  })

  it("requests a transcript the first time an attempt with audio is opened", async () => {
    let requested = 0
    server.use(
      http.post("/api/v1/attempts/:attemptId/transcription", () => {
        requested += 1
        return HttpResponse.json(transcription({ status: "queued", raw_text: null }))
      })
    )

    renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    await waitFor(() => expect(requested).toBe(1))
  })

  it("surfaces a failure with a retry that re-queues the job", async () => {
    store.transcriptions.set(
      ATTEMPT_ID,
      transcription({
        status: "failed",
        raw_text: null,
        error_message: "The audio could not be decoded.",
      }) as never
    )
    const { user } = renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    expect(
      await screen.findByText("The audio could not be decoded.")
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /retry/i }))

    await waitFor(() =>
      expect(store.transcriptions.get(ATTEMPT_ID)?.status).toBe("queued")
    )
  })

  it("confirms before deleting a recording, and cancels cleanly", async () => {
    store.transcriptions.set(ATTEMPT_ID, transcription() as never)
    const { user } = renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    await user.click(screen.getByRole("button", { name: "Delete recording" }))
    expect(
      screen.getByText("Delete this recording and its transcript?")
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(
      screen.queryByText("Delete this recording and its transcript?")
    ).not.toBeInTheDocument()
    expect(store.attempts[0].audioUrl).toBe(AUDIO_URL)
  })

  it("deletes the recording once the confirmation is accepted", async () => {
    store.transcriptions.set(ATTEMPT_ID, transcription() as never)
    const { user } = renderWithProviders(
      <AudioTranscriptPanel attemptId={ATTEMPT_ID} audioUrl={AUDIO_URL} />
    )

    await user.click(screen.getByRole("button", { name: "Delete recording" }))
    await user.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(store.attempts[0].audioUrl).toBeUndefined())
  })
})
