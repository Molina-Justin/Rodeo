import * as React from "react"
import {
  MicIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Spinner } from "@/components/ui/spinner"
import { api } from "@/api/client"
import type { PracticeSessionResponse } from "@/api/models"
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

const PREFERRED_AUDIO_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
]

function pickSupportedMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) {
    return undefined
  }
  return PREFERRED_AUDIO_MIME_TYPES.find((type) =>
    MediaRecorder.isTypeSupported(type)
  )
}

function format(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return [hours, minutes, seconds]
    .map((unit) => String(unit).padStart(2, "0"))
    .join(":")
}

function RecordingWaveform({
  analyser,
  elapsed,
}: {
  analyser: AnalyserNode
  elapsed: number
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return
    }

    const context = canvas.getContext("2d")

    if (!context) {
      return
    }

    const samples = new Uint8Array(analyser.fftSize)
    const amplitudes = Array.from({ length: 34 }, () => 0)
    let lastSampleAt = 0
    let frame = 0

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      const { width, height } = canvas.getBoundingClientRect()

      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(height * ratio))
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect()

      const now = performance.now()

      if (now - lastSampleAt >= 70) {
        analyser.getByteTimeDomainData(samples)
        const meanSquare =
          samples.reduce((sum, sample) => sum + (sample - 128) ** 2, 0) /
          samples.length
        const amplitude = Math.min(1, (Math.sqrt(meanSquare) / 128) * 7)

        amplitudes.shift()
        amplitudes.push(amplitude)
        lastSampleAt = now
      }

      context.clearRect(0, 0, width, height)

      const gap = 4
      const blockWidth = Math.max(
        2,
        (width - gap * (amplitudes.length - 1)) / amplitudes.length
      )

      amplitudes.forEach((amplitude, index) => {
        const blockHeight = Math.max(4, amplitude * (height - 8))
        const x = index * (blockWidth + gap)
        const y = height - blockHeight

        context.fillStyle =
          index === amplitudes.length - 1 ? "#10b981" : "#10b98199"
        context.fillRect(x, y, blockWidth, blockHeight)
      })

      frame = window.requestAnimationFrame(draw)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    draw()

    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [analyser])

  return (
    <div className="flex w-full items-center gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
      <canvas
        ref={canvasRef}
        className="h-12 min-w-0 flex-1"
        aria-label="Live microphone waveform"
      />
      <div className="flex shrink-0 flex-col items-end">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {format(elapsed)}
        </span>
        <span className="text-xs text-muted-foreground">recording</span>
      </div>
    </div>
  )
}

