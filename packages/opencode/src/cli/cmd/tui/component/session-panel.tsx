/**
 * Session Panel - Reusable session view component for split panel support
 * 
 * This component encapsulates the message list + prompt input for a single session.
 * It can be used standalone or in a split view with multiple panels.
 * 
 * Features:
 * - Scrollable message history
 * - Prompt input (enabled when panel is focused)
 * - Visual focus indicator (border highlight)
 * - Compact mode for split views
 */
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  on,
  Show,
  Switch,
  useContext,
  type Accessor,
  type Setter,
} from "solid-js"
import { Dynamic } from "solid-js/web"
import path from "path"
import { useSync } from "@tui/context/sync"
import { SplitBorder } from "@tui/component/border"
import { useTheme } from "@tui/context/theme"
import {
  BoxRenderable,
  ScrollBoxRenderable,
  MacOSScrollAccel,
  type ScrollAcceleration,
} from "@opentui/core"
import { Prompt, type PromptRef } from "@tui/component/prompt"
import type { AssistantMessage, Part, ToolPart, UserMessage, TextPart, ReasoningPart } from "@opencode-ai/sdk/v2"
import { useLocal } from "@tui/context/local"
import { Locale } from "@/util/locale"
import { useKeyboard, useRenderer, type BoxProps } from "@opentui/solid"
import { useSDK } from "@tui/context/sdk"
import { useKeybind } from "@tui/context/keybind"
import { useCommandDialog } from "@tui/component/dialog-command"
import stripAnsi from "strip-ansi"

// Minimal context for message rendering
const panelContext = createContext<{
  width: number
  conceal: () => boolean
  showThinking: () => boolean
  showTimestamps: () => boolean
  usernameVisible: () => boolean
  showDetails: () => boolean
  diffWrapMode: () => "word" | "none"
  sync: ReturnType<typeof useSync>
  compact: boolean  // Whether in compact split mode
}>()

function usePanelContext() {
  const ctx = useContext(panelContext)
  if (!ctx) throw new Error("usePanelContext must be used within a SessionPanel")
  return ctx
}

export interface SessionPanelProps {
  sessionID: string
  isFocused: boolean
  onFocus: () => void
  compact?: boolean  // Smaller view for splits
  // Display options (can be controlled from parent)
  conceal?: Accessor<boolean>
  showThinking?: Accessor<boolean>
  showTimestamps?: Accessor<boolean>
  usernameVisible?: Accessor<boolean>
  showDetails?: Accessor<boolean>
  showScrollbar?: Accessor<boolean>
  diffWrapMode?: Accessor<"word" | "none">
  // Callbacks
  onSubmit?: () => void
  promptRef?: (ref: PromptRef) => void
}

class CustomSpeedScroll implements ScrollAcceleration {
  constructor(private speed: number) {}
  tick(_now?: number): number { return this.speed }
  reset(): void {}
}

