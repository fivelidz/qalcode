# NixOS Setup Guide for Qalcode

## Quick Install

```bash
# 1. Clone repository
git clone https://github.com/fivelidz/qalcode.git
cd qalcode

# 2. Build with Nix
nix build --print-build-logs

# 3. Create symlinks
mkdir -p ~/bin
ln -sf $(pwd)/result/bin/opencode ~/bin/qalcode
ln -sf $(pwd)/result/bin/opencode ~/bin/oc
ln -sf $(pwd)/result/bin/opencode ~/bin/qc

# 4. Add to PATH
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 5. Set up Claude API
export ANTHROPIC_API_KEY="your-claude-code-api-key"
echo 'export ANTHROPIC_API_KEY="your-claude-code-api-key"' >> ~/.bashrc
```

## Configuration for Claude Opus 4.1

Create `~/.config/opencode/opencode.json`:
```json
{
  "model": {
    "provider": "anthropic", 
    "model": "claude-opus-4-1-20250805"
  },
  "$schema": "https://opencode.ai/config.json"
}
```

## Built-in Agents

- **coder** - Claude Code default agent
- **researcher** - Read-only exploration
- **architect** - System design
- **debugger** - Bug fixing
- **build** - Full development
- **plan** - Planning mode
- Plus more!

## Troubleshooting

### Commands not found
```bash
export PATH="$HOME/bin:$PATH"
```

### Config errors
Use minimal config - OpenCode validates strictly.

### No Claude models
Set `ANTHROPIC_API_KEY` environment variable.

## Ghostty Terminal Users

Add to `~/.config/ghostty/config`:
```
command = /run/current-system/sw/bin/bash --login
```