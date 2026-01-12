// Claude Code Proxy Provider
// Routes API requests through the Claude Code binary to use subscription auth

import { spawn } from "child_process"

export interface ClaudeCodeProxyOptions {
  model?: string
  systemPrompt?: string
}

export async function callClaudeCode(
  messages: Array<{ role: string; content: string }>,
  options: ClaudeCodeProxyOptions = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Format messages for Claude Code
    const prompt = messages
      .filter(m => m.role === "user")
      .map(m => m.content)
      .join("\n")

    const claude = spawn("claude", ["--print", "--output-format", "text"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ANTHROPIC_API_KEY: undefined }
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
        resolve(output.trim())
      } else {
        reject(new Error(`Claude Code exited with code ${code}: ${error}`))
      }
    })

    claude.on("error", (err: Error) => {
      reject(err)
    })

    claude.stdin.write(prompt)
    claude.stdin.end()
  })
}

export const ClaudeCodeProxy = {
  id: "claude-code-proxy",
  name: "Claude Code (Subscription)",

  async chat(messages: Array<{ role: string; content: string }>, options?: ClaudeCodeProxyOptions) {
    return callClaudeCode(messages, options)
  }
}