// Claude Code Provider - Routes through the official Claude Code binary
// This allows qalcode to use Claude subscription authentication

import { spawn } from "child_process"
import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider"

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
    // Simplest approach: call doGenerate and emit result as a single stream chunk
    // This avoids streaming complexity while maintaining API compatibility
    const prompt = formatMessagesForClaude(options.prompt)
    const result = await this.doGenerate(options)

    const stream = new ReadableStream<LanguageModelV1StreamPart>({
      start(controller) {
        // Emit text as single delta
        controller.enqueue({
          type: "text-delta",
          textDelta: result.text,
        })
        // Emit finish
        controller.enqueue({
          type: "finish",
          finishReason: result.finishReason,
          usage: result.usage,
        })
        controller.close()
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
