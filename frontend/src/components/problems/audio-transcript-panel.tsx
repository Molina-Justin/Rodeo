import * as React from "react"
import { RotateCcwIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useDeleteAttemptRecording } from "@/hooks/use-attempts"
import { useTranscription } from "@/hooks/use-transcription"

function TranscriptBody({
  isLoading,
  status,
  text,
  errorMessage,
  onRetry,
  retrying,
}: {
  isLoading: boolean
  status: string | undefined
  text: string | null | undefined
  errorMessage: string | null | undefined
  onRetry: () => void
  retrying: boolean
}) {
  if (isLoading || status === "queued" || status === "processing") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3.5" />
        Transcribing audio…
      </div>
    )
  }

  if (status === "failed") {
    return (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">
          {errorMessage ?? "Transcription failed."}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 rounded-md"
          disabled={retrying}
          onClick={onRetry}
        >
          <RotateCcwIcon />
          Retry
        </Button>
      </div>
    )
  }

  if (status === "completed") {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm whitespace-pre-wrap select-text">
        {text?.trim() ? text : (
          <span className="text-muted-foreground">
            No speech was detected in this recording.
          </span>
        )}
      </p>
    )
  }

  return null
}

interface AudioTranscriptPanelProps {
  attemptId: string
  audioUrl: string
}

export function AudioTranscriptPanel({
  attemptId,
  audioUrl,
}: AudioTranscriptPanelProps) {
  const { transcription, isLoading, retry } = useTranscription(attemptId, true)
  const deleteRecording = useDeleteAttemptRecording()
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <audio
          controls
          preload="metadata"
          className="h-9 w-full min-w-0 flex-1"
          src={audioUrl}
        >
          Your browser does not support audio playback.
        </audio>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-destructive"
          aria-label="Delete recording"
          disabled={deleteRecording.isPending}
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2Icon />
        </Button>
      </div>

      {confirmingDelete ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs">
          <span>Delete this recording and its transcript?</span>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 rounded-md"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 rounded-md"
              disabled={deleteRecording.isPending}
              onClick={() =>
                deleteRecording.mutate(attemptId, {
                  onSuccess: () => setConfirmingDelete(false),
                })
              }
            >
              Delete
            </Button>
          </div>
        </div>
      ) : null}

      <TranscriptBody
        isLoading={isLoading}
        status={transcription?.status}
        text={transcription?.text}
        errorMessage={transcription?.errorMessage}
        onRetry={() => retry.mutate()}
        retrying={retry.isPending}
      />
    </div>
  )
}
