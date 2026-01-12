# Qalarc/OpenCode Build Instructions

## Quick Build & Install (One-liner)

```bash
cd ~/Projects/opencode-custom/packages/opencode && ~/.bun/bin/bun ./script/build.ts && ~/projects/qalarc_OS/packages/qalarc/install.sh
```

> ⚠️ **Close all running `oc` or `qalarc` instances first!**

---

## Step-by-Step

### 1. Type Check (Optional but recommended)
```bash
cd ~/Projects/opencode-custom/packages/opencode
~/.bun/bin/bun run tsc --noEmit
```

### 2. Build
```bash
cd ~/Projects/opencode-custom/packages/opencode
~/.bun/bin/bun ./script/build.ts
```

### 3. Install
```bash
~/projects/qalarc_OS/packages/qalarc/install.sh
```

Or manually:
```bash
cp ~/Projects/opencode-custom/packages/opencode/dist/opencode-linux-x64/bin/opencode ~/bin/qalarc
chmod +x ~/bin/qalarc
ln -sf ~/bin/qalarc ~/bin/oc
```

---

## File Locations

| Purpose | Location |
|---------|----------|
| Source code | `~/Projects/opencode-custom/packages/opencode/` |
| Agent definitions | `~/Projects/opencode-custom/packages/opencode/src/agent/agent.ts` |
| Built binary | `~/Projects/opencode-custom/packages/opencode/dist/opencode-linux-x64/bin/opencode` |
| **Installed binary** | `~/bin/qalarc` |
| **oc symlink** | `~/bin/oc -> qalarc` |
| Install script | `~/projects/qalarc_OS/packages/qalarc/install.sh` |
| Session data | `~/.local/share/opencode/` (preserved across rebuilds) |
| Config | `~/.config/opencode/opencode.json` |
| Custom agents (config) | `~/.config/opencode/agent/` |
| Project context | `~/projects/qalarc_OS/AGENT_CONTEXT.md` |

---

## Adding a New Built-in Agent

Edit `~/Projects/opencode-custom/packages/opencode/src/agent/agent.ts`

Add your agent to the `result` object (around line 103):

```typescript
"your-agent-name": {
  name: "your-agent-name",
  description: "What this agent does",
  tools: { ...defaultTools },
  options: {},
  color: "#hexcolor",  // optional
  prompt: [
    `Your system prompt here`,
    ``,
    `Multiple lines joined with newlines`,
  ].join("\n"),
  permission: {
    edit: "allow",  // or "ask" or "deny"
    bash: {
      "*": "allow",  // or specific patterns
    },
    webfetch: "allow",
    doom_loop: "allow",
    external_directory: "allow",
  },
  mode: "primary",  // "primary", "subagent", or "all"
  builtIn: true,
},
```

Then rebuild and install.

---

## Agent Modes

- **primary**: Selectable as main agent (shows in agent picker via Tab)
- **subagent**: Only usable via @mention or Task tool
- **all**: Available in both contexts

---

## Backup & Restore

### Create backup before risky changes:
```bash
cp ~/bin/qalarc ~/bin/qalarc.backup-$(date +%Y%m%d)
```

### Restore from backup:
```bash
cp ~/bin/qalarc.backup-YYYYMMDD ~/bin/qalarc
```

Current backup: `~/bin/opencode-custom.backup-20260108`

---

## Troubleshooting

### "Text file busy" error
Close all running `oc` or `qalarc` instances before installing.

### Agent not appearing after rebuild
1. Verify build: `stat ~/Projects/opencode-custom/packages/opencode/dist/opencode-linux-x64/bin/opencode`
2. Check agent list: `qalarc agent list`
3. Ensure install ran: `ls -la ~/bin/qalarc`

### Fish shell "Unknown command" after update
Clear cached function and reload:
```fish
functions -e oc
source ~/.config/fish/config.fish
```
Or just open a new terminal.

### Session data safe?
Yes - sessions are stored in `~/.local/share/opencode/` which is untouched by binary replacement.

---

*Last updated: 2026-01-08*
