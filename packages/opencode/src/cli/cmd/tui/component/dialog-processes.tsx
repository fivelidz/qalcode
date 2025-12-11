/**
 * Process Viewer Dialog - View running and completed background processes
 */
import { createMemo, createSignal, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { Locale } from "@/util/locale"
import stripAnsi from "strip-ansi"

interface ProcessInfo {
  id: string
  command: string
  description?: string
  status: "running" | "completed" | "error"
  output?: string
  startTime: number
  endTime?: number
  sessionID: string
  sessionTitle: string
}

export function DialogProcesses() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  // Extract all bash tool calls across sessions
  const allProcesses = createMemo(() => {
    const processes: ProcessInfo[] = []

    for (const session of sync.data.session) {
      const messages = sync.data.message[session.id] ?? []

      for (const message of messages) {
        const parts = sync.data.part[message.id] ?? []

        for (const part of parts) {
          if (part.type === "tool" && part.tool === "bash") {
            const state = part.state
            const input = state.input as { command?: string; description?: string }
            const metadata = state.status !== "pending" ? (state.metadata as { output?: string }) : {}

            let status: ProcessInfo["status"] = "running"
            if (state.status === "completed") status = "completed"
            if (state.status === "error") status = "error"

            const msgTime = message.time as { created: number; completed?: number }

            processes.push({
              id: part.callID,
              command: input?.command ?? "unknown",
              description: input?.description,
              status,
              output: metadata?.output ? stripAnsi(metadata.output) : undefined,
              startTime: msgTime.created,
              endTime: msgTime.completed,
              sessionID: session.id,
              sessionTitle: session.title || "Untitled",
            })
          }
        }
      }
    }

    // Sort by start time, most recent first
    return processes.sort((a, b) => b.startTime - a.startTime)
  })

  // Stats
  const stats = createMemo(() => {
    const all = allProcesses()
    return {
      total: all.length,
      running: all.filter((p) => p.status === "running").length,
      completed: all.filter((p) => p.status === "completed").length,
      error: all.filter((p) => p.status === "error").length,
    }
  })

  const statusIcon = (status: ProcessInfo["status"]) => {
    switch (status) {
      case "running":
        return "◐"
      case "completed":
        return "✓"
      case "error":
        return "✗"
    }
  }

  const options = createMemo((): DialogSelectOption<string>[] =>
    allProcesses().slice(0, 50).map((proc) => {
      const duration = proc.endTime ? proc.endTime - proc.startTime : Date.now() - proc.startTime
      return {
        title: `${statusIcon(proc.status)} ${proc.description || proc.command.slice(0, 40)}`,
        value: proc.id,
        description: `${proc.sessionTitle.slice(0, 15)} | ${Locale.duration(duration)}`,
        category: proc.status === "running" ? "Running" : proc.status === "error" ? "Errors" : "Completed",
      }
    }),
  )

  const title = createMemo(() => {
    const s = stats()
    return `Processes (${s.running} running, ${s.completed} done, ${s.error} errors)`
  })

  return (
    <DialogSelect
      title={title()}
      placeholder="Search processes..."
      options={options()}
      onSelect={(option) => {
        const proc = allProcesses().find((p) => p.id === option.value)
        if (proc) {
          route.navigate({
            type: "session",
            sessionID: proc.sessionID,
          })
        }
        dialog.clear()
      }}
    />
  )
}
