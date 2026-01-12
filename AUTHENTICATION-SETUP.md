# Qalcode Authentication Setup

## Working OAuth Setup for Claude Subscription

Qalcode DOES support Claude Pro/Max subscriptions through OAuth! The `opencode-anthropic-auth` plugin is automatically loaded.

### Setup Instructions

1. **Remove any API key** (to force OAuth):
   ```bash
   unset ANTHROPIC_API_KEY
   ```

2. **Run authentication**:
   ```bash
   ~/bin/qalcode auth login
   ```

3. **Select Anthropic**:
   - Use arrow keys to select "Anthropic"
   - Press Enter

4. **Choose Claude Pro/Max**:
   - Select "Claude Pro/Max" (first option)
   - Press Enter

5. **Browser Authentication**:
   - Browser opens to claude.ai OAuth
   - Login with your Claude account
   - Authorize the application
   - Copy the authorization code

6. **Paste Code**:
   - Return to terminal
   - Paste the authorization code
   - Press Enter

## How It Works

The `opencode-anthropic-auth@0.0.5` plugin:
- Handles OAuth flow for Claude subscriptions
- Uses OAuth tokens instead of API keys
- Automatically refreshes tokens
- Sets cost to $0 for subscription users
- Adds proper OAuth headers to API calls

## Configuration

Your `~/.config/opencode/opencode.json`:
```json
{
  "$schema": "https://opencode.ai/config.json"
}
```

The plugin automatically configures:
- Provider: anthropic
- Model: claude-3-5-sonnet-20241022 (Opus 4.1)
- Authentication: OAuth with your subscription

## Testing

After authentication:
```bash
# List credentials
~/bin/qalcode auth list

# Start with coder agent
~/bin/qalcode agent run coder

# Or just
~/bin/qalcode
```

## Troubleshooting

If authentication fails:
1. Make sure no ANTHROPIC_API_KEY is set
2. Check you're logged into claude.ai
3. Try clearing auth: `qalcode auth logout`
4. Re-run setup

## Note

I am Claude Opus 4.1, not 4.5. The model ID is `claude-opus-4-1-20250805`.