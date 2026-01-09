// Claude Code Provider v2 - Routes through the official Claude Code binary
// This allows qalcode to use Claude subscription authentication
// Implements LanguageModelV2 for AI SDK 5 compatibility with REAL STREAMING

import { spawn } from "child_process"
import { createInterface } from "readline"
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2Content,
} from "@ai-sdk/provider"

interface ClaudeStreamEvent {
  type: string
  event?: {
    type: string
    index?: number
    delta?: {
      type?: string
      text?: string
    }
    usage?: {
      input_tokens?: number
      output_tokens?: number
    }
  }
  usage?: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  result?: string
}

interface ClaudeResult {
  type: string
  subtype: string
  result: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

function extractTextContent(content: any): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n")
  }
  return ""
}

function formatMessagesForClaude(prompt: any[]): string {
  const parts: string[] = []

  for (const msg of prompt) {
    if (msg.role === "system") {
      parts.push(`System: ${extractTextContent(msg.content)}`)
    } else if (msg.role === "user") {
      const userParts = Array.isArray(msg.content)
        ? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text)
        : [msg.content]
      parts.push(`User: ${userParts.join("\n")}`)
    } else if (msg.role === "assistant") {
      const assistantParts = Array.isArray(msg.content)
        ? msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text)
        : [msg.content]
      parts.push(`Assistant: ${assistantParts.join("\n")}`)
    }
  }

  return parts.join("\n\n")
}

export class ClaudeCodeLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2"
  readonly provider = "claude-code"
  readonly modelId: string

  readonly supportedUrls: Record<string, RegExp[]> = {}

  constructor(modelId: string = "claude-opus-4-5-20251101") {
    this.modelId = modelId
  }

  async doGenerate(
    options: Parameters<LanguageModelV2["doGenerate"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doGenerate"]>>> {
    const prompt = formatMessagesForClaude(options.prompt)

    return new Promise((resolve, reject) => {
      const claude = spawn("claude", [
        "--print",
        "--output-format", "json",
        "--model", this.modelId
      ], {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      })

      let output = ""
      let error = ""

      claude.stdout.on("data", (data: Buffer) => {
        output += data.toString()
      })

      claude.stderr.on("data", (data: Buffer) => {
        error += data.toString()
      })

      claude.on("close", (code: number) => {
        if (code === 0) {
          try {
            const result: ClaudeResult = JSON.parse(output)
            const content: LanguageModelV2Content[] = [
              { type: "text", text: result.result }
            ]

            resolve({
              content,
              finishReason: "stop",
              usage: {
                inputTokens: result.usage?.input_tokens || 0,
                outputTokens: result.usage?.output_tokens || 0,
                totalTokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
              },
              response: { id: `claude-${Date.now()}` },
              rawCall: { rawPrompt: prompt, rawSettings: { model: this.modelId } },
              warnings: [],
            })
          } catch (e) {
            resolve({
              content: [{ type: "text", text: output.trim() }],
              finishReason: "stop",
              usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
              response: { id: `claude-${Date.now()}` },
              rawCall: { rawPrompt: prompt, rawSettings: {} },
              warnings: [],
            })
          }
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${error}`))
        }
      })

      claude.on("error", reject)
      claude.stdin.write(prompt)
      claude.stdin.end()
    })
  }

  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    const prompt = formatMessagesForClaude(options.prompt)

    // Spawn Claude with REAL streaming flags
    const claude = spawn("claude", [
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--include-partial-messages",
      "--model", this.modelId
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
    })

    claude.stdin.write(prompt)
    claude.stdin.end()

    const rl = createInterface({ input: claude.stdout })

    let textStarted = false
    let inputTokens = 0
    let outputTokens = 0

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        rl.on("line", (line: string) => {
          if (!line.trim()) return

          try {
            const event: ClaudeStreamEvent = JSON.parse(line)

            // Handle stream events
            if (event.type === "stream_event" && event.event) {
              const innerEvent = event.event

              // content_block_start - emit text-start
              if (innerEvent.type === "content_block_start" && !textStarted) {
                textStarted = true
                controller.enqueue({
                  type: "text-start",
                  id: `text-${innerEvent.index || 0}`,
                })
              }

              // content_block_delta - emit text-delta with actual text
              if (innerEvent.type === "content_block_delta") {
                const text = innerEvent.delta?.text
                if (text) {
                  controller.enqueue({
                    type: "text-delta",
                    id: `text-${innerEvent.index || 0}`,
                    delta: text,
                  })
                }
              }

              // content_block_stop - emit text-end
              if (innerEvent.type === "content_block_stop") {
                controller.enqueue({
                  type: "text-end",
                  id: `text-${innerEvent.index || 0}`,
                })
              }

              // message_delta - capture usage
              if (innerEvent.type === "message_delta" && innerEvent.usage) {
                inputTokens = innerEvent.usage.input_tokens || inputTokens
                outputTokens = innerEvent.usage.output_tokens || outputTokens
              }

              // message_stop - emit finish
              if (innerEvent.type === "message_stop") {
                controller.enqueue({
                  type: "finish",
                  finishReason: "stop",
                  usage: {
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                  },
                })
              }
            }

            // Final result event - also emit finish if not already done
            if (event.type === "result" && event.usage) {
              inputTokens = event.usage.input_tokens || inputTokens
              outputTokens = event.usage.output_tokens || outputTokens
            }
          } catch (e) {
            // Not JSON, ignore
          }
        })

        rl.on("close", () => {
          // Ensure stream is closed
          try {
            controller.close()
          } catch (e) {
            // Already closed
          }
        })

        claude.on("error", (err: Error) => {
          controller.error(err)
        })

        claude.on("close", (code: number) => {
          if (code !== 0) {
            controller.error(new Error(`Claude Code exited with code ${code}`))
          }
        })
      },
    })

    return {
      stream,
      response: { id: `claude-stream-${Date.now()}` },
      rawCall: { rawPrompt: prompt, rawSettings: { model: this.modelId } },
      warnings: [],
    }
  }
}

// Provider factory
export function createClaudeCodeProvider() {
  const createModel = (modelId: string = "claude-opus-4-5-20251101") => {
    return new ClaudeCodeLanguageModel(modelId)
  }

  const provider = function (modelId?: string) {
    return createModel(modelId)
  }

  provider.languageModel = createModel
  provider.chat = createModel

  return provider
}

export const claudeCode = createClaudeCodeProvider()
