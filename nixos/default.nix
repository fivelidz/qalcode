# Qalcode NixOS Package
{ lib
, stdenv
, fetchFromGitHub
, bun
, nodejs
, makeWrapper
, ripgrep
}:

stdenv.mkDerivation rec {
  pname = "qalcode";
  version = "1.0.141";

  src = fetchFromGitHub {
    owner = "fivelidz";
    repo = "qalcode";
    rev = "main";
    sha256 = lib.fakeSha256; # Update after first build
  };

  nativeBuildInputs = [
    bun
    nodejs
    makeWrapper
  ];

  buildPhase = ''
    runHook preBuild
    
    export HOME=$TMPDIR
    
    # Install dependencies
    bun install --frozen-lockfile
    
    # Build the project
    bun run build
    
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall
    
    # Create output directories
    mkdir -p $out/{bin,lib/qalcode}
    
    # Copy built files
    cp -r dist/* $out/lib/qalcode/
    cp -r packages/opencode/dist/* $out/lib/qalcode/
    
    # Create main wrapper
    makeWrapper ${bun}/bin/bun $out/bin/qalcode \
      --add-flags "run $out/lib/qalcode/src/index.js" \
      --prefix PATH : ${lib.makeBinPath [ ripgrep ]} \
      --argv0 "qalcode"
    
    # Create wrapper for 'oc' command
    makeWrapper $out/bin/qalcode $out/bin/oc \
      --argv0 "opencode"
    
    # Create wrapper for 'opencode' command
    makeWrapper $out/bin/qalcode $out/bin/opencode \
      --argv0 "opencode"
    
    # Create agent-specific wrappers
    for agent in coder architect researcher debugger; do
      makeWrapper $out/bin/qalcode $out/bin/qalcode-$agent \
        --add-flags "agent run $agent" \
        --argv0 "qalcode-$agent"
    done
    
    runHook postInstall
  '';

  meta = with lib; {
    description = "Qalcode - OpenCode fork with Claude subscription support and custom agents";
    longDescription = ''
      Qalcode is a fork of OpenCode optimized for Claude integration.
      It supports OAuth authentication for Claude Pro/Max subscriptions,
      eliminating the need for separate API keys.
      
      Features:
      - Claude Pro/Max subscription support via OAuth
      - Custom agents: coder, architect, researcher, debugger
      - Claude Code-like experience
      - NixOS integration
    '';
    homepage = "https://github.com/fivelidz/qalcode";
    license = licenses.mit;
    maintainers = with maintainers; [ ];
    platforms = platforms.all;
    mainProgram = "qalcode";
  };
}