# Example NixOS configuration with qalcode
# Add to your /etc/nixos/configuration.nix

{ config, pkgs, ... }:

let
  # Build qalcode package
  qalcode = pkgs.callPackage ./default.nix {};
in {
  imports = [
    ./module.nix
  ];

  # Enable qalcode with OAuth support
  programs.qalcode = {
    enable = true;
    package = qalcode;
    defaultAgent = "coder";  # Claude Code-like experience
    enableAliases = true;    # qc, qa, qr, qd shortcuts
    autoAuth = true;         # Setup helper on first run
  };

  # Additional recommended packages
  environment.systemPackages = with pkgs; [
    # Terminal
    ghostty
    tmux
    
    # Development
    git
    neovim
    vscode
    
    # Utilities
    jq
    ripgrep
    fd
    bat
    
    # For comparison/backup
    claude-code  # If you want to keep using Claude Code too
  ];

  # Shell configuration
  programs.bash = {
    enable = true;
    shellInit = ''
      # Fix mouse issues in Claude Code
      export CLAUDE_CODE_DISABLE_CURSOR_CHANGES=true
      
      # GitHub token (replace with your token)
      # export GITHUB_TOKEN="ghp_YOUR_TOKEN_HERE"
      
      # Don't set ANTHROPIC_API_KEY - we use OAuth!
    '';
  };

  # User-specific setup (adjust username)
  users.users.qalarc2 = {
    extraGroups = [ "wheel" "docker" ];
    shell = pkgs.bash;
  };
}