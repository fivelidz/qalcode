/**
 * Split Session Panel - Read-only view of a subagent session for side-by-side monitoring
 * 
 * Shows:
 * - Session title/status header
 * - Scrollable message history (read-only)
 * - Current activity indicator
 * 
 * Used when user clicks ▶ to split open a subagent tab
 */
import { createMemo, createSignal, For, Show, onMount, onCleanup } from "solid-js"
import type { Accessor, Setter } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { SplitBorder } from "@tui/component/border"
import type { ScrollBoxRenderable } from "@opentui/core"
import type { Part, AssistantMessage, UserMessage } from "@opencode-ai/sdk/v2"

export interface SplitSessionPanelProps {
  sessionID: string
  onClose: () => void
  isActive: boolean  // Whether this panel has focus for sidebar updates
  onActivate: () => void  // Called when user clicks to focus this panel
}

export function SplitSessionPanel(props: SplitSessionPanelProps) {
  const sync = useSync()
  const { theme } = useTheme()
  
  const session = createMemo(() => sync.session.get(props.sessionID))
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])
  const status = createMemo(() => sync.data.session_status[props.sessionID])
  
  let scrollRef: ScrollBoxRenderable | undefined
  
  // Auto-scroll to bottom when new messages arrive
  const messageCount = createMemo(() => messages().length)
  let lastCount = 0
  
  // Poll for updates and auto-scroll
  const interval = setInterval(() => {
    const count = messageCount()
    if (count > lastCount && scrollRef) {
      scrollRef.scrollTo(scrollRef.scrollHeight)
      lastCount = count
    }
  }, 500)
  
  onCleanup(() => clearInterval(interval))
  
  // Extract short title
  const shortTitle = createMemo(() => {
    const s = session()
    if (!s) return "Session"
    let title = s.title || "Subagent"
    // Remove (@agent subagent) suffix
    title = title.replace(/\s*\(@[a-z-]+\s+subagent\)\s*$/i, "").trim()
    if (title.length > 30) {
      return title.slice(0, 27) + "..."
    }
    return title
  })
  
  const statusColor = createMemo(() => {
    const s = status()
    if (!s) return theme.textMuted
    switch (s.type) {
      case "busy": return theme.warning
      case "retry": return theme.error
      default: return theme.success
    }
  })
  
  const statusIcon = createMemo(() => {
    const s = status()
    if (!s) return "○"
    switch (s.type) {
      case "busy": return "●"
      case "retry": return "!"
      default: return "○"
    }
  })
  
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      border={props.isActive ? ["top", "bottom", "left", "right"] : ["left"]}
      borderColor={props.isActive ? theme.accent : theme.border}
      onMouseDown={props.onActivate}
    >
      {/* Header */}
      <box
        flexDirection="row"
        backgroundColor={theme.backgroundPanel}
        paddingLeft={1}
        paddingRight={1}
        flexShrink={0}
      >
        <text fg={statusColor()}>
          {statusIcon()}
        </text>
        <text fg={theme.text} paddingLeft={1} flexGrow={1}>
          {shortTitle()}
        </text>
        <box
          onMouseDown={(e) => {
            e.stopPropagation?.()
            props.onClose()
          }}
        >
          <text fg={theme.textMuted}>×</text>
        </box>
      </box>
      
      {/* Message list - read only */}
      <scrollbox
        ref={(r) => (scrollRef = r)}
        flexGrow={1}
        stickyScroll={true}
        stickyStart="bottom"
        paddingLeft={1}
        paddingRight={1}
      >
        <For each={messages()}>
          {(message) => (
            <Show when={message.role === "user"}>
              <SplitUserMessage 
                message={message as UserMessage}
                parts={sync.data.part[message.id] ?? []}
              />
            </Show>
          )}
        </For>
        <For each={messages()}>
          {(message) => (
            <Show when={message.role === "assistant"}>
              <SplitAssistantMessage
                message={message as AssistantMessage}
                parts={sync.data.part[message.id] ?? []}
              />
            </Show>
          )}
        </For>
      </scrollbox>
      
      {/* Status bar */}
      <box
        backgroundColor={theme.backgroundElement}
        paddingLeft={1}
        flexShrink={0}
      >
        <text fg={theme.textMuted}>
          {status()?.type === "busy" ? "Working..." : "Idle"}
          {" · "}
          {messages().length} messages
        </text>
      </box>
    </box>
  )
}

function SplitUserMessage(props: { message: UserMessage; parts: Part[] }) {
  const { theme } = useTheme()
  const text = createMemo(() => 
    props.parts.flatMap((x) => (x.type === "text" && !x.synthetic ? [x] : []))[0]
  )
  
  return (
    <Show when={text()}>
      <box
        border={["left"]}
        borderColor={theme.accent}
        customBorderChars={SplitBorder.customBorderChars}
        marginTop={1}
        paddingLeft={1}
        backgroundColor={theme.backgroundPanel}
      >
        <text fg={theme.text}>
          {text()!.text.length > 100 ? text()!.text.slice(0, 97) + "..." : text()!.text}
        </text>
      </box>
    </Show>
  )
}

function SplitAssistantMessage(props: { message: AssistantMessage; parts: Part[] }) {
  const { theme } = useTheme()
  
  // Get text parts and tool summaries
  const textParts = createMemo(() => 
    props.parts.filter((p) => p.type === "text").slice(0, 2) as Array<{ type: "text"; text: string }>
  )
  const toolParts = createMemo(() => 
    props.parts.filter((p) => p.type === "tool") as Array<{ type: "tool"; tool: string; state: any }>
  )
  
  return (
    <box marginTop={1} paddingLeft={2}>
      {/* Show first text snippet */}
      <For each={textParts()}>
        {(part) => (
          <text fg={theme.text}>
            {part.text.length > 80 ? part.text.slice(0, 77) + "..." : part.text.slice(0, 80)}
          </text>
        )}
      </For>
      
      {/* Show tool summary */}
      <Show when={toolParts().length > 0}>
        <text fg={theme.textMuted}>
          {toolParts().length} tool{toolParts().length > 1 ? "s" : ""}: {" "}
          {toolParts().slice(0, 3).map(t => t.tool).join(", ")}
          {toolParts().length > 3 ? ` +${toolParts().length - 3} more` : ""}
        </text>
      </Show>
    </box>
  )
}

/**
 * Container for multiple split panels
 */
export interface SplitPanelContainerProps {
  splitSessionIDs: Accessor<Set<string>>
  onCloseSplit: (sessionID: string) => void
  activeSessionID: Accessor<string | undefined>
  onActivateSession: (sessionID: string) => void
}

export function SplitPanelContainer(props: SplitPanelContainerProps) {
  const splitArray = createMemo(() => Array.from(props.splitSessionIDs()))
  
  return (
    <Show when={splitArray().length > 0}>
      <box flexDirection="row" flexGrow={1} minHeight={10} maxHeight={20}>
        <For each={splitArray()}>
          {(sessionID) => (
            <SplitSessionPanel
              sessionID={sessionID}
              onClose={() => props.onCloseSplit(sessionID)}
              isActive={props.activeSessionID() === sessionID}
              onActivate={() => props.onActivateSession(sessionID)}
            />
          )}
        </For>
      </box>
    </Show>
  )
}
