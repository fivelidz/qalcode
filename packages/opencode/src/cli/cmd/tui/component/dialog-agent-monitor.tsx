/**
 * Agent Monitor Dialog - Real-time view of running agents and subagents
 */
import { createMemo, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { Locale } from "@/util/locale"

interface AgentInfo {
  id: string
  name: string
  status: "busy" | "idle" | "retry"
  parentID?: string
  startTime: number
  model?: string
  toolsUsed: number
}

export function DialogAgentMonitor() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()

  // Get all active sessions and their statuses
  const agents = createMemo(() => {
    const sessions = sync.data.session
    const statuses = sync.data.session_status

    return sessions.map((session): AgentInfo => {
      const status = statuses[session.id]
      const messages = sync.data.message[session.id] ?? []
      const lastAssistant = messages.findLast((m) => m.role === "assistant")

      // Count tool calls
      const toolsUsed = messages.reduce((count, msg) => {
        const parts = sync.data.part[msg.id] ?? []
        return count + parts.filter((p) => p.type === "tool").length
      }, 0)

      return {
        id: session.id,
        name: session.title || "Untitled",
        status: status?.type === "busy" ? "busy" : status?.type === "retry" ? "retry" : "idle",
        parentID: session.parentID,
        startTime: session.time.created,
        model: lastAssistant?.modelID,
        toolsUsed,
      }
    })
  })

  // Running agents count
  const runningCount = createMemo(() => agents().filter((a) => a.status === "busy").length)

  const statusColor = (status: AgentInfo["status"]) => {
    switch (status) {
      case "busy":
        return theme.success
      case "retry":
        return theme.warning
      default:
        return theme.textMuted
    }
  }

  const statusIcon = (status: AgentInfo["status"]) => {
    switch (status) {
      case "busy":
        return "●"
      case "retry":
        return "○"
      default:
        return "◌"
    }
  }

  const options = createMemo((): DialogSelectOption<string>[] =>
    agents().map((agent) => ({
      title: `${agent.parentID ? "  └─ " : ""}${agent.name.slice(0, 30)}`,
      value: agent.id,
      description: `${statusIcon(agent.status)} ${agent.status} | ${agent.toolsUsed} tools | ${agent.model?.split("/").pop() ?? "no model"}`,
    })),
  )

  return (
    <DialogSelect
      title={`Agent Monitor (${runningCount()} active)`}
      options={options()}
      onSelect={(option) => {
        route.navigate({
          type: "session",
          sessionID: option.value,
        })
        dialog.clear()
      }}
    />
  )
}
