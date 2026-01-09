// Claude Code Provider v2 - Routes through the official Claude Code binary
// This allows qalcode to use Claude subscription authentication
// Implements LanguageModelV2 for AI SDK 5 compatibility

import { spawn } from "child_process"
import type {
  LanguageModelV2,
  LanguageModelV2StreamPart,
  LanguageModelV2Content,
} from "@ai-sdk/provider"

interface ClaudeResult {
  type: string
  subtype: string
  result: string
  usage: {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
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

async function callClaudeCode(prompt: string, model: string): Promise<ClaudeResult> {
  return new Promise((resolve, reject) => {
    const claude = spawn("claude", ["--print", "--output-format", "json", "--model", model], {
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
          const result = JSON.parse(output)
          resolve(result)
        } catch (e) {
          // Fallback if not JSON
          resolve({
            type: "result",
            subtype: "success",
            result: output.trim(),
            usage: { input_tokens: 0, output_tokens: 0 }
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
    const result = await callClaudeCode(prompt, this.modelId)

    const content: LanguageModelV2Content[] = [
      {
        type: "text",
        text: result.result,
      }
    ]

    return {
      content,
      finishReason: "stop",
      usage: {
        inputTokens: result.usage?.input_tokens || 0,
        outputTokens: result.usage?.output_tokens || 0,
        totalTokens: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
      },
      response: {
        id: `claude-${Date.now()}`,
      },
      rawCall: {
        rawPrompt: prompt,
        rawSettings: { model: this.modelId },
      },
      warnings: [],
    }
  }

  async doStream(
    options: Parameters<LanguageModelV2["doStream"]>[0]
  ): Promise<Awaited<ReturnType<LanguageModelV2["doStream"]>>> {
    // For simplicity, call doGenerate and emit result as stream
    const result = await this.doGenerate(options)
    const textContent = result.content.find(c => c.type === "text")
    const text = textContent && "text" in textContent ? textContent.text : ""

    const stream = new ReadableStream<LanguageModelV2StreamPart>({
      start(controller) {
        // Emit text-start
        controller.enqueue({
          type: "text-start",
          id: "text-0",
        })

        // Emit text-delta with the full content
        controller.enqueue({
          type: "text-delta",
          id: "text-0",
          delta: text,
        })

        // Emit text-end
        controller.enqueue({
          type: "text-end",
          id: "text-0",
        })

        // Emit finish
        controller.enqueue({
          type: "finish",
          finishReason: "stop",
          usage: result.usage,
        })

        controller.close()
      },
    })

    return {
      stream,
      response: result.response,
      rawCall: result.rawCall,
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
