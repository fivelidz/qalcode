{ config, pkgs, lib, ... }:

with lib;

let
  cfg = config.programs.qalcode;
in {
  options.programs.qalcode = {
    enable = mkEnableOption "qalcode - OpenCode fork with Claude subscription support";
    
    package = mkOption {
      type = types.package;
      default = pkgs.qalcode;
      description = "The qalcode package to use";
    };

    defaultAgent = mkOption {
      type = types.str;
      default = "coder";
      description = "Default agent (coder, architect, researcher, debugger)";
    };

    enableAliases = mkOption {
      type = types.bool;
      default = true;
      description = "Enable shell aliases for quick access";
    };

    autoAuth = mkOption {
      type = types.bool;
      default = true;
      description = "Automatically set up OAuth authentication on first run";
    };
  };

  config = mkIf cfg.enable {
    environment.systemPackages = with pkgs; [
      cfg.package
      jq           # For JSON processing
      ripgrep      # Required by qalcode
      expect       # For automated auth setup
    ];

    # Create default configuration
    environment.etc."skel/.config/opencode/opencode.json".text = ''
      {
        "$schema": "https://opencode.ai/config.json"
      }
    '';

    # Create OAuth setup script
    environment.etc."qalcode-oauth-setup".text = ''
      #!/bin/bash
      echo "Setting up qalcode with Claude subscription..."
      echo "============================================="
      echo ""
      echo "This will authenticate using your Claude Pro/Max subscription"
      echo ""
      
      # Unset API key to force OAuth
      unset ANTHROPIC_API_KEY
      
      echo "Instructions:"
      echo "1. Select 'Anthropic' when prompted"
      echo "2. Choose 'Claude Pro/Max'"
      echo "3. Login in browser with your Claude account"
      echo "4. Copy and paste the authorization code"
      echo ""
      
      qalcode auth login
    '';
    
    environment.etc."qalcode-oauth-setup".mode = "0755";

    # Shell aliases if enabled
    programs.bash.shellAliases = mkIf cfg.enableAliases {
      qc = "qalcode agent run coder";
      qa = "qalcode agent run architect";
      qr = "qalcode agent run researcher";
      qd = "qalcode agent run debugger";
      qalcode-setup = "/etc/qalcode-oauth-setup";
    };

    # Environment setup
    environment.variables = {
      # Don't set ANTHROPIC_API_KEY - we want OAuth
      OPENCODE_PROVIDER = "anthropic";
      OPENCODE_MODEL = "claude-3-5-sonnet-20241022";
      OPENCODE_AGENT = cfg.defaultAgent;
    };

    # Create systemd user service for first-run setup
    systemd.user.services.qalcode-setup = mkIf cfg.autoAuth {
      description = "Qalcode OAuth Setup Helper";
      after = [ "graphical-session.target" ];
      wantedBy = [ "default.target" ];
      
      script = ''
        # Check if already authenticated
        if [ -f "$HOME/.local/share/opencode/auth.json" ]; then
          if ${pkgs.jq}/bin/jq -e '.anthropic' "$HOME/.local/share/opencode/auth.json" > /dev/null 2>&1; then
            echo "Already authenticated with Anthropic"
            exit 0
          fi
        fi
        
        # Check if Claude Code is authenticated
        if [ -f "$HOME/.claude.json" ]; then
          EMAIL=$(${pkgs.jq}/bin/jq -r '.oauthAccount.emailAddress' "$HOME/.claude.json" 2>/dev/null)
          if [ "$EMAIL" != "null" ] && [ -n "$EMAIL" ]; then
            echo "Claude Code authenticated as: $EMAIL"
            echo "Run 'qalcode-setup' to authenticate qalcode with same account"
          fi
        fi
      '';
      
      serviceConfig = {
        Type = "oneshot";
        RemainAfterExit = true;
      };
    };
  };
}