export function SessionPanel(props: SessionPanelProps) {
  const sync = useSync()
  const { theme, syntax, subtleSyntax } = useTheme()
  const sdk = useSDK()
  const keybind = useKeybind()
  const local = useLocal()
  const renderer = useRenderer()
  
  const session = createMemo(() => sync.session.get(props.sessionID))
  const messages = createMemo(() => sync.data.message[props.sessionID] ?? [])
  const permissions = createMemo(() => sync.data.permission[props.sessionID] ?? [])
  const status = createMemo(() => sync.data.session_status[props.sessionID])
  
  // Display state with defaults
  const conceal = props.conceal ?? createSignal(true)[0]
  const showThinking = props.showThinking ?? createSignal(true)[0]
  const showTimestamps = props.showTimestamps ?? createSignal(false)[0]
  const usernameVisible = props.usernameVisible ?? createSignal(true)[0]
  const showDetails = props.showDetails ?? createSignal(true)[0]
  const showScrollbar = props.showScrollbar ?? createSignal(false)[0]
  const diffWrapMode = props.diffWrapMode ?? createSignal<"word" | "none">("word")[0]
  
  const pending = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant" && !x.time.completed)?.id
  })
  
  const lastAssistant = createMemo(() => {
    return messages().findLast((x) => x.role === "assistant")
  })
  
  let scroll: ScrollBoxRenderable
  let prompt: PromptRef
  
  const scrollAcceleration = createMemo(() => {
    const tui = sync.data.config.tui
    if (tui?.scroll_acceleration?.enabled) {
      return new MacOSScrollAccel()
    }
    if (tui?.scroll_speed) {
      return new CustomSpeedScroll(tui.scroll_speed)
    }
    return new CustomSpeedScroll(3)
  })
  
  function toBottom() {
    setTimeout(() => {
      if (scroll) scroll.scrollTo(scroll.scrollHeight)
    }, 50)
  }
  
  // Handle permission responses when focused
  useKeyboard((evt) => {
    if (!props.isFocused) return
    
    const first = permissions()[0]
    if (first) {
      const response = (() => {
        if (evt.ctrl || evt.meta) return
        if (evt.name === "return") return "once"
        if (evt.name === "a") return "always"
        if (evt.name === "d") return "reject"
        if (evt.name === "escape") return "reject"
        return
      })()
      if (response) {
        sdk.client.permission.respond({
          permissionID: first.id,
          sessionID: props.sessionID,
          response: response,
        })
      }
    }
  })
  
  // Auto-scroll on new messages
  createEffect(() => {
    const count = messages().length
    if (count > 0) toBottom()
  })
  
  // Session title for header
  const sessionTitle = createMemo(() => {
    const s = session()
    if (!s) return "Session"
    let title = s.title || "Session"
    // Compact title for split views
    if (props.compact && title.length > 25) {
      return title.slice(0, 22) + "..."
    }
    return title
  })
  
  const statusIndicator = createMemo(() => {
    const s = status()
    if (!s) return { icon: "○", color: theme.textMuted }
    switch (s.type) {
      case "busy": return { icon: "●", color: theme.warning }
      case "retry": return { icon: "!", color: theme.error }
      default: return { icon: "○", color: theme.success }
    }
  })
  
  // Is this a subagent session?
  const isSubagent = createMemo(() => !!session()?.parentID)
  
  // Content width for rendering
  const [panelWidth, setPanelWidth] = createSignal(80)
  
  return (
    <panelContext.Provider
      value={{
        get width() { return panelWidth() },
        conceal,
        showThinking,
        showTimestamps,
        usernameVisible,
        showDetails,
        diffWrapMode,
        sync,
        compact: props.compact ?? false,
      }}
    >
      <box
        flexDirection="column"
        flexGrow={1}
        border={props.isFocused ? ["left", "right"] : ["left"]}
        borderColor={props.isFocused ? theme.accent : theme.border}
        onMouseDown={props.onFocus}
        renderBefore={function() {
          const el = this as BoxRenderable
          setPanelWidth(el.width - 4)
        }}
      >
        {/* Compact header for split panels */}
        <Show when={props.compact}>
          <box
            flexDirection="row"
            backgroundColor={props.isFocused ? theme.backgroundElement : theme.backgroundPanel}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
            gap={1}
          >
            <text fg={statusIndicator().color}>{statusIndicator().icon}</text>
            <text fg={props.isFocused ? theme.text : theme.textMuted} flexGrow={1}>
              {isSubagent() ? "◇ " : "◆ "}
              {sessionTitle()}
            </text>
            <Show when={props.isFocused}>
              <text fg={theme.accent}>focused</text>
            </Show>
          </box>
        </Show>
        
        {/* Message scroll area */}
        <scrollbox
          ref={(r) => (scroll = r)}
          verticalScrollbarOptions={{
            paddingLeft: 1,
            visible: showScrollbar(),
            trackOptions: {
              backgroundColor: theme.backgroundElement,
              foregroundColor: theme.border,
            },
          }}
          stickyScroll={true}
          stickyStart="bottom"
          flexGrow={1}
          scrollAcceleration={scrollAcceleration()}
          paddingLeft={props.compact ? 1 : 2}
          paddingRight={props.compact ? 1 : 2}
        >
          <For each={messages()}>
            {(message, index) => (
              <Switch>
                <Match when={message.role === "user"}>
                  <PanelUserMessage
                    index={index()}
                    message={message as UserMessage}
                    parts={sync.data.part[message.id] ?? []}
                    pending={pending()}
                  />
                </Match>
                <Match when={message.role === "assistant"}>
                  <PanelAssistantMessage
                    last={lastAssistant()?.id === message.id}
                    message={message as AssistantMessage}
                    parts={sync.data.part[message.id] ?? []}
                  />
                </Match>
              </Switch>
            )}
          </For>
        </scrollbox>
        
        {/* Prompt input */}
        <box flexShrink={0} paddingLeft={props.compact ? 1 : 0} paddingRight={props.compact ? 1 : 0}>
          <Prompt
            ref={(r) => {
              prompt = r
              props.promptRef?.(r)
            }}
            disabled={permissions().length > 0 || !props.isFocused}
            onSubmit={() => {
              toBottom()
              props.onSubmit?.()
            }}
            sessionID={props.sessionID}
          />
        </box>
        
        {/* Permission UI */}
        <Show when={permissions().length > 0 && props.isFocused}>
          <box
            backgroundColor={theme.backgroundPanel}
            border={["top"]}
            borderColor={theme.warning}
            paddingLeft={1}
            paddingRight={1}
            flexShrink={0}
          >
            <text fg={theme.warning}>Permission required</text>
            <box flexDirection="row" gap={2}>
              <text fg={theme.text}>
                <b>enter</b>
                <span style={{ fg: theme.textMuted }}> accept</span>
              </text>
              <text fg={theme.text}>
                <b>a</b>
                <span style={{ fg: theme.textMuted }}> always</span>
              </text>
              <text fg={theme.text}>
                <b>d</b>
                <span style={{ fg: theme.textMuted }}> deny</span>
              </text>
            </box>
          </box>
        </Show>
      </box>
    </panelContext.Provider>
  )
}

