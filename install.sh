#!/usr/bin/env bash
# shellcheck shell=bash
set -Eeuo pipefail
IFS=$'\n\t'

readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
readonly REPO_ROOT="$SCRIPT_DIR"
readonly PLUGIN_NAME="opencode-rag-plugin"
readonly CLI_BIN_DIR="$HOME/.local/bin"
readonly GLOBAL_CONFIG="$HOME/.config/opencode"
readonly RUNTIME_DIR="$HOME/.opencode"

die()   { printf 'Error: %s\n' "$*" >&2; exit 1; }
info()  { printf '  %s\n' "$*"; }
step()  { printf '\n%s\n' "$*"; }
ok()    { printf '  %s  OK\n' "$1"; }
fail()  { printf '  %s  FAILED\n' "$1" >&2; }

get_plugin_version() {
  node -e "console.log(JSON.parse(require('fs').readFileSync('$REPO_ROOT/package.json','utf-8')).version)"
}

cleanup_tgz() {
  rm -f "$RUNTIME_DIR/$PLUGIN_NAME-"*.tgz
}

remove_from_config() {
  for cfg in opencode.jsonc opencode.json; do
    local cfgpath="$GLOBAL_CONFIG/$cfg"
    [[ -f "$cfgpath" ]] || continue
    node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$cfgpath','utf8'));if(c.plugin){c.plugin=c.plugin.filter(p=>p!=='$PLUGIN_NAME');if(c.plugin.length===0)delete c.plugin}fs.writeFileSync('$cfgpath',JSON.stringify(c,null,2)+'\n')"
    info "Removed $PLUGIN_NAME from $cfgpath"
  done
}

remove_stale_plugin_from_config() {
  local removed=false
  for cfg in opencode.jsonc opencode.json; do
    local cfgpath="$GLOBAL_CONFIG/$cfg"
    [[ -f "$cfgpath" ]] || continue
    if node -e "const fs=require('fs');const c=JSON.parse(fs.readFileSync('$cfgpath','utf8'));if(c.plugin){delete c.plugin;fs.writeFileSync('$cfgpath',JSON.stringify(c,null,2)+'\n');process.exit(0)}process.exit(1)" 2>/dev/null; then
      info "Removed stale plugin entry from $cfgpath"
      removed=true
    fi
  done
  $removed
}

# --- preflight ---

command -v npm >/dev/null 2>&1 || die "npm is required but was not found in PATH"
command -v opencode >/dev/null 2>&1 || die "opencode is required but was not found in PATH"

# --- uninstall ---

if [[ "${1:-}" = "uninstall" ]]; then
  step "Uninstalling $PLUGIN_NAME from all locations..."
  info "Removing CLI wrapper..."
  rm -f "$CLI_BIN_DIR/opencode-rag" "$CLI_BIN_DIR/opencode-rag.ps1" "$CLI_BIN_DIR/opencode-rag.sh"
  info "Removing from OpenCode runtime ($RUNTIME_DIR)..."
  rm -rf "$RUNTIME_DIR/node_modules" "$RUNTIME_DIR/package.json"
  info "Removing .tgz package files...";                     cleanup_tgz
  info "Removing OpenCode cache..."
  rm -rf "$HOME/.cache/opencode/packages/$PLUGIN_NAME-"* 2>/dev/null || true
  info "Updating OpenCode configuration...";                 remove_from_config
  info "Removing stale plugin registrations...";              remove_stale_plugin_from_config || true
  info "Removing workspace-local files..."
  rm -f "$REPO_ROOT/.opencode/plugins/rag-plugin.js" "$REPO_ROOT/.opencode/plugins/package.json"
  rm -rf "$REPO_ROOT/.opencode/plugins" 2>/dev/null || true
  step "Uninstalled. Restart OpenCode if it is running."
  exit 0
fi

# --- compile ---

