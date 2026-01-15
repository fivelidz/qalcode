/**
 * Subagent Panel - Tabbed view for monitoring active subagents
 * 
 * Features:
 * - Shows tabs for each active subagent session
 * - Can be minimized to just show tabs (saves vertical space)
 * - Clicking a tab expands it to show full session content
 * - Real-time streaming of subagent activity
 * - Full mouse support with hover states
 * - Keyboard navigation with configurable keybinds
 */
import { createMemo, createSignal, createEffect, For, Show, batch } from "solid-js"
import type { Accessor, Setter } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useKeybind } from "@tui/context/keybind"
import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2"

interface SubagentTab {
  sessionID: string
  title: string
  status: "busy" | "idle" | "error"
  agentType?: string
  shortName: string      // Short descriptive name (e.g., "explore files", "build check")
  taskNumber: number     // Sequential number for easy reference
  toolCount: number
}

export interface SubagentPanelProps {
  parentSessionID: string
  onNavigateToSession?: (sessionID: string) => void
  // Optional external state control
  minimized?: Accessor<boolean>
  setMinimized?: Setter<boolean>
  activeTabIndex?: Accessor<number>
  setActiveTabIndex?: Setter<number>
}

export function SubagentPanel(props: SubagentPanelProps) {
  const sync = useSync()
  const { theme } = useTheme()
  const keybind = useKeybind()
  
  // Panel state - use provided state or create local state
  const [localMinimized, setLocalMinimized] = createSignal(false)
  const [localActiveTabIndex, setLocalActiveTabIndex] = createSignal(0)
  
  // Hover states for visual feedback
  const [hoveredTab, setHoveredTab] = createSignal<number | null>(null)
  const [toggleHovered, setToggleHovered] = createSignal(false)
  const [focusButtonHovered, setFocusButtonHovered] = createSignal(false)
  
  const minimized = () => props.minimized ? props.minimized() : localMinimized()
  const setMinimized = (v: boolean | ((prev: boolean) => boolean)) => {
    const setter = props.setMinimized || setLocalMinimized
    if (typeof v === 'function') {
      setter(v(minimized()))
    } else {
      setter(v)
    }
  }
  
  const activeTabIndex = () => props.activeTabIndex ? props.activeTabIndex() : localActiveTabIndex()
  const setActiveTabIndex = (v: number | ((prev: number) => number)) => {
    const setter = props.setActiveTabIndex || setLocalActiveTabIndex
    if (typeof v === 'function') {
      setter(v(activeTabIndex()))
    } else {
      setter(v)
    }
  }
  
  const panelHeight = 10 // Fixed height when expanded
  
  // Get all child sessions (subagents) of the parent session
  const childSessions = createMemo(() => {
    return sync.data.session
      .filter(s => s.parentID === props.parentSessionID)
      .sort((a, b) => a.time.created - b.time.created)
  })
  
  // Build tabs from child sessions with real-time tool counts
  const tabs = createMemo((): SubagentTab[] => {
    return childSessions().map((session, index) => {
      const status = sync.data.session_status[session.id]
      const agentType = extractAgentType(session.title)
      const shortName = extractShortName(session.title)
      
      // Count tools across all messages
      const messages = sync.data.message[session.id] ?? []
      const toolCount = messages.reduce((count, msg) => {
        const parts = sync.data.part[msg.id] ?? []
        return count + parts.filter(p => p.type === "tool").length
      }, 0)
      
      return {
        sessionID: session.id,
        title: session.title || "Subagent",
        status: status?.type === "busy" ? "busy" : status?.type === "retry" ? "error" : "idle",
        agentType,
        shortName,
        taskNumber: index + 1,
        toolCount,
      }
    })
  })
  
  // Currently selected tab
  const activeTab = createMemo(() => {
    const t = tabs()
    const idx = activeTabIndex()
    if (idx >= 0 && idx < t.length) return t[idx]
    return t[0]
  })
  
  // Ensure sync of subagent session data
  createEffect(() => {
    const tab = activeTab()
    if (tab) {
      // Trigger sync for the active subagent session
      sync.session.sync(tab.sessionID).catch(() => {})
    }
  })
  
  // Get messages for active subagent
  const activeMessages = createMemo(() => {
    const tab = activeTab()
    if (!tab) return []
    return sync.data.message[tab.sessionID] ?? []
  })
  
  // Get the latest activity summary for display
  const latestActivity = createMemo(() => {
    const messages = activeMessages()
    if (messages.length === 0) return null
    
    const lastAssistant = messages.findLast(m => m.role === "assistant") as AssistantMessage | undefined
    if (!lastAssistant) return null
    
    const parts = sync.data.part[lastAssistant.id] ?? []
    return {
      message: lastAssistant,
      parts,
      toolCount: parts.filter(p => p.type === "tool").length,
      lastTool: parts.findLast(p => p.type === "tool") as Part | undefined,
    }
  })
  
  // Auto-focus busy tab when subagent starts
  createEffect(() => {
    const t = tabs()
    const busyIndex = t.findIndex(tab => tab.status === "busy")
    if (busyIndex >= 0 && busyIndex !== activeTabIndex()) {
      // Only auto-switch if we're not already on a busy tab
      const currentTab = t[activeTabIndex()]
      if (!currentTab || currentTab.status !== "busy") {
        setActiveTabIndex(busyIndex)
        if (minimized()) {
          setMinimized(false)
        }
      }
    }
  })
  
  // Don't render if no subagents
  const hasSubagents = createMemo(() => tabs().length > 0)
  
  return (
    <Show when={hasSubagents()}>
      <box 
        flexShrink={0}
        border={["top"]}
        borderColor={theme.border}
      >
        {/* Tab bar - always visible */}
        <box 
          flexDirection="row" 
          backgroundColor={theme.backgroundPanel}
          paddingLeft={1}
          paddingRight={1}
          gap={1}
          flexShrink={0}
        >
          {/* Minimize/Maximize button - clickable */}
          <box 
            onMouseDown={() => setMinimized(!minimized())}
            onMouseOver={() => setToggleHovered(true)}
            onMouseOut={() => setToggleHovered(false)}
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={toggleHovered() ? theme.backgroundElement : undefined}
          >
            <text fg={toggleHovered() ? theme.text : theme.textMuted}>
              {minimized() ? "▶" : "▼"}
            </text>
          </box>
          
          {/* Panel label - clicking also toggles */}
          <box
            onMouseDown={() => setMinimized(!minimized())}
            onMouseOver={() => setToggleHovered(true)}
            onMouseOut={() => setToggleHovered(false)}
          >
            <text fg={theme.text}>
              <b>Subagents</b>
            </text>
          </box>
          
          {/* Separator */}
          <text fg={theme.border}>│</text>
          
          {/* Tabs - each clickable */}
          <For each={tabs()}>
            {(tab, index) => {
              const isActive = () => index() === activeTabIndex()
              const isHovered = () => hoveredTab() === index()
              const statusColor = () => {
                switch (tab.status) {
                  case "busy": return theme.warning
                  case "error": return theme.error
                  default: return theme.success
                }
              }
              const statusIcon = () => {
                switch (tab.status) {
                  case "busy": return "●"
                  case "error": return "!"
                  default: return "○"
                }
              }
              
              // Tab background: active > hovered > none
              const tabBg = () => {
                if (isActive()) return theme.backgroundElement
                if (isHovered()) return theme.backgroundPanel
                return undefined
              }
              
              return (
                <box
                  onMouseDown={() => {
                    batch(() => {
                      setActiveTabIndex(index())
                      if (minimized()) setMinimized(false)
                    })
                  }}
                  onMouseOver={() => setHoveredTab(index())}
                  onMouseOut={() => setHoveredTab(null)}
                  paddingLeft={1}
                  paddingRight={1}
                  backgroundColor={tabBg()}
                  border={isActive() ? ["bottom"] : undefined}
                  borderColor={isActive() ? theme.accent : undefined}
                >
                  <text fg={isActive() || isHovered() ? theme.text : theme.textMuted}>
                    <span style={{ fg: statusColor() }}>{statusIcon()}</span>
                    <span style={{ fg: theme.accent }}> #{tab.taskNumber}</span>
                    {" "}
                    {tab.shortName}
                    <span style={{ fg: theme.textMuted }}> ({tab.toolCount})</span>
                  </text>
                </box>
              )
            }}
          </For>
          
          {/* Spacer */}
          <box flexGrow={1} />
          
          {/* Tab counter */}
          <text fg={theme.textMuted}>
            {activeTabIndex() + 1}/{tabs().length}
          </text>
        </box>
        
        {/* Panel content - shown when not minimized */}
        <Show when={!minimized() && activeTab()}>
          <box
            height={panelHeight}
            backgroundColor={theme.background}
            paddingLeft={2}
            paddingRight={2}
            paddingTop={1}
            paddingBottom={1}
          >
            <scrollbox flexGrow={1}>
              {/* Session header with number, agent type, and short name */}
              <box flexDirection="row" gap={2} flexShrink={0}>
                <text fg={theme.accent}>
                  <b>#{activeTab()?.taskNumber}</b>
                </text>
                <text fg={theme.secondary}>
                  <b>@{activeTab()?.agentType || "subagent"}</b>
                </text>
                <text fg={theme.text}>
                  <b>{activeTab()?.shortName}</b>
                </text>
                <text fg={theme.textMuted}>
                  ({activeTab()?.toolCount} tools)
                </text>
              </box>
              
              {/* Recent tool activity */}
              <Show when={latestActivity()} fallback={
                <text fg={theme.textMuted} marginTop={1}>
                  Waiting for activity...
                </text>
              }>
                <box marginTop={1}>
                  <For each={latestActivity()?.parts.slice(-6) ?? []}>
                    {(part) => (
                      <Show when={part.type === "tool"}>
                        <text fg={getToolStatusColor(part, theme)}>
                          {getToolIcon(part)} {formatToolSummary(part)}
                        </text>
                      </Show>
                    )}
                  </For>
                </box>
              </Show>
              
              {/* Latest text output preview */}
              <Show when={latestActivity()?.parts.some(p => p.type === "text")}>
                <box marginTop={1} border={["left"]} borderColor={theme.backgroundElement} paddingLeft={1}>
                  <For each={latestActivity()?.parts.filter(p => p.type === "text").slice(-1) ?? []}>
                    {(part) => (
                      <text fg={theme.textMuted} wrapMode="word">
                        {truncateText((part as any).text, 150)}
                      </text>
                    )}
                  </For>
                </box>
              </Show>
            </scrollbox>
            
            {/* Footer with clickable focus button */}
            <box flexDirection="row" gap={2} flexShrink={0}>
              <box
                onMouseDown={() => {
                  const tab = activeTab()
                  if (tab && props.onNavigateToSession) {
                    props.onNavigateToSession(tab.sessionID)
                  }
                }}
                onMouseOver={() => setFocusButtonHovered(true)}
                onMouseOut={() => setFocusButtonHovered(false)}
                backgroundColor={focusButtonHovered() ? theme.backgroundElement : undefined}
                paddingLeft={1}
                paddingRight={1}
              >
                <text fg={focusButtonHovered() ? theme.text : theme.accent}>
                  <b>[ Focus Session ]</b>
                </text>
              </box>
              <text fg={theme.textMuted}>
                Click tabs to switch • {keybind.print("subagent_panel_toggle" as any)} toggle
              </text>
            </box>
          </box>
        </Show>
      </box>
    </Show>
  )
}