// Simplified message components for the panel

function PanelUserMessage(props: {
  message: UserMessage
  parts: Part[]
  index: number
  pending?: string
}) {
  const ctx = usePanelContext()
  const local = useLocal()
  const { theme } = useTheme()
  
  const text = createMemo(() => props.parts.flatMap((x) => (x.type === "text" && !x.synthetic ? [x] : []))[0])
  const files = createMemo(() => props.parts.flatMap((x) => (x.type === "file" ? [x] : [])))
  const queued = createMemo(() => props.pending && props.message.id > props.pending)
  const color = createMemo(() => (queued() ? theme.accent : local.agent.color(props.message.agent)))
  
  return (
    <Show when={text()}>
      <box
        id={props.message.id}
        border={["left"]}
        borderColor={color()}
        customBorderChars={SplitBorder.customBorderChars}
        marginTop={props.index === 0 ? 0 : 1}
      >
        <box
          paddingTop={ctx.compact ? 0 : 1}
          paddingBottom={ctx.compact ? 0 : 1}
          paddingLeft={ctx.compact ? 1 : 2}
          backgroundColor={theme.backgroundPanel}
          flexShrink={0}
        >
          <text fg={theme.text}>
            {ctx.compact && text()!.text.length > 60 
              ? text()!.text.slice(0, 57) + "..." 
              : text()!.text}
          </text>
          <Show when={files().length && !ctx.compact}>
            <text fg={theme.textMuted}>[{files().length} file(s)]</text>
          </Show>
          <Show when={!ctx.compact}>
            <text fg={theme.textMuted}>
              {ctx.usernameVisible() ? `${ctx.sync.data.config.username ?? "You "}` : "You "}
              <Show when={queued()}>
                <span style={{ bg: theme.accent, fg: theme.backgroundPanel, bold: true }}> QUEUED </span>
              </Show>
            </text>
          </Show>
        </box>
      </box>
    </Show>
  )
}

