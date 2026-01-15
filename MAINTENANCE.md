# QalCode Maintenance Guide

This document explains how to keep QalCode working with Anthropic's Claude Code OAuth system.

## How Authentication Works

QalCode uses **Anthropic's Claude Code OAuth** system. This is NOT a standard API key - it's a special OAuth flow that Anthropic uses for Claude Code subscriptions (Max, Pro, etc.).

### OAuth Validation Chain

Anthropic validates **ALL** of these before allowing API access:

```
┌─────────────────────────────────────────────────────────────┐
│                    OAUTH VALIDATION                         │
├─────────────────────────────────────────────────────────────┤
│ 1. User-Agent Header                                        │
│    Must match: opencode/latest/X.Y.Z                        │
│    File: packages/opencode/src/installation/index.ts        │
├─────────────────────────────────────────────────────────────┤
│ 2. anthropic-beta Header                                    │
│    Must include: claude-code-20250219                       │
│    File: packages/opencode/src/provider/provider.ts         │
├─────────────────────────────────────────────────────────────┤
│ 3. System Prompt Identity                                   │
│    Must start with EXACT string:                            │
│    "You are Claude Code, Anthropic's official CLI..."       │
│    File: packages/opencode/src/session/prompt/              │
│          anthropic_spoof.txt                                │
├─────────────────────────────────────────────────────────────┤
│ 4. Auth Plugin                                              │
│    Handles OAuth token refresh and injection                │
│    Package: opencode-anthropic-auth                         │
│    File: packages/opencode/src/plugin/index.ts              │
└─────────────────────────────────────────────────────────────┘
```

If ANY of these fail, you get:
```
Error: This credential is only authorized for use with Claude Code
```

## Critical Files - DO NOT MODIFY

### 1. `packages/opencode/src/session/prompt/anthropic_spoof.txt`

**NEVER CHANGE THIS FILE**

This file MUST contain exactly:
```
You are Claude Code, Anthropic's official CLI for Claude.
```

Anthropic's servers check for this exact string. Any modification breaks OAuth.

### 2. `packages/opencode/src/provider/provider.ts` (anthropic section)

The `anthropic-beta` header must include `claude-code-20250219`:
```typescript
async anthropic() {
  return {
    autoload: false,
    options: {
      headers: {
        "anthropic-beta":
          "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      },
    },
  }
},
```

## Files That Need Regular Updates

### 1. Version Number (`packages/opencode/src/installation/index.ts`)

**Update when OpenCode releases new version:**

```typescript
export const VERSION = typeof OPENCODE_VERSION === "string"
  ? OPENCODE_VERSION
  : (process.env.OPENCODE_VERSION || "1.1.21")  // ← UPDATE THIS
export const CHANNEL = typeof OPENCODE_CHANNEL === "string"
  ? OPENCODE_CHANNEL
  : (process.env.OPENCODE_CHANNEL || "latest")
```

**How to find current version:**
```bash
npm view opencode-ai version
```

### 2. Auth Plugin Version (`packages/opencode/src/plugin/index.ts`)

**Update when auth plugins are updated:**

```typescript
if (!Flag.OPENCODE_DISABLE_DEFAULT_PLUGINS) {
  plugins.push("opencode-copilot-auth@0.0.12")   // ← CHECK/UPDATE
  plugins.push("opencode-anthropic-auth@0.0.9")  // ← CHECK/UPDATE
}
```

**How to find current versions:**
```bash
npm view opencode-anthropic-auth version
npm view opencode-copilot-auth version
```

## Routine Maintenance Procedure

### When OpenCode Updates (check weekly)

```bash
# 1. Check current OpenCode version
npm view opencode-ai version

# 2. Check auth plugin versions
npm view opencode-anthropic-auth version
npm view opencode-copilot-auth version

# 3. If versions changed, update qalcode:
cd ~/qalcode

# Edit packages/opencode/src/installation/index.ts
# Update VERSION to match opencode-ai version

# Edit packages/opencode/src/plugin/index.ts
# Update plugin versions

# 4. Test
qalcode run "test"

# 5. If working, commit and push
git add -A
git commit -m "Update to match OpenCode X.Y.Z"
git push
```

