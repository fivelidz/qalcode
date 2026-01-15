# QalCode - CachyOS Setup Guide

Custom OpenCode fork with qalarc branding, optimized for CachyOS.

## Requirements

- **OS**: CachyOS (Arch-based) or any Linux distribution
- **Bun**: v1.3.5 or later (baseline build, no AVX required)
- **Node.js**: v18+ (optional, Bun is preferred)
- **Claude Code Max subscription**: Required for Anthropic OAuth authentication

## Why QalCode over OpenCode?

OpenCode 1.1.21+ bundles a Bun binary that requires **AVX CPU instructions**. CPUs without AVX (like Intel Celeron J4125) will crash with "Illegal instruction".

QalCode runs from source using your **system Bun** (baseline build), which works on all x86_64 CPUs regardless of AVX support.

## Installation

### 1. Clone the repository

```bash
git clone git@github.com:fivelidz/qalcode.git ~/qalcode
cd ~/qalcode
git checkout cachyos-working
```

### 2. Install dependencies

```bash
bun install
```

### 3. Create wrapper script

Create `~/.local/bin/qalcode`:

```bash
#!/usr/bin/env bash
# QalCode - Custom OpenCode fork with qalarc branding
# User-Agent hardcoded to opencode/latest/1.1.15 for Anthropic OAuth compatibility

# Handle special commands
case "$1" in
  --clean-auth|clean-auth)
    echo "Cleaning qalcode/opencode credentials..."
    if [ -f ~/.local/share/opencode/auth.json ]; then
      rm -f ~/.local/share/opencode/auth.json
      echo "Removed ~/.local/share/opencode/auth.json"
    else
      echo "No credentials file found at ~/.local/share/opencode/auth.json"
    fi
    echo "Done. Run 'qalcode' to re-authenticate."
    exit 0
    ;;
  --help|-h)
    echo "QalCode - Custom OpenCode fork"
    echo ""
    echo "Usage: qalcode [options] [command]"
    echo ""
    echo "Special commands:"
    echo "  --clean-auth    Remove cached Anthropic OAuth credentials"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "All other arguments are passed to opencode."
    echo ""
    cd ~/qalcode
    exec bun run --cwd packages/opencode --conditions=browser src/index.ts --help
    ;;
  *)
    cd ~/qalcode
    exec bun run --cwd packages/opencode --conditions=browser src/index.ts "$@"
    ;;
esac
```

Make it executable and create symlink:

```bash
chmod +x ~/.local/bin/qalcode
ln -sf ~/.local/bin/qalcode ~/.local/bin/qc
```

### 4. Ensure PATH includes ~/.local/bin

Add to your shell rc file (`~/.bashrc`, `~/.zshrc`, or `~/.config/fish/config.fish`):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Usage

```bash
qalcode              # Launch TUI
qc                   # Shortcut alias
qalcode run "msg"    # Run with a message (non-interactive)
qalcode --clean-auth # Clear OAuth credentials
qalcode --version    # Shows version (1.1.15)
qalcode auth list    # List configured providers
```

## Changes from Upstream OpenCode

### 1. Anthropic OAuth Compatibility (`packages/opencode/src/installation/index.ts`)

Hardcoded version and channel to match official OpenCode for OAuth validation:

```typescript
// Hardcoded to match official opencode for Anthropic OAuth compatibility
export const VERSION = typeof OPENCODE_VERSION === "string"
  ? OPENCODE_VERSION
  : (process.env.OPENCODE_VERSION || "1.1.21")
export const CHANNEL = typeof OPENCODE_CHANNEL === "string"
  ? OPENCODE_CHANNEL
  : (process.env.OPENCODE_CHANNEL || "latest")
```

**Why**: Anthropic's OAuth servers validate the User-Agent string. Only `opencode/latest/X.Y.Z` patterns are recognized. Running from source without this fix sends `opencode/local/local` which gets rejected.

