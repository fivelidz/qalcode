/**
 * Session Tabs - Unified tab bar for navigating between parent and subagent sessions
 * 
 * Features:
 * - Shows parent session as first tab (in red/primary, no close button)
 * - Shows all subagent sessions with numbers (#1, #2, etc.)
 * - Tab controls: × close, ▶ split open, ◀ close split
 * - Active tab highlighted differently
 * - Works on both parent and subagent views
 * - Click to switch sessions
 */
import { createMemo, createSignal, For, Show } from "solid-js"
import type { Accessor, Setter } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useKeybind } from "@tui/context/keybind"

interface SessionTab {
  sessionID: string
  title: string
  shortName: string
  status: "busy" | "idle" | "error"
  isParent: boolean
  taskNumber?: number
  agentType?: string
}

export interface SessionTabsProps {
  currentSessionID: string
  onNavigateToSession: (sessionID: string) => void
  // Split panel state
  splitSessionIDs?: Accessor<Set<string>>
  onSplitOpen?: (sessionID: string) => void
  onSplitClose?: (sessionID: string) => void
  onCloseSession?: (sessionID: string) => void
}

export function SessionTabs(props: SessionTabsProps) {
  const sync = useSync()
  const { theme } = useTheme()
  const keybind = useKeybind()
  
  const [hoveredTab, setHoveredTab] = createSignal<string | null>(null)
  const [hoveredControl, setHoveredControl] = createSignal<string | null>(null)
  
  // Get current session info
  const currentSession = createMemo(() => sync.session.get(props.currentSessionID))
  
  // Determine the "family" of sessions - find the root parent
  const rootSessionID = createMemo(() => {
    const current = currentSession()
    if (!current) return props.currentSessionID
    if (current.parentID) return current.parentID
    return current.id
  })
  
  const rootSession = createMemo(() => sync.session.get(rootSessionID()))
  
  // Get all child sessions of the root
  const childSessions = createMemo(() => {
    return sync.data.session
      .filter(s => s.parentID === rootSessionID())
      .sort((a, b) => a.time.created - b.time.created)
  })
  
  // Check if a session is split open
  const isSplitOpen = (sessionID: string) => {
    return props.splitSessionIDs?.()?.has(sessionID) ?? false
  }
  
  // Build the unified tab list
  const tabs = createMemo((): SessionTab[] => {
    const result: SessionTab[] = []
    
    // Add parent session first
    const parent = rootSession()
    if (parent) {
      const status = sync.data.session_status[parent.id]
      result.push({
        sessionID: parent.id,
        title: parent.title || "Main Session",
        shortName: "main",
        status: status?.type === "busy" ? "busy" : status?.type === "retry" ? "error" : "idle",
        isParent: true,
      })
    }
    
    // Add all subagent sessions
    childSessions().forEach((session, index) => {
      const status = sync.data.session_status[session.id]
      const agentType = extractAgentType(session.title)
      const shortName = extractShortName(session.title)
      
      result.push({
        sessionID: session.id,
        title: session.title || "Subagent",
        shortName,
        status: status?.type === "busy" ? "busy" : status?.type === "retry" ? "error" : "idle",
        isParent: false,
        taskNumber: index + 1,
        agentType,
      })
    })
    
    return result
  })
  
  // Check if we have any subagents
  const hasSubagents = createMemo(() => childSessions().length > 0)
  
  return (
    <Show when={hasSubagents()}>
      <box 
        flexDirection="row" 
        backgroundColor={theme.backgroundPanel}
        paddingLeft={1}
        paddingRight={1}
        gap={1}
        flexShrink={0}
        borderColor={theme.border}
        border={["bottom"]}
      >
        {/* Tabs */}
        <For each={tabs()}>
          {(tab) => {
            const isActive = () => tab.sessionID === props.currentSessionID
            const isHovered = () => hoveredTab() === tab.sessionID
            const isSplit = () => isSplitOpen(tab.sessionID)
            
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
            
            // Tab styling based on state
            const tabBg = () => {
              if (isActive()) return theme.backgroundElement
              if (isSplit()) return theme.backgroundElement
              if (isHovered()) return theme.backgroundPanel
              return undefined
            }
            
            // Active tab gets accent border, split tabs get secondary border
            const tabBorderColor = () => {
              if (isActive()) return theme.accent
              if (isSplit()) return theme.secondary
              return undefined
            }
            
            return (
              <box
                onMouseDown={() => props.onNavigateToSession(tab.sessionID)}
                onMouseOver={() => setHoveredTab(tab.sessionID)}
                onMouseOut={() => setHoveredTab(null)}
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={tabBg()}
                border={isActive() || isSplit() ? ["bottom"] : undefined}
                borderColor={tabBorderColor()}
                flexDirection="row"
                gap={1}
              >
                {/* Tab label */}
                <text fg={isActive() || isHovered() ? theme.text : theme.textMuted}>
                  <span style={{ fg: statusColor() }}>{statusIcon()}</span>
                  {" "}
                  <Show when={tab.isParent} fallback={
                    <>
                      <span style={{ fg: isActive() ? theme.accent : theme.secondary }}>#{tab.taskNumber}</span>
                      {" "}
                      {tab.shortName}
                    </>
                  }>
                    <span style={{ fg: theme.error }}>◆ main</span>
                  </Show>
                </text>
                
                {/* Controls for subagent tabs */}
                <Show when={!tab.isParent}>
                  {/* Split/unsplit button */}
                  <Show when={isSplit()}>
                    <box onMouseDown={(e) => { e.stopPropagation?.(); props.onSplitClose?.(tab.sessionID) }}>
                      <text fg={theme.warning}>◀</text>
                    </box>
                  </Show>
                  <Show when={!isActive() && !isSplit()}>
                    <box onMouseDown={(e) => { e.stopPropagation?.(); props.onSplitOpen?.(tab.sessionID) }}>
                      <text fg={theme.textMuted}>▶</text>
                    </box>
                  </Show>
                  {/* Close button */}
                  <box onMouseDown={(e) => { e.stopPropagation?.(); props.onCloseSession?.(tab.sessionID) }}>
                    <text fg={theme.textMuted}>×</text>
                  </box>
                </Show>
              </box>
            )
          }}
        </For>
        
        {/* Spacer */}
        <box flexGrow={1} />
      </box>
    </Show>
  )
}

