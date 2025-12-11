/**
 * Tasks Panel Dialog - View and manage todo items across sessions
 */
import { createMemo, createSignal, For, Show } from "solid-js"
import { TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useDialog } from "@tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@tui/ui/dialog-select"
import { useRoute } from "@tui/context/route"
import { Locale } from "@/util/locale"

interface TaskItem {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed"
  activeForm?: string
  sessionID: string
  sessionTitle: string
  messageID: string
  createdAt: number
}

export function DialogTasks() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const route = useRoute()
  const [filter, setFilter] = createSignal<"all" | "pending" | "in_progress" | "completed">("all")

  // Extract all tasks from TodoWrite tool calls across sessions
  const allTasks = createMemo(() => {
    const tasks: TaskItem[] = []

    for (const session of sync.data.session) {
      const messages = sync.data.message[session.id] ?? []

      for (const message of messages) {
        const parts = sync.data.part[message.id] ?? []

        for (const part of parts) {
          if (part.type === "tool" && part.tool === "todowrite") {
            const state = part.state
            if (state.status === "completed" || state.status === "pending") {
              const input = state.input as { todos?: Array<{ content: string; status: string; activeForm?: string }> }
              const todos = input?.todos ?? []

              for (const todo of todos) {
                tasks.push({
                  id: `${message.id}-${todo.content.slice(0, 20)}`,
                  content: todo.content,
                  status: todo.status as TaskItem["status"],
                  activeForm: todo.activeForm,
                  sessionID: session.id,
                  sessionTitle: session.title || "Untitled",
                  messageID: message.id,
                  createdAt: message.time.created,
                })
              }
            }
          }
        }
      }
    }

    // Sort by creation time, most recent first
    return tasks.sort((a, b) => b.createdAt - a.createdAt)
  })

  // Filter tasks based on current filter
  const filteredTasks = createMemo(() => {
    const f = filter()
    if (f === "all") return allTasks()
    return allTasks().filter((t) => t.status === f)
  })

  // Stats
  const stats = createMemo(() => {
    const all = allTasks()
    return {
      total: all.length,
      pending: all.filter((t) => t.status === "pending").length,
      inProgress: all.filter((t) => t.status === "in_progress").length,
      completed: all.filter((t) => t.status === "completed").length,
    }
  })

  const statusIcon = (status: TaskItem["status"]) => {
    switch (status) {
      case "completed":
        return "✓"
      case "in_progress":
        return "◐"
      default:
        return "○"
    }
  }

  const options = createMemo((): DialogSelectOption<string>[] =>
    filteredTasks().map((task) => ({
      title: `${statusIcon(task.status)} ${task.status === "in_progress" ? task.activeForm || task.content : task.content}`.slice(0, 50),
      value: task.id,
      description: `${task.sessionTitle.slice(0, 20)} | ${Locale.todayTimeOrDateTime(task.createdAt)}`,
      category: task.status === "in_progress" ? "In Progress" : task.status === "completed" ? "Completed" : "Pending",
    })),
  )

  const title = createMemo(() => {
    const s = stats()
    return `Tasks (${s.pending} pending, ${s.inProgress} active, ${s.completed} done)`
  })

  return (
    <DialogSelect
      title={title()}
      placeholder="Search tasks..."
      options={options()}
      onSelect={(option) => {
        const task = filteredTasks().find((t) => t.id === option.value)
        if (task) {
          route.navigate({
            type: "session",
            sessionID: task.sessionID,
          })
        }
        dialog.clear()
      }}
    />
  )
}
