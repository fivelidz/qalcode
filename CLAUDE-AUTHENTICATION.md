# Claude Authentication in Qalcode

## The Authentication Problem

Claude Code uses OAuth subscription authentication (browser-based login), while qalcode/OpenCode only supports API keys. This is a fundamental incompatibility.

### How Claude Code Works
- Uses OAuth authentication via browser
- Stores credentials in `~/.claude.json`
- Uses Anthropic subscription endpoints
- No API key required

### How Qalcode/OpenCode Works
- Requires ANTHROPIC_API_KEY environment variable
- Uses Anthropic API endpoints
- No OAuth support

## Current Status

Your Claude Code is authenticated with:
- Email: alexeitrbrown@gmail.com
- Account UUID: 23d20a15-123f-47cc-a14e-0902f4ab57d1
- Organization: alexeitrbrown@gmail.com's Organization

However, this authentication **cannot be used by qalcode** because:
1. OAuth tokens are session-based and encrypted
2. Qalcode doesn't implement OAuth flow
3. API endpoints differ from subscription endpoints

## Solution Options

### Option 1: Use API Key (Current Workaround)
1. Go to https://console.anthropic.com/
2. Create an API key
3. Add billing to API account (separate from subscription!)
4. Set environment variable: `export ANTHROPIC_API_KEY='your-key'`

**Downside:** You pay twice - subscription + API usage

### Option 2: Fork and Implement OAuth (Future)
Would require:
- Implementing browser-based OAuth flow
- Token management and refresh
- Subscription endpoint support
- Significant code changes to OpenCode

### Option 3: Use Proxy (Theoretical)
Create a local proxy that:
- Intercepts qalcode API calls
- Translates to subscription endpoints
- Uses Claude Code's authentication

**Status:** Not implemented, complex

## Helper Scripts Created

### `/home/qalarc2/bin/claude-auth-bridge.sh`
Checks Claude Code authentication status and provides guidance

### `/home/qalarc2/bin/qalcode-wrapper`
Wrapper that checks authentication and provides helpful messages

## Recommendation

For now, you'll need to create an API key and pay for API usage separately from your subscription. This is a limitation of OpenCode that cannot be easily worked around.

The ideal solution would be for qalcode/OpenCode to implement proper OAuth authentication like Claude Code does.