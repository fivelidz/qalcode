#!/bin/bash
# Run OpenCode in YOLO EXTREME mode - NO RESTRICTIONS
# WARNING: This mode has NO safety checks. Use at your own risk!

echo "WARNING: Starting OpenCode in YOLO EXTREME mode"
echo "All permissions are ALLOWED. No safety restrictions."
echo ""

OPENCODE_CONFIG=~/.config/opencode/opencode-yolo-extreme.json \
exec ~/Projects/opencode-custom/packages/opencode/dist/opencode-linux-x64/bin/opencode \
  --agent yolo-extreme \
  "$@"