### Monthly Full Test

```bash
# 1. Clear all caches
rm -rf ~/.cache/opencode/node_modules

# 2. Test authentication
qalcode auth list

# 3. Test API call
qalcode run "Say hello"

# 4. Check logs if issues
tail -100 ~/.local/share/opencode/log/*.log | grep -i error
```

## Troubleshooting Guide

### Error: "This credential is only authorized for use with Claude Code"

**Diagnosis Steps:**

```bash
# Step 1: Check version matches official opencode
qalcode --version
npm view opencode-ai version
# These should match!

# Step 2: Check anthropic_spoof.txt hasn't been modified
cat ~/qalcode/packages/opencode/src/session/prompt/anthropic_spoof.txt
# Must be exactly: "You are Claude Code, Anthropic's official CLI for Claude."

# Step 3: Check plugin versions
grep "anthropic-auth" ~/qalcode/packages/opencode/src/plugin/index.ts
npm view opencode-anthropic-auth version
# These should match!

# Step 4: Clear cache and retry
rm -rf ~/.cache/opencode/node_modules
qalcode run "test"
```

**Common Fixes:**

| Symptom | Fix |
|---------|-----|
| Version mismatch | Update VERSION in installation/index.ts |
| Plugin outdated | Update plugin version in plugin/index.ts |
| Prompt modified | Restore anthropic_spoof.txt to original |
| Corrupted cache | `rm -rf ~/.cache/opencode/node_modules` |
| Token expired | `qalcode --clean-auth` then re-authenticate |

### Error: "CPU lacks AVX support" / "Illegal instruction"

This happens with official `opencode` binary, NOT qalcode.

**Why:** OpenCode bundles Bun binary that requires AVX. Your CPU (Intel Celeron J4125) doesn't have AVX.

**Solution:** Use `qalcode` instead of `opencode`. QalCode uses system Bun (baseline build).

### Error: "ReferenceError: data is not defined"

**Cause:** Bun macro not working when running from source.

**Fix:** Ensure `packages/opencode/src/provider/models.ts` has the fallback fetch code.

### Token Expired

```bash
# Check expiry
cat ~/.local/share/opencode/auth.json | python3 -c "
import json,sys,datetime
d=json.load(sys.stdin)
exp=datetime.datetime.fromtimestamp(d['anthropic']['expires']/1000)
print(f'Expires: {exp}')
print(f'Now: {datetime.datetime.now()}')
print(f'Valid: {exp > datetime.datetime.now()}')
"

# If expired, re-authenticate
qalcode --clean-auth
qalcode  # Will prompt for login
```

## Version History

| Date | OpenCode | anthropic-auth | Notes |
|------|----------|----------------|-------|
| 2026-01-15 | 1.1.21 | 0.0.9 | Current working |
| 2026-01-13 | 1.1.15 | 0.0.8 | Initial CachyOS setup |

## Files Reference

| File | Purpose | Can Modify? |
|------|---------|-------------|
| `installation/index.ts` | Version/User-Agent | Yes - update version |
| `plugin/index.ts` | Plugin versions | Yes - update versions |
| `provider/provider.ts` | API headers | NO - anthropic headers |
| `prompt/anthropic_spoof.txt` | OAuth identity | **NEVER** |
| `prompt/anthropic.txt` | Main prompt | Yes - carefully |
| `agent/agent.ts` | Agent definitions | Yes |
| `provider/models.ts` | Model fetching | Yes - keep fallback |

## Quick Commands

```bash
# Check everything is working
qalcode --version && qalcode run "test"

# View OAuth token status
cat ~/.local/share/opencode/auth.json | jq .

# Clear all caches
rm -rf ~/.cache/opencode/node_modules

# Re-authenticate
qalcode --clean-auth && qalcode

# Check logs
tail -f ~/.local/share/opencode/log/*.log

# Update qalcode
cd ~/qalcode && git pull && bun install
```

---

*Last updated: 2026-01-15*
