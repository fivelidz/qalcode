# QalCode Troubleshooting Guide

Quick reference for fixing common issues.

## Quick Diagnosis

Run this first:
```bash
# Quick health check
echo "=== Version Check ===" && \
qalcode --version && \
echo "" && \
echo "=== Auth Status ===" && \
qalcode auth list 2>&1 | head -10 && \
echo "" && \
echo "=== Quick Test ===" && \
timeout 30 qalcode run "Say OK" 2>&1
```

## Issue: OAuth Error

**Error Message:**
```
Error: This credential is only authorized for use with Claude Code
```

### Step-by-Step Fix

**Step 1: Check version alignment**
```bash
# Your version
qalcode --version

# Official version
npm view opencode-ai version

# If different, update ~/qalcode/packages/opencode/src/installation/index.ts
# Change the version number in the fallback
```

**Step 2: Check auth plugin**
```bash
# Your plugin version
grep "anthropic-auth" ~/qalcode/packages/opencode/src/plugin/index.ts

# Latest version
npm view opencode-anthropic-auth version

# If different, update plugin/index.ts
```

**Step 3: Verify critical prompt file**
```bash
cat ~/qalcode/packages/opencode/src/session/prompt/anthropic_spoof.txt
```

Must be EXACTLY:
```
You are Claude Code, Anthropic's official CLI for Claude.
```

**Step 4: Nuclear option - full reset**
```bash
# Clear everything
rm -rf ~/.cache/opencode/node_modules
rm -f ~/.local/share/opencode/auth.json

# Re-pull and reinstall
cd ~/qalcode
git checkout main
git pull
bun install

# Re-authenticate
qalcode
```

## Issue: AVX / Illegal Instruction

**Error Message:**
```
CPU lacks AVX support
panic: Illegal instruction
```

**Cause:** You're running `opencode` instead of `qalcode`.

**Fix:** Always use `qalcode` or `qc`:
```bash
# Wrong (crashes on non-AVX CPUs)
opencode

# Correct
qalcode
qc
```

## Issue: Model Says It's Wrong Model

**Symptom:** You ask "what model are you?" and it says Sonnet instead of Opus.

**Explanation:** This is normal! Claude models don't reliably know their own model ID. The model is determined by your config, not the model's self-identification.

**Verify actual model:**
```bash
# Check your config
cat ~/.config/opencode/opencode.json

# Should show your desired model:
# "model": "anthropic/claude-opus-4-5-20251101"
```

**Check logs to confirm:**
```bash
grep "modelID=" ~/.local/share/opencode/log/*.log | tail -5
```

## Issue: Token Expired

**Symptom:** Was working, now fails.

**Check:**
```bash
python3 << 'EOF'
import json, datetime
with open('/home/qalarc/.local/share/opencode/auth.json') as f:
    d = json.load(f)
exp = datetime.datetime.fromtimestamp(d['anthropic']['expires']/1000)
now = datetime.datetime.now()
print(f"Expires: {exp}")
print(f"Now:     {now}")
print(f"Status:  {'VALID' if exp > now else 'EXPIRED'}")
EOF
```

**Fix:**
```bash
qalcode --clean-auth
qalcode  # Will prompt for login
```

## Issue: Macro/Data Error

**Error Message:**
```
ReferenceError: data is not defined
```

**Cause:** Bun macro not working when running from source.

**Fix:** Ensure `models.ts` has fallback. Check:
```bash
grep -A 20 "export async function get" ~/qalcode/packages/opencode/src/provider/models.ts | head -25
```

Should contain a `try/catch` block with fetch fallback.

## Issue: Plugin Installation Failed

**Error Message:**
```
Failed to install opencode-anthropic-auth
```

**Fix:**
```bash
# Clear npm/bun cache
rm -rf ~/.cache/opencode/node_modules
rm -rf ~/.bun/install/cache

# Retry
qalcode
```

## Issue: TUI Won't Start

**Symptom:** Hangs or crashes on launch.

**Debug:**
```bash
# Run with debug logging
OPENCODE_LOG_LEVEL=DEBUG qalcode 2>&1 | tee /tmp/qalcode-debug.log
```

**Common fixes:**
```bash
# Reset terminal state
reset

# Check if port in use
lsof -i :4096

# Kill stuck process
pkill -f "bun.*opencode"
```

## Issue: After Git Pull, Nothing Works

**Fix:**
```bash
cd ~/qalcode

# Reset to known good state
git fetch origin
git reset --hard origin/main

# Reinstall dependencies
rm -rf node_modules
bun install

# Clear runtime caches
rm -rf ~/.cache/opencode/node_modules

# Test
qalcode --version
qalcode run "test"
```

## Log Locations

| Log | Location | Use |
|-----|----------|-----|
| Runtime | `~/.local/share/opencode/log/*.log` | API errors, auth issues |
| Debug | stderr with `OPENCODE_LOG_LEVEL=DEBUG` | Detailed tracing |

**View recent errors:**
```bash
grep -i "error\|fail" ~/.local/share/opencode/log/*.log | tail -20
```

## Emergency Recovery

If everything is broken:

```bash
#!/bin/bash
# emergency-recovery.sh

echo "=== Emergency Recovery ==="

# 1. Backup auth (in case still valid)
cp ~/.local/share/opencode/auth.json /tmp/auth-backup.json 2>/dev/null

# 2. Clean everything
rm -rf ~/.cache/opencode
rm -rf ~/.local/share/opencode/log/*
rm -rf ~/qalcode/node_modules

# 3. Fresh clone
cd ~
rm -rf qalcode
git clone https://github.com/fivelidz/qalcode.git
cd qalcode
git checkout main
bun install

# 4. Restore auth or re-authenticate
if [ -f /tmp/auth-backup.json ]; then
    mkdir -p ~/.local/share/opencode
    cp /tmp/auth-backup.json ~/.local/share/opencode/auth.json
    echo "Auth restored"
else
    echo "Need to re-authenticate"
fi

# 5. Test
qalcode --version
qalcode run "Recovery test"
```

## Getting Help

1. Check logs: `~/.local/share/opencode/log/`
2. GitHub issues: https://github.com/fivelidz/qalcode/issues
3. Compare with working opencode: `npm view opencode-ai version`

---

*Last updated: 2026-01-15*
