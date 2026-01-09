// Claude Code Provider - Routes through the official Claude Code binary
// This allows qalcode to use Claude subscription authentication

import { spawn, type ChildProcess } from "child_process"
import { createInterface } from "readline"
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider"

interface ClaudeCodeMessage {
  role: "user" | "assistant" | "system"
  content: string
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

function formatMessagesForClaude(
  messages: LanguageModelV1CallOptions["prompt"]
): string {
  const parts: string[] = []

  for (const msg of messages) {
    if (msg.role === "system") {
      parts.push(`System: ${extractTextContent(msg.content)}`)
    } else if (msg.role === "user") {
      const userParts = msg.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
      parts.push(`User: ${userParts.join("\n")}`)
    } else if (msg.role === "assistant") {
      const assistantParts = msg.content
        .filter((c) => c.type === "text")
        .map((c) => c.text)
      parts.push(`Assistant: ${assistantParts.join("\n")}`)
    }
  }

  return parts.join("\n\n")
}

export class ClaudeCodeLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = "v1" as const
  readonly provider = "claude-code"
  readonly modelId: string
  readonly defaultObjectGenerationMode = undefined

  constructor(modelId: string = "claude-opus-4-5-20251101") {
    this.modelId = modelId
  }

  async doGenerate(
    options: LanguageModelV1CallOptions
  ): Promise<{
    text: string
    finishReason: "stop" | "length" | "content-filter" | "tool-calls" | "error" | "other"
    usage: { promptTokens: number; completionTokens: number }
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> }
  }> {
    const prompt = formatMessagesForClaude(options.prompt)

    return new Promise((resolve, reject) => {
      const claude = spawn("claude", ["--print", "--output-format", "text"], {
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
          resolve({
            text: output.trim(),
            finishReason: "stop",
            usage: {
              promptTokens: Math.ceil(prompt.length / 4),
              completionTokens: Math.ceil(output.length / 4),
            },
            rawCall: {
              rawPrompt: prompt,
              rawSettings: {},
            },
          })
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
    options: LanguageModelV1CallOptions
  ): Promise<{
    stream: ReadableStream<LanguageModelV1StreamPart>
    rawCall: { rawPrompt: unknown; rawSettings: Record<string, unknown> }
  }> {
    const prompt = formatMessagesForClaude(options.prompt)

    const claude = spawn(
      "claude",
      ["--print", "--output-format", "stream-json", "--verbose"],
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env, ANTHROPIC_API_KEY: undefined },
      }
    )

    claude.stdin.write(prompt)
    claude.stdin.end()

    const rl = createInterface({ input: claude.stdout })

    let totalText = ""

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      start(controller) {
        rl.on("line", (line: string) => {
          if (!line.trim()) return

          try {
            const event = JSON.parse(line)

            // Handle stream events from Claude Code
            if (event.type === "stream_event") {
              const innerEvent = event.event

              if (innerEvent.type === "content_block_delta") {
                const text = innerEvent.delta?.text
                if (text) {
                  totalText += text
                  controller.enqueue({
                    type: "text-delta",
                    textDelta: text,
                  })
                }
              } else if (innerEvent.type === "message_stop") {
                controller.enqueue({
                  type: "finish",
                  finishReason: "stop",
                  usage: {
                    promptTokens: Math.ceil(prompt.length / 4),
                    completionTokens: Math.ceil(totalText.length / 4),
                  },
                })
              }
            } else if (event.type === "assistant" && event.message?.content) {
              // Full message event - extract any new text
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  const newText = block.text.slice(totalText.length)
                  if (newText) {
                    totalText = block.text
                    controller.enqueue({
                      type: "text-delta",
                      textDelta: newText,
                    })
                  }
                }
              }
            } else if (event.type === "result") {
              // Final result
              controller.enqueue({
                type: "finish",
                finishReason: "stop",
                usage: {
                  promptTokens: event.usage?.input_tokens || 0,
                  completionTokens: event.usage?.output_tokens || 0,
                },
              })
              controller.close()
            }
          } catch (e) {
            // Not JSON, ignore
          }
        })

        claude.on("close", (code: number) => {
          if (code !== 0) {
            controller.error(new Error(`Claude Code exited with code ${code}`))
          } else {
            controller.close()
          }
        })

        claude.on("error", (err: Error) => {
          controller.error(err)
        })
      },
    })

    return {
      stream,
      rawCall: {
        rawPrompt: prompt,
        rawSettings: {},
      },
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
