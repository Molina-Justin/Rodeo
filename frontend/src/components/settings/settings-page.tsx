import * as React from "react"
import {
  BellRingIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  DownloadIcon,
  HardDriveIcon,
  MoonIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof BellRingIcon
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsPage() {
  const [notifications, setNotifications] = React.useState(true)
  const [compactMode, setCompactMode] = React.useState(false)
  const [clearText, setClearText] = React.useState("")

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-10">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Preferences
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Manage your study workspace, notifications, and local data.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDriveIcon className="size-4 text-emerald-600" />
                Your data
              </CardTitle>
              <CardDescription>
                Keep a portable copy of your attempts, notes, recordings, and
                transcripts.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="rounded-lg border border-border bg-muted/35 p-3.5">
                <p className="text-sm font-medium">Export your workspace</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Download a complete backup package you can keep or restore on
                  another Rodeo installation.
                </p>
                <Button className="mt-3" disabled title="Server export is not available yet">
                  <DownloadIcon /> Export all data
                </Button>
              </div>
              <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                Exports stay on this device. Rodeo does not upload your recordings
                or notes to a cloud service.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Study preferences</CardTitle>
              <CardDescription>Small defaults that shape your daily workspace.</CardDescription>
            </CardHeader>
            <CardContent className="divide-y divide-border">
              <SettingRow icon={BellRingIcon} title="Review reminders" description="Show a reminder when problems are due for review.">
                <Switch checked={notifications} onCheckedChange={setNotifications} />
              </SettingRow>
              <SettingRow icon={MoonIcon} title="Compact tables" description="Fit more problem rows on screen when browsing the catalog.">
                <Switch checked={compactMode} onCheckedChange={setCompactMode} />
              </SettingRow>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>About this workspace</CardTitle>
              <CardDescription>Everything is stored locally on this installation.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Storage</span>
                <span className="font-medium">Local only</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Transcription</span>
                <span className="font-medium">On-device</span>
              </div>
              <button className="mt-1 flex items-center justify-between border-t pt-3 text-left text-sm text-muted-foreground hover:text-foreground">
                Help and documentation <ChevronRightIcon className="size-4" />
              </button>
            </CardContent>
          </Card>

          <Card className="border-destructive/25">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2Icon className="size-4" /> Danger zone
              </CardTitle>
              <CardDescription>
                Permanently remove your local workspace and start fresh.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger render={<Button variant="destructive" />}>
                  <Trash2Icon /> Clear all data
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogMedia className="bg-destructive/10 text-destructive">
                      <Trash2Icon />
                    </AlertDialogMedia>
                    <AlertDialogTitle>Clear your workspace?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete attempts, notes, recordings,
                      transcripts, and settings. Export a backup first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid gap-2">
                    <Label htmlFor="clear-workspace">Type CLEAR to confirm</Label>
                    <Input id="clear-workspace" value={clearText} onChange={(event) => setClearText(event.target.value)} placeholder="CLEAR" />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setClearText("")}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={clearText !== "CLEAR"} title="Server data reset is not available yet">
                      Permanently clear data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground">
                <CircleHelpIcon className="mt-0.5 size-3.5 shrink-0" />
                This action will become available with the server backup and reset
                workflow.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