function PanelAssistantMessage(props: { message: AssistantMessage; parts: Part[]; last: boolean }) {
  const ctx = usePanelContext()
  const local = useLocal()
  const { theme, syntax, subtleSyntax } = useTheme()
  
  // In compact mode, just show summary
  const textParts = createMemo(() => 
    props.parts.filter((p) => p.type === "text") as TextPart[]
  )
  const toolParts = createMemo(() => 
    props.parts.filter((p) => p.type === "tool") as ToolPart[]
  )
  
  const final = createMemo(() => {
    return props.message.finish && !["tool-calls", "unknown"].includes(props.message.finish)
  })
  
  return (
    <Show when={ctx.compact} fallback={
      // Full rendering for non-compact mode
      <>
        <For each={props.parts}>
          {(part) => (
            <Switch>
              <Match when={part.type === "text" && (part as TextPart).text.trim()}>
                <box paddingLeft={3} marginTop={1} flexShrink={0}>
                  <code
                    filetype="markdown"
                    drawUnstyledText={false}
                    streaming={true}
                    syntaxStyle={syntax()}
                    content={(part as TextPart).text.trim()}
                    conceal={ctx.conceal()}
                    fg={theme.text}
                  />
                </box>
              </Match>
              <Match when={part.type === "tool"}>
                <box paddingLeft={3} marginTop={1}>
                  <text fg={theme.textMuted}>
                    ⚙ {(part as ToolPart).tool}
                  </text>
                </box>
              </Match>
            </Switch>
          )}
        </For>
        <Show when={props.last || final()}>
          <box paddingLeft={3}>
            <text marginTop={1}>
              <span style={{ fg: local.agent.color(props.message.mode) }}>▣ </span>
              <span style={{ fg: theme.text }}>{Locale.titlecase(props.message.mode)}</span>
              <span style={{ fg: theme.textMuted }}> · {props.message.modelID}</span>
            </text>
          </box>
        </Show>
      </>
    }>
      {/* Compact mode - summary only */}
      <box marginTop={1} paddingLeft={2}>
        <Show when={textParts().length > 0}>
          <text fg={theme.text}>
            {textParts()[0].text.slice(0, 50)}
            {textParts()[0].text.length > 50 ? "..." : ""}
          </text>
        </Show>
        <Show when={toolParts().length > 0}>
          <text fg={theme.textMuted}>
            {toolParts().length} tool{toolParts().length > 1 ? "s" : ""}: {toolParts().slice(0, 2).map(t => t.tool).join(", ")}
          </text>
        </Show>
        <Show when={props.last}>
          <text fg={theme.textMuted}>
            ▣ {props.message.modelID.split("/").pop()}
          </text>
        </Show>
      </box>
    </Show>
  )
}

/**
 * Split View Container - Manages multiple SessionPanels side by side
 */
export interface SplitViewProps {
  // Main session (always shown on left)
  mainSessionID: string
  // Split session IDs
  splitSessionIDs: Accessor<Set<string>>
  // Which session is currently focused
  focusedSessionID: Accessor<string>
  onFocusSession: (sessionID: string) => void
  // Close a split
  onCloseSplit: (sessionID: string) => void
  // Display options passed to all panels
  conceal: Accessor<boolean>
  showThinking: Accessor<boolean>
  showTimestamps: Accessor<boolean>
  usernameVisible: Accessor<boolean>
  showDetails: Accessor<boolean>
  showScrollbar: Accessor<boolean>
  diffWrapMode: Accessor<"word" | "none">
  // Prompt ref for main session
  mainPromptRef?: (ref: PromptRef) => void
  onSubmit?: () => void
}

export function SplitView(props: SplitViewProps) {
  const splitArray = createMemo(() => Array.from(props.splitSessionIDs()))
  const hasSplits = createMemo(() => splitArray().length > 0)
  
  return (
    <box flexDirection="row" flexGrow={1}>
      {/* Main session panel */}
      <SessionPanel
        sessionID={props.mainSessionID}
        isFocused={props.focusedSessionID() === props.mainSessionID}
        onFocus={() => props.onFocusSession(props.mainSessionID)}
        compact={hasSplits()}  // Use compact mode when splits are open
        conceal={props.conceal}
        showThinking={props.showThinking}
        showTimestamps={props.showTimestamps}
        usernameVisible={props.usernameVisible}
        showDetails={props.showDetails}
        showScrollbar={props.showScrollbar}
        diffWrapMode={props.diffWrapMode}
        promptRef={props.mainPromptRef}
        onSubmit={props.onSubmit}
      />
      
      {/* Split panels */}
      <For each={splitArray()}>
        {(sessionID) => (
          <SessionPanel
            sessionID={sessionID}
            isFocused={props.focusedSessionID() === sessionID}
            onFocus={() => props.onFocusSession(sessionID)}
            compact={true}
            conceal={props.conceal}
            showThinking={props.showThinking}
            showTimestamps={props.showTimestamps}
            usernameVisible={props.usernameVisible}
            showDetails={props.showDetails}
            showScrollbar={props.showScrollbar}
            diffWrapMode={props.diffWrapMode}
          />
        )}
      </For>
    </box>
  )
}