if [[ "${1:-}" = "compile" ]]; then
  cd "$REPO_ROOT"

  step "Building $PLUGIN_NAME..."
  npm run build

  step "Installing production dependencies (compiles native modules)..."
  npm install --omit=dev --legacy-peer-deps --ignore-scripts --no-package-lock 2>&1 || die "npm install --omit=dev failed"

  step "Installing @opencode-ai/plugin into runtime..."
  npm install @opencode-ai/plugin --no-save --no-package-lock --legacy-peer-deps --silent 2>&1 || die "npm install @opencode-ai/plugin failed"

  step "Packing $PLUGIN_NAME..."
  version=$(get_plugin_version)
  tgz_name="$PLUGIN_NAME-$version.tgz"
  tgz_path="$REPO_ROOT/$tgz_name"
  rm -f "$tgz_path"
  pack_output=$(npm pack --pack-destination "$REPO_ROOT" 2>&1)
  if [[ $? -ne 0 ]]; then die "npm pack failed: $pack_output"; fi

    step "Preparing runtime directory ($RUNTIME_DIR)..."
    mkdir -p "$RUNTIME_DIR/node_modules"

    # Extract plugin (dist/ + wasm/ + package.json) from .tgz
    plugin_dir="$RUNTIME_DIR/node_modules/$PLUGIN_NAME"
    rm -rf "$plugin_dir"
    tar -xzf "$tgz_path" -C "$RUNTIME_DIR/node_modules"
    mv "$RUNTIME_DIR/node_modules/package" "$plugin_dir"

    # Copy all production deps (with precompiled native modules) to runtime
    if [[ -d "$plugin_dir/dist" ]]; then
      deps_target="$RUNTIME_DIR/node_modules"
      if [[ -d "$deps_target/commander" ]]; then
        info "Runtime deps already exist — skipping copy"
      else
        info "Copying production dependencies to runtime..."
        for item in "$REPO_ROOT/node_modules"/*/; do
          base=$(basename "$item")
          [[ "$base" = "$PLUGIN_NAME" || "$base" = ".bin" ]] && continue
          cp -r "$item" "$deps_target/" 2>/dev/null || true
        done
        # @-scoped packages: copy everything (dirs + files) recursively
        for scope_dir in "$REPO_ROOT/node_modules/@"*/; do
          [[ -d "$scope_dir" ]] || continue
          scope_name="@$(basename "$scope_dir")"
          mkdir -p "$deps_target/$scope_name"
          cp -r "$scope_dir"/* "$deps_target/$scope_name/" 2>/dev/null || true
        done
        info "Dependencies copied."
      fi
    else
    fail "$plugin_dir"; die "Failed to extract plugin — dist/ not found"
  fi

  # Verify runtime is self-contained
  if [[ -f "$RUNTIME_DIR/node_modules/commander/package.json" ]] && \
     [[ -f "$RUNTIME_DIR/node_modules/@opencode-ai/plugin/package.json" ]]; then
    ok "Precompiled bundle ready at $RUNTIME_DIR"
  else
    fail "Precompiled bundle"; die "Runtime deps incomplete — check node_modules/"
  fi

  # Clean up the .tgz from repo root
  rm -f "$tgz_path"

  exit 0
fi

# --- install ---

cd "$REPO_ROOT"

# Check that the precompiled bundle exists at the runtime dir
plugin_dir="$RUNTIME_DIR/node_modules/$PLUGIN_NAME"
if [[ ! -d "$plugin_dir/dist" ]]; then
  die "Precompiled bundle not found. Run '$0 compile' first."
fi

step "Installing $PLUGIN_NAME on this machine..."
info "Plugin bundle found at $plugin_dir"

step "Making CLI available on PATH..."
mkdir -p "$CLI_BIN_DIR"
cat > "$CLI_BIN_DIR/opencode-rag" << 'WRAPPER'
#!/usr/bin/env bash
exec node "$HOME/.opencode/node_modules/opencode-rag-plugin/dist/cli.js" "$@"
WRAPPER
chmod +x "$CLI_BIN_DIR/opencode-rag"
ok "$CLI_BIN_DIR/opencode-rag"

# --- verification ---

step "Verifying installation..."
verified=true

if [[ -d "$plugin_dir/dist" ]]; then
  ok "Runtime plugin"
else
  fail "Runtime plugin"; verified=false
fi

if [[ -x "$CLI_BIN_DIR/opencode-rag" ]]; then
  ok "CLI wrapper"
else
  fail "CLI wrapper"; verified=false
fi

# --- CLI smoke test ---

step "Verifying CLI works..."
cli_help=$("$CLI_BIN_DIR/opencode-rag" --help 2>&1)
if echo "$cli_help" | grep -q "opencode-rag"; then
  ok "CLI help loads successfully"
else
  fail "CLI smoke test"; verified=false
fi

# --- done ---

step ""
if $verified; then printf 'Installation complete!\n'; else printf 'Installation finished with warnings (see above).\n' >&2; fi

printf '\nWhat to do next:\n'
printf '  1. Run "opencode-rag init" in each workspace you want to use with OpenCodeRAG.\n'
printf '  2. Run "opencode-rag index" to index workspace files.\n'
printf '  3. Restart OpenCode if it is running so it discovers the RAG tools.\n'
printf '  4. OpenCode will automatically use the indexed data for context-aware queries.\n'
printf '\nRun "%s uninstall" to remove.\n' "$0"
