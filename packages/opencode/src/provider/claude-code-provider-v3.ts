// Claude Code Provider v3 - Full bidirectional streaming integration
// Uses --input-format stream-json --output-format stream-json for rich data
// Exposes tools, agents, usage, and full Claude Code functionality

import { spawn, ChildProcessWithoutNullStreams } from "child_process"
import { createInterface } from "readline"
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2Content,
} from "@ai-sdk/provider"

// Types for Claude Code's stream-json output
interface ClaudeSystemInit {
  type: "system"
  subtype: "init"
  cwd: string
  session_id: string
  tools: string[]
  model: string
  permissionMode: string
  agents: string[]
  claude_code_version: string
}

interface ClaudeAssistantMessage {
  type: "assistant"
  message: {
    model: string
    id: string
    role: "assistant"
    content: Array<{
      type: "text" | "tool_use"
      text?: string
      id?: string
      name?: string
      input?: any
    }>
    usage: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  session_id: string
}

interface ClaudeToolResult {
  type: "tool_result"
  tool_use_id: string
  content: string
}

interface ClaudeResult {
  type: "result"
  subtype: "success" | "error"
  result: string
  session_id: string
  total_cost_usd: number
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
  }
}

type ClaudeStreamEvent = ClaudeSystemInit | ClaudeAssistantMessage | ClaudeToolResult | ClaudeResult | { type: string; [key: string]: any }

export class ClaudeCodeLanguageModelV3 implements LanguageModelV2 {
  readonly specificationVersion = "v2"
  readonly provider = "claude-code"
  readonly modelId: string
  private permissionMode: string
  private sessionId: string | null = null
  private claudeProcess: ChildProcessWithoutNullStreams | null = null

  readonly supportedUrls: Record<string, RegExp[]> = {}

  constructor(modelId: string = "claude-opus-4-5-20251101", permissionMode: string = "default") {
    this.modelId = modelId
    this.permissionMode = permissionMode
  }

