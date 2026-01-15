# QalCode Update Procedure

Follow this guide when OpenCode releases a new version.

## Quick Update (When OpenCode Updates)

```bash
# 1. Check if update needed
CURRENT=$(qalcode --version)
LATEST=$(npm view opencode-ai version)
echo "Current: $CURRENT"
echo "Latest:  $LATEST"

# 2. If different, continue below
```

### Step 1: Update Version Number

Edit `~/qalcode/packages/opencode/src/installation/index.ts`:

```typescript
// Find this line (around line 166):
: (process.env.OPENCODE_VERSION || "1.1.21")  // ← Change to new version
```

### Step 2: Check Auth Plugin Versions

```bash
# Check latest versions
npm view opencode-anthropic-auth version
npm view opencode-copilot-auth version
```

Edit `~/qalcode/packages/opencode/src/plugin/index.ts`:

```typescript
// Find these lines (around line 31-32):
plugins.push("opencode-copilot-auth@0.0.12")   // ← Update if needed
plugins.push("opencode-anthropic-auth@0.0.9")  // ← Update if needed
```

### Step 3: Test

```bash
# Clear cache first
rm -rf ~/.cache/opencode/node_modules

# Test
qalcode run "Update test"
```

### Step 4: Commit and Push

```bash
cd ~/qalcode
git add -A
git commit -m "Update to match OpenCode X.Y.Z"
git push
```

## Automated Update Script

Save this as `~/bin/update-qalcode.sh`:

```bash
#!/bin/bash
set -e

echo "=== QalCode Update Script ==="

# Get versions
CURRENT=$(qalcode --version 2>/dev/null || echo "unknown")
LATEST=$(npm view opencode-ai version)
AUTH_LATEST=$(npm view opencode-anthropic-auth version)
COPILOT_LATEST=$(npm view opencode-copilot-auth version)

echo "Current QalCode:     $CURRENT"
echo "Latest OpenCode:     $LATEST"
echo "Latest anthropic-auth: $AUTH_LATEST"
echo "Latest copilot-auth:   $COPILOT_LATEST"
echo ""

if [ "$CURRENT" = "$LATEST" ]; then
    echo "Already up to date!"
    exit 0
fi

echo "Update needed: $CURRENT → $LATEST"
read -p "Continue? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

cd ~/qalcode

# Update version
sed -i "s/OPENCODE_VERSION || \"[^\"]*\"/OPENCODE_VERSION || \"$LATEST\"/" \
    packages/opencode/src/installation/index.ts

# Update auth plugins
sed -i "s/opencode-anthropic-auth@[0-9.]*/opencode-anthropic-auth@$AUTH_LATEST/" \
    packages/opencode/src/plugin/index.ts
sed -i "s/opencode-copilot-auth@[0-9.]*/opencode-copilot-auth@$COPILOT_LATEST/" \
    packages/opencode/src/plugin/index.ts

# Clear cache
rm -rf ~/.cache/opencode/node_modules

# Test
echo "Testing..."
if timeout 30 qalcode run "Update verification" 2>&1 | grep -q "Error"; then
    echo "ERROR: Update failed!"
    git checkout -- .
    exit 1
fi

echo "Update successful!"

# Commit
git add -A
git commit -m "Update to match OpenCode $LATEST

- opencode-anthropic-auth@$AUTH_LATEST
- opencode-copilot-auth@$COPILOT_LATEST"

echo "Committed. Run 'git push' to publish."
```

Make executable:
```bash
chmod +x ~/bin/update-qalcode.sh
```

## Version Compatibility Matrix

Keep this updated:

| Date | OpenCode | anthropic-auth | copilot-auth | Status |
|------|----------|----------------|--------------|--------|
| 2026-01-15 | 1.1.21 | 0.0.9 | 0.0.12 | Working |
| 2026-01-13 | 1.1.15 | 0.0.8 | 0.0.9 | Working |

## What to Watch For

### Breaking Changes

Monitor OpenCode releases for:
- Changes to `anthropic-beta` header values
- Changes to OAuth flow
- New required headers
- Plugin API changes

### Signs Update Is Needed

1. OAuth errors after OpenCode update
2. New features not working
3. Plugin installation failures

## Rollback Procedure

If update breaks things:

```bash
cd ~/qalcode

# See recent commits
git log --oneline -10

# Rollback to specific commit
git reset --hard <commit-hash>

# Or rollback one commit
git reset --hard HEAD~1

# Clear cache
rm -rf ~/.cache/opencode/node_modules

# Test
qalcode run "test"
```

---

*Last updated: 2026-01-15*