// Helper to create split panel state
export function createSplitPanelState() {
  const [splitSessionIDs, setSplitSessionIDs] = createSignal<Set<string>>(new Set())
  
  return {
    splitSessionIDs,
    addSplit: (sessionID: string) => {
      setSplitSessionIDs(prev => {
        const next = new Set(prev)
        next.add(sessionID)
        return next
      })
    },
    removeSplit: (sessionID: string) => {
      setSplitSessionIDs(prev => {
        const next = new Set(prev)
        next.delete(sessionID)
        return next
      })
    },
    toggleSplit: (sessionID: string) => {
      setSplitSessionIDs(prev => {
        const next = new Set(prev)
        if (next.has(sessionID)) {
          next.delete(sessionID)
        } else {
          next.add(sessionID)
        }
        return next
      })
    },
    hasSplit: (sessionID: string) => splitSessionIDs().has(sessionID),
    clearSplits: () => setSplitSessionIDs(new Set<string>()),
  }
}

// Helper functions

function extractAgentType(title: string): string | undefined {
  const match = title.match(/@([a-z-]+)\s+subagent/i)
  return match ? match[1] : undefined
}

function extractShortName(title: string): string {
  if (!title) return "task"
  
  // Remove the (@agent subagent) suffix
  let shortName = title.replace(/\s*\(@[a-z-]+\s+subagent\)\s*$/i, "").trim()
  
  if (!shortName) {
    const agentType = extractAgentType(title)
    return agentType || "task"
  }
  
  // Keep full name, just lowercase it
  return shortName.toLowerCase()
}