export function ProblemTimer({
  problem,
  onStopAndLog,
  onSessionInProgressChange,
}: {
  problem: Problem
  onStopAndLog: (
    sessionId: string,
    elapsedMinutes: number,
    audioUrl?: string
  ) => void
  onSessionInProgressChange: (inProgress: boolean) => void
}) {
  const [elapsed, setElapsed] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [recordingRequested, setRecordingRequested] = React.useState(false)
  const [recordingError, setRecordingError] = React.useState<string | null>(
    null
  )
  const [session, setSession] = React.useState<PracticeSessionResponse | null>(
    null
  )
  const [conflict, setConflict] = React.useState<{
    session: PracticeSessionResponse
    title?: string
  } | null>(null)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [stoppingAndLogging, setStoppingAndLogging] = React.useState(false)
  const [analyser, setAnalyser] = React.useState<AnalyserNode | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const recordingRequestRef = React.useRef(false)
  const sessionProgressCallbackRef = React.useRef(onSessionInProgressChange)
  const stopAndLogCallbackRef = React.useRef(onStopAndLog)
  const audioChunksRef = React.useRef<Blob[]>([])
  const recordingStopPromiseRef = React.useRef<Promise<
    Blob | undefined
  > | null>(null)
  const capturedAudioRef = React.useRef<Blob | undefined>(undefined)

  React.useEffect(() => {
    sessionProgressCallbackRef.current = onSessionInProgressChange
    stopAndLogCallbackRef.current = onStopAndLog
  }, [onSessionInProgressChange, onStopAndLog])

  const stopRecording = React.useCallback((saveAudio = false) => {
    if (recordingStopPromiseRef.current) {
      return recordingStopPromiseRef.current
    }

    recordingRequestRef.current = false

    const recorder = recorderRef.current
    const stream = streamRef.current
    const audioContext = audioContextRef.current

    const cleanUp = () => {
      stream?.getTracks().forEach((track) => track.stop())
      void audioContext?.close()
      analyserRef.current = null
      setAnalyser(null)
      streamRef.current = null
      audioContextRef.current = null
      recorderRef.current = null
      audioChunksRef.current = []
      recordingStopPromiseRef.current = null
      setRecording(false)
    }

    if (!recorder || recorder.state === "inactive") {
      cleanUp()
      return Promise.resolve<Blob | undefined>(undefined)
    }

    let resolveStop: (audio: Blob | undefined) => void = () => undefined
    const stopPromise = new Promise<Blob | undefined>((resolve) => {
      resolveStop = resolve
    })
    recordingStopPromiseRef.current = stopPromise
    recorder.addEventListener(
      "stop",
      () => {
        const audio =
          saveAudio && audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, {
                type: recorder.mimeType || "audio/webm",
              })
            : undefined
        if (audio) {
          capturedAudioRef.current = audio
        }

        cleanUp()
        resolveStop(audio)
      },
      { once: true }
    )
    recorder.stop()
    return stopPromise
  }, [])

  const startRecording = React.useCallback(async () => {
    recordingRequestRef.current = true
    setRecordingError(null)

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setRecordingError("Audio recording is not supported in this browser.")
      return
    }

    let stream: MediaStream | null = null

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      if (!recordingRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      const audioContext = new AudioContext()
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)

      const mimeType = pickSupportedMimeType()
      if (!mimeType) {
        stream.getTracks().forEach((track) => track.stop())
        void audioContext.close()
        recordingRequestRef.current = false
        setRecordingError(
          "This browser cannot record audio in a supported format."
        )
        return
      }

      const recorder = new MediaRecorder(stream, { mimeType })
      audioChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }
      recorder.start(1000)

      streamRef.current = stream
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      setAnalyser(analyser)
      recorderRef.current = recorder
      setRecording(true)
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      recordingRequestRef.current = false
      setRecordingError("Microphone access is needed to record audio.")
    }
  }, [])

  React.useEffect(
    () => () => {
      stopRecording()
    },
    [stopRecording]
  )

  const loadConflict = React.useCallback(
    async (known?: PracticeSessionResponse) => {
      const data =
        known ?? (await api.GET("/api/v1/practice-sessions/current")).data
      if (!data || data.problem_id === problem.id) {
        setConflict(null)
        return
      }
      const { data: other } = await api.GET("/api/v1/problems/{problem_id}", {
        params: { path: { problem_id: data.problem_id } },
      })
      setConflict({ session: data, title: other?.title })
    },
    [problem.id]
  )

  React.useEffect(() => {
    let cancelled = false
    void api.GET("/api/v1/practice-sessions/current").then(({ data }) => {
      if (cancelled || !data) {
        return
      }
      if (data.problem_id !== problem.id) {
        void loadConflict(data)
        return
      }
      setSession(data)
      setElapsed(data.active_duration_ms)
      if (data.status === "active" || data.status === "paused") {
        setRunning(data.status === "active")
        setRecordingError(
          "Timer recovered after reload. Audio recorded before the reload cannot be recovered."
        )
        sessionProgressCallbackRef.current(true)
      } else if (data.status === "awaiting_details") {
        stopAndLogCallbackRef.current(
          data.id,
          Math.max(1, Math.round(data.active_duration_ms / 60_000)),
          data.recording?.content_url
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [problem.id, loadConflict])

  React.useEffect(() => {
    if (!running) {
      return
    }

    const startedAt = Date.now() - elapsed
    const interval = window.setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 250)

    return () => {
      window.clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const idle = elapsed === 0 && !running

  const start = async (openProblem: boolean, shouldRecord: boolean) => {
    if (openProblem) {
      window.open(problemUrl(problem), "_blank", "noreferrer")
    }

    setBusy(true)
    try {
      let current = session
      if (!current) {
        const result = await api.POST("/api/v1/practice-sessions", {
          body: { problem_id: problem.id },
        })
        if (!result.data) {
          if (result.response.status === 409) {
            await loadConflict()
            return
          }
          throw new Error("A practice session could not be started")
        }
        current = result.data
      } else if (current.status === "paused") {
        const result = await api.POST(
          "/api/v1/practice-sessions/{session_id}/resume",
          { params: { path: { session_id: current.id } } }
        )
        if (!result.data) {
          throw new Error("The practice session could not be resumed")
        }
        current = result.data
        if (recorderRef.current?.state === "paused") {
          recorderRef.current.resume()
        }
      }
      setSession(current)
      setRunning(true)
      setRecordingRequested(shouldRecord)
      onSessionInProgressChange(true)
      if (shouldRecord && !recorderRef.current) {
        void startRecording()
      }
    } catch (error) {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "The timer could not be started"
      )
    } finally {
      setBusy(false)
    }
  }

  const discardConflict = async () => {
    if (!conflict) {
      return
    }
    setBusy(true)
    try {
      const result = await api.DELETE(
        "/api/v1/practice-sessions/{session_id}",
        {
          params: { path: { session_id: conflict.session.id } },
        }
      )
      if (result.error && result.response.status !== 204) {
        throw new Error(
          "The conflicting practice session could not be discarded"
        )
      }
      setConflict(null)
      setConfirmDiscardOpen(false)
    } catch (error) {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "The conflicting practice session could not be discarded"
      )
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    setRunning(false)
    setElapsed(0)
    setRecordingRequested(false)
    setRecordingError(null)
    onSessionInProgressChange(false)
    void stopRecording()
    if (session) {
      await api.DELETE("/api/v1/practice-sessions/{session_id}", {
        params: { path: { session_id: session.id } },
      })
      setSession(null)
    }
  }

  const pause = async () => {
    if (!session) return
    setBusy(true)
    const result = await api.POST(
      "/api/v1/practice-sessions/{session_id}/pause",
      {
        params: { path: { session_id: session.id } },
      }
    )
    setBusy(false)
    if (!result.data) {
      setRecordingError("The practice session could not be paused")
      return
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.pause()
    }
    setSession(result.data)
    setElapsed(result.data.active_duration_ms)
    setRunning(false)
  }

  const stopAndLog = async () => {
    if (!session) return
    setRunning(false)
    setBusy(true)
    setStoppingAndLogging(true)
    const freshlyStopped = await stopRecording(true)
    const audio = freshlyStopped ?? capturedAudioRef.current
    const form = new FormData()
    if (audio) {
      const extension = audio.type.includes("ogg")
        ? "ogg"
        : audio.type.includes("mp4")
          ? "m4a"
          : "webm"
      form.append("audio", audio, `attempt.${extension}`)
    }
    try {
      const response = await fetch(
        `/api/v1/practice-sessions/${session.id}/stop`,
        { method: "POST", body: form }
      )
      if (!response.ok) {
        const detail = await response
          .json()
          .then((body: { detail?: string }) => body.detail)
          .catch(() => undefined)
        throw new Error(detail ?? "The practice session could not be stopped")
      }
      capturedAudioRef.current = undefined
      const stopped = (await response.json()) as PracticeSessionResponse
      setSession(stopped)
      setElapsed(stopped.active_duration_ms)
      onStopAndLog(
        stopped.id,
        Math.max(1, Math.round(stopped.active_duration_ms / 60_000)),
        stopped.recording?.content_url
      )
    } catch (error) {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "The session could not be stopped"
      )
    } finally {
      setBusy(false)
      setStoppingAndLogging(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-5 rounded-xl border border-dashed border-border px-6 py-8">
      <span
        className={cn(
          "font-mono text-3xl tracking-tight tabular-nums",
          idle ? "text-muted-foreground/20" : "text-foreground"
        )}
      >
        {format(elapsed)}
      </span>

      {conflict ? (
        <div className="flex flex-col items-center gap-3">
          <p className="text-center text-xs text-muted-foreground">
            A practice session is already in progress on{" "}
            <span className="text-foreground">
              #{conflict.session.problem_id}
              {conflict.title ? ` ${conflict.title}` : ""}
            </span>
            . Only one session can run at a time.
          </p>
          <AlertDialog
            open={confirmDiscardOpen}
            onOpenChange={setConfirmDiscardOpen}
          >
            <Button
              variant="outline"
              className="rounded-lg"
              disabled={busy}
              onClick={() => setConfirmDiscardOpen(true)}
            >
              <Trash2Icon />
              Discard that session
            </Button>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Discard this practice session?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently discards the elapsed time for #
                  {conflict.session.problem_id}
                  {conflict.title ? ` ${conflict.title}` : ""}. You can only run
                  one practice session at a time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>
                  Keep session
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={busy}
                  onClick={() => void discardConflict()}
                >
                  Discard session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : running ? (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            disabled={busy}
            onClick={() => void stopAndLog()}
          >
            {stoppingAndLogging ? <Spinner /> : <SquareIcon />}
            {stoppingAndLogging ? "Saving…" : "Stop & log"}
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            disabled={busy}
            onClick={() => void pause()}
          >
            <PauseIcon />
            Pause
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg"
            disabled={busy}
            onClick={() => void start(idle, idle ? true : recordingRequested)}
          >
            {idle ? <MicIcon /> : <PlayIcon />}
            {idle ? "Start with Audio" : "Resume"}
          </Button>
          {idle ? (
            <Button
              variant="secondary"
              className="rounded-lg"
              disabled={busy}
              onClick={() => void start(true, false)}
            >
              <PlayIcon />
              Start without Audio
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-lg"
                disabled={busy}
                onClick={() => void stopAndLog()}
              >
                <SquareIcon />
                Stop & log
              </Button>
              <Button
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                disabled={busy}
                onClick={() => void reset()}
              >
                <RotateCcwIcon />
                Reset
              </Button>
            </>
          )}
        </div>
      )}
      {recording && analyser ? (
        <RecordingWaveform analyser={analyser} elapsed={elapsed} />
      ) : null}
      {recordingError ? (
        <p className="w-full text-center text-xs text-muted-foreground">
          {recordingError}
        </p>
      ) : null}
    </div>
  )
}