// Helper functions

function extractAgentType(title: string): string | undefined {
  // Extract agent type from title like "Task description (@agent-name subagent)"
  const match = title.match(/@([a-z-]+)\s+subagent/i)
  return match ? match[1] : undefined
}

function extractShortName(title: string): string {
  // Extract a short descriptive name from the task title
  // Title format is usually: "Short description (@agent-type subagent)"
  
  if (!title) return "task"
  
  // Remove the (@agent-type subagent) suffix
  let shortName = title.replace(/\s*\(@[a-z-]+\s+subagent\)\s*$/i, "").trim()
  
  // If empty after removal, try to get something useful
  if (!shortName) {
    const agentType = extractAgentType(title)
    return agentType || "task"
  }
  
  // Convert to lowercase for consistency
  shortName = shortName.toLowerCase()
  
  // Truncate if too long (keep it short for tab display)
  if (shortName.length > 20) {
    // Try to cut at a word boundary
    const truncated = shortName.slice(0, 20)
    const lastSpace = truncated.lastIndexOf(' ')
    if (lastSpace > 10) {
      return truncated.slice(0, lastSpace) + "…"
    }
    return truncated + "…"
  }
  
  return shortName
}

function truncateTitle(title: string, maxLen: number): string {
  if (title.length <= maxLen) return title
  return title.slice(0, maxLen - 2) + ".."
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return ""
  const cleaned = text.trim().replace(/\n+/g, " ")
  if (cleaned.length <= maxLen) return cleaned
  return cleaned.slice(0, maxLen - 3) + "..."
}

