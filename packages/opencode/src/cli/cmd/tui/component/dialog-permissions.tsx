/**
 * Permissions Management Dialog - View and manage tool permission settings
 */
import { createMemo, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useToast } from "@tui/ui/toast"

type PermissionLevel = "ask" | "allow" | "deny"

interface PermissionConfig {
  tool: string
  displayName: string
  description: string
  level: PermissionLevel
  risk: "low" | "medium" | "high"
}

const TOOL_INFO: Record<string, { displayName: string; description: string; risk: "low" | "medium" | "high" }> = {
  read: { displayName: "Read Files", description: "Read file contents from disk", risk: "low" },
  write: { displayName: "Write Files", description: "Create or overwrite files", risk: "medium" },
  edit: { displayName: "Edit Files", description: "Modify existing file contents", risk: "medium" },
  bash: { displayName: "Shell Commands", description: "Execute terminal commands", risk: "high" },
  glob: { displayName: "Find Files", description: "Search for files by pattern", risk: "low" },
  grep: { displayName: "Search Content", description: "Search file contents", risk: "low" },
  webfetch: { displayName: "Web Fetch", description: "Fetch content from URLs", risk: "medium" },
  task: { displayName: "Subagents", description: "Spawn sub-agents for tasks", risk: "medium" },
  doom_loop: { displayName: "Doom Loop", description: "Allow repeated tool calls", risk: "medium" },
  external_directory: { displayName: "External Dirs", description: "Access files outside project", risk: "high" },
}

export function DialogPermissions() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const toast = useToast()

  // Get current permission levels from config
  const permissions = createMemo((): PermissionConfig[] => {
    const config = sync.data.config.permission ?? {}
    return Object.entries(TOOL_INFO).map(([tool, info]) => {
      const configValue = (config as Record<string, string | undefined>)[tool]
      let level: PermissionLevel = "ask"
      if (configValue === "allow") level = "allow"
      if (configValue === "deny") level = "deny"
      return {
        tool,
        ...info,
        level,
      }
    })
  })

  // Pending permissions count
  const pendingCount = createMemo(() => {
    let count = 0
    for (const sessionID in sync.data.permission) {
      count += sync.data.permission[sessionID]?.length ?? 0
    }
    return count
  })

  const levelIcon = (level: PermissionLevel) => {
    switch (level) {
      case "allow":
        return "✓"
      case "deny":
        return "✗"
      default:
        return "?"
    }
  }

  const riskLabel = (risk: PermissionConfig["risk"]) => {
    switch (risk) {
      case "high":
        return "[HIGH]"
      case "medium":
        return "[MED]"
      default:
        return "[LOW]"
    }
  }

  const options = createMemo((): DialogSelectOption<string>[] =>
    permissions().map((perm) => ({
      title: `[${levelIcon(perm.level)}] ${perm.displayName} ${riskLabel(perm.risk)}`,
      value: perm.tool,
      description: `${perm.level} - ${perm.description}`,
      category:
        perm.level === "allow" ? "Allowed" : perm.level === "deny" ? "Denied" : "Ask Permission",
    })),
  )

  const title = createMemo(() => {
    const pending = pendingCount()
    return pending > 0 ? `Permissions (${pending} pending)` : "Permission Settings"
  })

  return (
    <DialogSelect
      title={title()}
      placeholder="Search permissions..."
      options={options()}
      onSelect={(option) => {
        const perm = permissions().find((p) => p.tool === option.value)
        if (perm) {
          toast.show({
            message: `To change "${perm.displayName}", edit .opencode.json: "permission": { "${perm.tool}": "allow|ask|deny" }`,
            variant: "info",
            duration: 5000,
          })
        }
        dialog.clear()
      }}
    />
  )
}