### 2. Updated Auth Plugin Versions (`packages/opencode/src/plugin/index.ts`)

```typescript
plugins.push("opencode-copilot-auth@0.0.12")  // was 0.0.9
plugins.push("opencode-anthropic-auth@0.0.8")  // was 0.0.5
```

**Why**: Older plugin versions don't work with current Anthropic OAuth flow.

### 3. Models Fetch Fallback (`packages/opencode/src/provider/models.ts`)

Added fallback when Bun macro isn't available (running from source):

```typescript
export async function get() {
  refresh()
  const file = Bun.file(filepath)
  const result = await file.json().catch(() => {})
  if (result) return result as Record<string, Provider>
  // Fallback: fetch directly if macro data not available
  try {
    const json = await data()
    return JSON.parse(json) as Record<string, Provider>
  } catch {
    // Fetch directly when running from source
    const response = await fetch("https://models.dev/api.json", {
      headers: { "User-Agent": Installation.USER_AGENT },
      signal: AbortSignal.timeout(10 * 1000),
    })
    if (response.ok) {
      const json = await response.text()
      await Bun.write(file, json)
      return JSON.parse(json) as Record<string, Provider>
    }
    return {} as Record<string, Provider>
  }
}
```

**Why**: Bun macros execute at build time. When running from source, the macro might fail, causing `ReferenceError: data is not defined`.

### 4. Bun Version Update (`package.json`)

```json
"packageManager": "bun@1.3.5"
```

**Why**: CachyOS ships with Bun 1.3.5; the original required 1.3.3.

## File Locations

| File | Purpose |
|------|---------|
| `~/.local/share/opencode/auth.json` | OAuth credentials (Anthropic, etc.) |
| `~/.config/opencode/opencode.json` | User configuration |
| `~/.local/share/opencode/log/` | Log files |
| `~/.cache/opencode/` | Cached plugins and models |

## Anthropic OAuth Requirements (Critical)

Anthropic's OAuth validates **multiple factors**:

1. **User-Agent**: Must match `opencode/latest/X.Y.Z` (e.g., `opencode/latest/1.1.21`)
2. **Beta Headers**: Must include `claude-code-20250219` in `anthropic-beta` header
3. **System Prompt**: Must contain exact string "You are Claude Code, Anthropic's official CLI for Claude."

**DO NOT MODIFY** the file `packages/opencode/src/session/prompt/anthropic_spoof.txt` - it contains the required identity string that Anthropic validates.

### Customization Limitations

You can customize:
- Agent descriptions and permissions
- Other prompt files (`anthropic.txt`, etc.)
- Configuration options
- TUI appearance

You **cannot** customize:
- The "Claude Code" identity in `anthropic_spoof.txt`
- The User-Agent format
- The beta header flags

## Troubleshooting

### "This credential is only authorized for use with Claude Code"

This error means OAuth validation failed. Check these in order:

1. **Version**: `qalcode --version` should show `1.1.21` (or current opencode version)
2. **Prompt file**: Ensure `anthropic_spoof.txt` starts with "You are Claude Code, Anthropic's official CLI for Claude."
3. **Plugin versions**: Check `opencode-anthropic-auth@0.0.9` in `plugin/index.ts`
4. **Clear cache**: `rm -rf ~/.cache/opencode/node_modules && qalcode --clean-auth`

### "ReferenceError: data is not defined"

The models macro failed. Ensure the `models.ts` fallback is in place.

### Auth not persisting

Check file permissions:
```bash
ls -la ~/.local/share/opencode/auth.json
# Should be -rw------- (600)
```

## Updating

```bash
cd ~/qalcode
git pull origin cachyos-working
bun install
```

## Branch Information

- **Branch**: `cachyos-working`
- **Base commit**: `b97b9d1` (last working state before NixOS changes)
- **Latest commit**: Contains OAuth compatibility fixes

---

*Last updated: 2026-01-15*
*Maintained by: qalarc*