function getToolIcon(part: Part): string {
  if (part.type !== "tool") return "?"
  const tool = (part as any).tool as string
  switch (tool) {
    case "bash": return "#"
    case "read": return "→"
    case "write": return "←"
    case "edit": return "✎"
    case "glob": return "✱"
    case "grep": return "✱"
    case "list": return "▤"
    case "task": return "◉"
    case "webfetch": return "⇣"
    case "todowrite": return "☑"
    case "todoread": return "☐"
    default: return "⚙"
  }
}

function getToolStatusColor(part: Part, theme: any): string {
  if (part.type !== "tool") return theme.textMuted
  const state = (part as any).state
  if (!state) return theme.textMuted
  switch (state.status) {
    case "completed": return theme.success
    case "error": return theme.error
    case "pending": return theme.warning
    default: return theme.textMuted
  }
}

function formatToolSummary(part: Part): string {
  if (part.type !== "tool") return ""
  const toolPart = part as any
  const tool = toolPart.tool as string
  const input = toolPart.state?.input ?? {}
  const state = toolPart.state ?? {}
  
  switch (tool) {
    case "bash":
      return `${input.description || "Shell"}: ${truncateText(input.command || "", 50)}`
    case "read":
      return `Read ${truncateText(input.filePath || "", 50)}`
    case "write":
      return `Write ${truncateText(input.filePath || "", 50)}`
    case "edit":
      return `Edit ${truncateText(input.filePath || "", 50)}`
    case "glob":
      return `Glob "${input.pattern}" (${state.metadata?.count ?? "..."} matches)`
    case "grep":
      return `Grep "${input.pattern}" (${state.metadata?.matches ?? "..."} matches)`
    case "list":
      return `List ${truncateText(input.path || ".", 50)}`
    case "task":
      return `Subtask: ${input.description || "..."}`
    case "webfetch":
      return `Fetch ${truncateText(input.url || "", 50)}`
    case "todowrite":
      return `Todo: ${state.metadata?.todos?.length ?? "?"} items`
    case "todoread":
      return `Reading todos...`
    default:
      return `${tool}`
  }
}

// Export helper for creating controlled state
export function createSubagentPanelState() {
  const [minimized, setMinimized] = createSignal(false)
  // Start at -1 (no selection) - sidebar shows main session info by default
  const [activeTabIndex, setActiveTabIndex] = createSignal(-1)

  return {
    minimized,
    setMinimized,
    activeTabIndex,
    setActiveTabIndex,
    toggle: () => setMinimized(prev => !prev),
    // Clear selection - sidebar returns to showing main session info
    clearSelection: () => setActiveTabIndex(-1),
    nextTab: (tabCount: number) => {
      if (tabCount === 0) return
      const current = activeTabIndex()
      // If no selection, start at 0
      if (current < 0) {
        setActiveTabIndex(0)
      } else {
        setActiveTabIndex((current + 1) % tabCount)
      }
    },
    prevTab: (tabCount: number) => {
      if (tabCount === 0) return
      const current = activeTabIndex()
      // If no selection, start at last
      if (current < 0) {
        setActiveTabIndex(tabCount - 1)
      } else {
        setActiveTabIndex((current - 1 + tabCount) % tabCount)
      }
    },
  }
}