  async doGenerate(
    options: Parameters<LanguageModelV2["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    // Extract user message
    const lastUserMsg = options.prompt.filter(m => m.role === "user").pop()
    const userContent = this.extractContent(lastUserMsg?.content)

    return new Promise((resolve, reject) => {
      const claude = spawn("claude", [
        "--print",
        "--verbose",
        "--input-format", "stream-json",
        "--output-format", "stream-json",
        "--model", this.modelId,
        "--permission-mode", this.permissionMode
      ], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      })

      let fullResult = ""
      let usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
      let sessionId = ""

      const rl = createInterface({ input: claude.stdout })

      rl.on("line", (line: string) => {
        if (!line.trim()) return
        try {
          const event: ClaudeStreamEvent = JSON.parse(line)

          if (event.type === "system" && event.subtype === "init") {
            sessionId = (event as ClaudeSystemInit).session_id
          }

          if (event.type === "assistant") {
            const msg = event as ClaudeAssistantMessage
            for (const block of msg.message.content) {
              if (block.type === "text" && block.text) {
                fullResult += block.text
              }
            }
          }

          if (event.type === "result") {
            const result = event as ClaudeResult
            usage = {
              inputTokens: result.usage.input_tokens,
              outputTokens: result.usage.output_tokens,
              totalTokens: result.usage.input_tokens + result.usage.output_tokens
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      })

      rl.on("close", () => {
        const content: LanguageModelV2Content[] = [{ type: "text", text: fullResult }]
        resolve({
          content,
          finishReason: "stop",
          usage,
          response: { id: sessionId || `claude-${Date.now()}` },
          rawCall: { rawPrompt: userContent, rawSettings: { model: this.modelId } },
          warnings: [],
        })
      })

      claude.on("error", reject)

      // Send user message in stream-json format
      const inputMsg = JSON.stringify({
        type: "user",
        message: { role: "user", content: userContent }
      })
      claude.stdin.write(inputMsg + "\n")
      claude.stdin.end()
    })
  }

  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const lastUserMsg = options.prompt.filter(m => m.role === "user").pop()
    const userContent = this.extractContent(lastUserMsg?.content)

    const claude = spawn("claude", [
      "--print",
      "--verbose",
      "--input-format", "stream-json",
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--model", this.modelId,
      "--permission-mode", this.permissionMode
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
    })

    const rl = createInterface({ input: claude.stdout })

    let sessionId = ""
    let inputTokens = 0
    let outputTokens = 0
    let textBlockIndex = 0
    let currentToolUseId: string | null = null

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        rl.on("line", (line: string) => {
          if (!line.trim()) return

          try {
            const event: ClaudeStreamEvent = JSON.parse(line)

            // System init - could emit metadata
            if (event.type === "system" && event.subtype === "init") {
              const init = event as ClaudeSystemInit
              sessionId = init.session_id
              // Could emit custom event with tools/agents info
            }

            // Assistant message with content
            if (event.type === "assistant") {
              const msg = event as ClaudeAssistantMessage

              for (const block of msg.message.content) {
                if (block.type === "text" && block.text) {
                  // Emit text-start if first text
                  controller.enqueue({
                    type: "text-start",
                    id: `text-${textBlockIndex}`,
                  })

                  // Emit the text content
                  controller.enqueue({
                    type: "text-delta",
                    id: `text-${textBlockIndex}`,
                    delta: block.text,
                  })

                  controller.enqueue({
                    type: "text-end",
                    id: `text-${textBlockIndex}`,
                  })

                  textBlockIndex++
                }

                // Handle tool use
                if (block.type === "tool_use" && block.name && block.id) {
                  currentToolUseId = block.id
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: block.id,
                    toolName: block.name,
                    args: JSON.stringify(block.input || {}),
                  } as any)
                }
              }

              // Update usage from message
              if (msg.message.usage) {
                inputTokens = msg.message.usage.input_tokens
                outputTokens = msg.message.usage.output_tokens
              }
            }

            // Tool result
            if (event.type === "tool_result") {
              const toolResult = event as ClaudeToolResult
              controller.enqueue({
                type: "tool-result",
                toolCallType: "function",
                toolCallId: toolResult.tool_use_id,
                result: toolResult.content,
              } as any)
            }

            // Final result
            if (event.type === "result") {
              const result = event as ClaudeResult
              inputTokens = result.usage.input_tokens
              outputTokens = result.usage.output_tokens

              controller.enqueue({
                type: "finish",
                finishReason: result.subtype === "success" ? "stop" : "error",
                usage: {
                  inputTokens,
                  outputTokens,
                  totalTokens: inputTokens + outputTokens,
                },
              })
            }
          } catch (e) {
            // Ignore parse errors
          }
        })

        rl.on("close", () => {
          try {
            controller.close()
          } catch (e) {
            // Already closed
          }
        })

        claude.on("error", (err: Error) => {
          controller.error(err)
        })
      },
    })

    // Send user message
    const inputMsg = JSON.stringify({
      type: "user",
      message: { role: "user", content: userContent }
    })
    claude.stdin.write(inputMsg + "\n")
    claude.stdin.end()

    return {
      stream,
      response: { id: sessionId || `claude-stream-${Date.now()}` },
      rawCall: { rawPrompt: userContent, rawSettings: { model: this.modelId } },
      warnings: [],
    }
  }

  private extractContent(content: any): string {
    if (typeof content === "string") return content
    if (Array.isArray(content)) {
      return content
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.text)
        .join("\n")
    }
    return ""
  }
}

export function createClaudeCodeProviderV3(options?: { permissionMode?: string }) {
  const defaultPermissionMode = options?.permissionMode || "default"

  const createModel = (modelId: string = "claude-opus-4-5-20251101", permissionMode?: string) => {
    return new ClaudeCodeLanguageModelV3(modelId, permissionMode || defaultPermissionMode)
  }

  const provider = function (modelId?: string) {
    return createModel(modelId)
  }

  provider.languageModel = createModel
  provider.chat = createModel

  return provider
}

export const claudeCodeV3 = createClaudeCodeProviderV3()
