import * as React from "react"
import {
  MicIcon,
  PauseIcon,
  PlayIcon,
  RotateCcwIcon,
  SquareIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { problemUrl } from "@/lib/problems"
import { cn } from "@/lib/utils"
import type { Problem } from "@/types"

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
      <span className="text-destructive-foreground flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive">
        <SquareIcon className="size-3.5 fill-current" />
      </span>
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
  onStopAndLog: (elapsedMinutes: number, audioUrl?: string) => void
  onSessionInProgressChange: (inProgress: boolean) => void
}) {
  const [elapsed, setElapsed] = React.useState(0)
  const [running, setRunning] = React.useState(false)
  const [recording, setRecording] = React.useState(false)
  const [recordingRequested, setRecordingRequested] = React.useState(false)
  const [recordingError, setRecordingError] = React.useState<string | null>(
    null
  )
  const [analyser, setAnalyser] = React.useState<AnalyserNode | null>(null)
  const analyserRef = React.useRef<AnalyserNode | null>(null)
  const streamRef = React.useRef<MediaStream | null>(null)
  const audioContextRef = React.useRef<AudioContext | null>(null)
  const recorderRef = React.useRef<MediaRecorder | null>(null)
  const recordingRequestRef = React.useRef(false)
  const audioChunksRef = React.useRef<Blob[]>([])
  const recordingStopPromiseRef = React.useRef<Promise<
    string | undefined
  > | null>(null)

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
      return Promise.resolve<string | undefined>(undefined)
    }

    let resolveStop: (audioUrl: string | undefined) => void = () => undefined
    const stopPromise = new Promise<string | undefined>((resolve) => {
      resolveStop = resolve
    })
    recordingStopPromiseRef.current = stopPromise
    recorder.addEventListener(
      "stop",
      () => {
        const audioUrl =
          saveAudio && audioChunksRef.current.length > 0
            ? URL.createObjectURL(
                new Blob(audioChunksRef.current, {
                  type: recorder.mimeType || "audio/webm",
                })
              )
            : undefined

        cleanUp()
        resolveStop(audioUrl)
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

      const recorder = new MediaRecorder(stream)
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

  const start = (openProblem: boolean, shouldRecord: boolean) => {
    if (openProblem) {
      window.open(problemUrl(problem), "_blank", "noreferrer")
    }

    setRunning(true)
    setRecordingRequested(shouldRecord)
    onSessionInProgressChange(true)

    if (shouldRecord) {
      void startRecording()
    }
  }

  const reset = () => {
    setRunning(false)
    setElapsed(0)
    setRecordingRequested(false)
    setRecordingError(null)
    onSessionInProgressChange(false)
    void stopRecording()
  }

  const stopAndLog = () => {
    setRunning(false)
    const durationMinutes = Math.max(1, Math.round(elapsed / 60000))

    void stopRecording(true).then((audioUrl) => {
      onStopAndLog(durationMinutes, audioUrl)
    })
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

      {running ? (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => {
              stopAndLog()
            }}
          >
            <SquareIcon />
            Stop & log
          </Button>
          <Button
            variant="outline"
            className="rounded-lg"
            onClick={() => {
              setRunning(false)
              void stopRecording()
            }}
          >
            <PauseIcon />
            Pause
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            className="rounded-lg bg-emerald-600 text-white hover:bg-emerald-600/90"
            onClick={() => start(idle, idle || recordingRequested)}
          >
            <PlayIcon />
            {idle ? "Start problem" : "Resume"}
          </Button>
          {idle ? (
            <Button
              variant="outline"
              className="rounded-lg"
              onClick={() => start(false, false)}
            >
              <MicIcon />
              Timer only
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-lg"
                onClick={stopAndLog}
              >
                <SquareIcon />
                Stop & log
              </Button>
              <Button
                variant="ghost"
                className="rounded-lg text-muted-foreground"
                onClick={reset}
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
