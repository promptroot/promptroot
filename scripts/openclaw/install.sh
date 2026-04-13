#!/usr/bin/env bash
# ============================================================================
# PromptRoot × OpenClaw — Install Script
#
# Gets you from zero to "Run in Brace connected" in one command.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/promptroot/promptroot/main/scripts/openclaw/install.sh | bash
#
# Options (env vars):
#   ANTHROPIC_API_KEY      Skip the API key prompt
#   PROMPTROOT_AGENT_TOKEN Skip the agent token prompt
#   OPENCLAW_NO_DAEMON     Set to "1" to skip systemd service install
#   INSTALL_REF            Override GitHub ref for plugin downloads (branch/tag/SHA)
#                          Defaults to "main". Set automatically in CI via PR testing.
# ============================================================================

set -euo pipefail

BOLD='\033[1m'
CYAN='\033[38;2;77;217;255m'
GREEN='\033[38;2;39;174;96m'
WARN='\033[38;2;243;156;18m'
ERROR='\033[38;2;192;80;77m'
NC='\033[0m'

# ── Phase 1: Single ref source ────────────────────────────────────────────────
# All remote artifact downloads use INSTALL_REF so PR testing pulls branch
# artifacts rather than silently falling back to main.
INSTALL_REF="${INSTALL_REF:-main}"
REPO_RAW="https://raw.githubusercontent.com/promptroot/promptroot/${INSTALL_REF}"

PLUGINS="promptroot-relay promptroot-gateway"
OPENCLAW_EXT_DIR="${HOME}/.openclaw/extensions"
OPENCLAW_ENV="${HOME}/.openclaw/.env"

log()    { printf "${CYAN}▶${NC} %s\n" "$*"; }
ok()     { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn()   { printf "${WARN}⚠${NC} %s\n" "$*"; }
die()    { printf "${ERROR}✗${NC} %s\n" "$*" >&2; exit 1; }
header() { printf "\n${BOLD}${CYAN}%s${NC}\n" "$*"; }

# Track validation results for final summary
VALIDATION_PASS=()
VALIDATION_FAIL=()

pass() { VALIDATION_PASS+=("$*"); }
fail() { VALIDATION_FAIL+=("$*"); }

# ── Phase 2: Windows first-class flow ─────────────────────────────────────────

IS_WINDOWS=0
case "$(uname -s 2>/dev/null)" in
  MINGW*|MSYS*|CYGWIN*)
    IS_WINDOWS=1
    ;;
esac

header "PromptRoot × OpenClaw Setup"
log "Install ref: ${INSTALL_REF}"
[ "${IS_WINDOWS}" = "1" ] && log "Platform: Windows (Git Bash / MSYS)"

# ── Prereq checks ─────────────────────────────────────────────────────────────

command -v curl >/dev/null 2>&1 || die "curl is required but not installed."

# ── Step 1: Install OpenClaw ──────────────────────────────────────────────────

header "Step 1 — Installing OpenClaw"

if command -v openclaw >/dev/null 2>&1; then
  CURRENT_VER=$(openclaw --version 2>/dev/null | grep -oE '[0-9]{4}\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
  ok "OpenClaw already installed (${CURRENT_VER}) — skipping"
elif [ "${IS_WINDOWS}" = "1" ]; then
  log "Downloading OpenClaw via PowerShell..."
  powershell.exe -NonInteractive -NoProfile -Command \
    "irm https://openclaw.ai/install.ps1 | iex" 2>/dev/null || \
    die "PowerShell install failed. Run manually: powershell.exe -c \"irm https://openclaw.ai/install.ps1 | iex\""
  ok "OpenClaw installed"
else
  log "Downloading OpenClaw installer..."
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-onboard
  ok "OpenClaw installed"
fi

# Ensure openclaw is on PATH for subsequent steps
NODE_VER="$(node --version 2>/dev/null | tr -d v)" || NODE_VER=""
[ -n "${NODE_VER}" ] && export PATH="${HOME}/.local/bin:${HOME}/.nvm/versions/node/${NODE_VER}/bin:${PATH}"
export PATH="${HOME}/.local/bin:${PATH}"
# Windows: AppData locations
[ "${IS_WINDOWS}" = "1" ] && export PATH="${APPDATA}/openclaw/bin:${LOCALAPPDATA}/openclaw/bin:${PATH}" 2>/dev/null || true

command -v openclaw >/dev/null 2>&1 || die "openclaw not found on PATH after install. Open a new terminal and re-run, or add OpenClaw's bin directory to PATH."

# ── Step 2: Configure auth ────────────────────────────────────────────────────

header "Step 2 — Configuring Anthropic auth"

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  ok "ANTHROPIC_API_KEY already set — using it"
  openclaw onboard \
    --non-interactive \
    --accept-risk \
    --auth-choice anthropic-api-key \
    --anthropic-api-key "${ANTHROPIC_API_KEY}" \
    --install-daemon 2>/dev/null || true
else
  printf "\n${BOLD}Do you have an Anthropic API key, or a Claude.ai Pro/Max subscription?${NC}\n"
  printf "  [1] Anthropic API key (console.anthropic.com)\n"
  printf "  [2] Claude.ai Pro/Max subscription (OAuth — recommended)\n"
  printf "Choice [1/2]: "
  read -r AUTH_CHOICE </dev/tty

  case "${AUTH_CHOICE}" in
    2)
      log "Launching Claude OAuth flow..."
      openclaw onboard \
        --auth-choice oauth \
        --install-daemon 2>/dev/null || true
      ;;
    *)
      printf "Anthropic API key: "
      read -rs API_KEY </dev/tty
      echo
      [ -n "${API_KEY}" ] || die "API key cannot be empty."
      openclaw onboard \
        --non-interactive \
        --accept-risk \
        --auth-choice anthropic-api-key \
        --anthropic-api-key "${API_KEY}" \
        --install-daemon 2>/dev/null || true
      ;;
  esac
fi

ok "Auth configured"

# ── Step 3: Install plugins ───────────────────────────────────────────────────
# Phase 2: Windows now runs the same real install steps, not just instructions.
# Phase 1: All downloads use $REPO_RAW which is pinned to $INSTALL_REF.

header "Step 3 — Installing PromptRoot plugins (ref: ${INSTALL_REF})"

mkdir -p "${OPENCLAW_EXT_DIR}"

for plugin in ${PLUGINS}; do
  dir="${OPENCLAW_EXT_DIR}/${plugin}"
  log "Installing ${plugin}..."
  mkdir -p "${dir}"

  PLUGIN_INSTALL_OK=1
  for file in index.js openclaw.plugin.json package.json; do
    if ! curl -fsSL "${REPO_RAW}/scripts/openclaw/plugins/${plugin}/${file}" \
        -o "${dir}/${file}"; then
      warn "Could not fetch ${file} for ${plugin} from ref ${INSTALL_REF}"
      PLUGIN_INSTALL_OK=0
    fi
  done

  if [ "${PLUGIN_INSTALL_OK}" = "0" ]; then
    fail "${plugin}: download failed (ref=${INSTALL_REF})"
    continue
  fi

  # Install npm dependencies (e.g. ws for promptroot-relay)
  if [ -f "${dir}/package.json" ]; then
    if command -v npm >/dev/null 2>&1; then
      (cd "${dir}" && npm install --silent --no-fund --no-audit) || {
        fail "${plugin}: npm install failed"
        continue
      }
    else
      fail "${plugin}: npm not found — cannot install dependencies"
      continue
    fi
  fi

  # Enable plugin — this is a hard requirement, not best-effort
  if ! openclaw plugins enable "${plugin}" 2>/dev/null; then
    fail "${plugin}: could not enable — run: openclaw plugins enable ${plugin}"
    continue
  fi

  ok "${plugin} installed and enabled"
done

# ── Step 4: Agent token ───────────────────────────────────────────────────────
# Phase 3: Normalized token handling. Exactly one entry in .env after any run.

header "Step 4 — PromptRoot agent token"

mkdir -p "$(dirname "${OPENCLAW_ENV}")"
touch "${OPENCLAW_ENV}"

_write_token_to_env() {
  local token="$1"
  # Replace existing entry or append — never duplicate
  local tmp="${OPENCLAW_ENV}.promptroot.tmp"
  grep -v "^PROMPTROOT_AGENT_TOKEN=" "${OPENCLAW_ENV}" > "${tmp}" 2>/dev/null || true
  printf "PROMPTROOT_AGENT_TOKEN=%s\n" "${token}" >> "${tmp}"
  mv "${tmp}" "${OPENCLAW_ENV}"
}

if [ -n "${PROMPTROOT_AGENT_TOKEN:-}" ]; then
  ok "PROMPTROOT_AGENT_TOKEN provided via environment"
  _write_token_to_env "${PROMPTROOT_AGENT_TOKEN}"
  ok "Agent token written to ${OPENCLAW_ENV}"
else
  printf "\nGenerate your agent token at: ${BOLD}https://promptroot.io/agent-api${NC}\n"
  printf "(Sign in with GitHub → click \"New token\" → copy)\n\n"
  printf "Paste your agent token (pra_...): "

  AGENT_TOKEN=""
  if read -rs AGENT_TOKEN </dev/tty 2>/dev/null; then
    echo
  else
    echo
    warn "Could not read token interactively."
    printf "\n${BOLD}Run this command manually to set your token:${NC}\n"
    printf "  grep -v '^PROMPTROOT_AGENT_TOKEN=' %s > %s.tmp && echo 'PROMPTROOT_AGENT_TOKEN=pra_YOUR_TOKEN' >> %s.tmp && mv %s.tmp %s\n" \
      "${OPENCLAW_ENV}" "${OPENCLAW_ENV}" "${OPENCLAW_ENV}" "${OPENCLAW_ENV}" "${OPENCLAW_ENV}"
    fail "agent token: interactive read failed — set manually"
    AGENT_TOKEN=""
  fi

  if [ -n "${AGENT_TOKEN}" ]; then
    _write_token_to_env "${AGENT_TOKEN}"
    ok "Agent token saved to ${OPENCLAW_ENV}"
  else
    fail "agent token: not set — visit https://promptroot.io/agent-api"
  fi
fi

# Confirm token entry exists in env file
if grep -q "^PROMPTROOT_AGENT_TOKEN=pra_" "${OPENCLAW_ENV}" 2>/dev/null; then
  pass "agent token present in ${OPENCLAW_ENV}"
else
  fail "agent token: missing or malformed in ${OPENCLAW_ENV}"
fi

# ── Step 5: Gateway lifecycle ─────────────────────────────────────────────────
# Phase 4: Detect running/stopped, restart or start, wait for readiness.

header "Step 5 — Starting gateway"

GATEWAY_STATUS="$(openclaw gateway status 2>/dev/null || echo 'unknown')"

if printf '%s' "${GATEWAY_STATUS}" | grep -qiE "running|active"; then
  log "Gateway is running — restarting to load integration changes..."
  if openclaw gateway restart 2>/dev/null; then
    ok "Gateway restarted"
  else
    warn "Gateway restart returned non-zero — continuing"
  fi
else
  log "Gateway is not running — starting..."
  if openclaw gateway start 2>/dev/null; then
    ok "Gateway started"
  else
    warn "Gateway start returned non-zero — continuing"
  fi
fi

# Wait for gateway readiness (up to 10 seconds)
GATEWAY_READY=0
for _i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  if openclaw gateway status 2>/dev/null | grep -qiE "running|active"; then
    GATEWAY_READY=1
    break
  fi
done

if [ "${GATEWAY_READY}" = "1" ]; then
  ok "Gateway is running"
  pass "gateway: running"
else
  warn "Gateway did not reach running state within 10 seconds"
  fail "gateway: not running — run: openclaw gateway start"
fi

# ── Phase 5: Post-install validation block ────────────────────────────────────

header "Validation"

# 1. OpenClaw CLI available
if command -v openclaw >/dev/null 2>&1; then
  pass "openclaw: installed ($(openclaw --version 2>/dev/null | head -1 || echo 'version unknown'))"
else
  fail "openclaw: not found on PATH"
fi

# 2. Node.js version >= 18
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node --version | sed 's/^v//' | cut -d. -f1)"
  if [ "${NODE_MAJOR}" -ge 18 ] 2>/dev/null; then
    pass "node: v$(node --version | tr -d v) (>= 18 required)"
  else
    fail "node: v$(node --version | tr -d v) is below minimum v18"
  fi
else
  fail "node: not found"
fi

# 3. Both plugins enabled
for plugin in ${PLUGINS}; do
  if openclaw plugins list 2>/dev/null | grep -q "${plugin}"; then
    pass "plugin ${plugin}: enabled"
  else
    fail "plugin ${plugin}: not enabled — run: openclaw plugins enable ${plugin}"
  fi
done

# 4. Token in env file (already checked above, deduplicate into summary only)
# (result already recorded in _write_token_to_env section)

# 5. Relay connectivity (best-effort — gateway must be running with valid token)
RELAY_URL="https://promptroot-relay.fly.dev/health"
if command -v curl >/dev/null 2>&1; then
  HTTP_CODE="$(curl -o /dev/null -s -w '%{http_code}' --max-time 5 "${RELAY_URL}" 2>/dev/null || echo '000')"
  if [ "${HTTP_CODE}" = "200" ]; then
    pass "relay: reachable (${RELAY_URL})"
  else
    warn "Relay health check returned HTTP ${HTTP_CODE} — may be a network issue"
    fail "relay: health check failed (HTTP ${HTTP_CODE})"
  fi
fi

# ── Print summary ─────────────────────────────────────────────────────────────

printf "\n${BOLD}══════════════════════════ Summary ══════════════════════════${NC}\n"

for item in "${VALIDATION_PASS[@]+"${VALIDATION_PASS[@]}"}"; do
  printf "  ${GREEN}PASS${NC}  %s\n" "${item}"
done

FINAL_STATUS=0
for item in "${VALIDATION_FAIL[@]+"${VALIDATION_FAIL[@]}"}"; do
  printf "  ${ERROR}FAIL${NC}  %s\n" "${item}"
  FINAL_STATUS=1
done

printf "${BOLD}═══════════════════════════════════════════════════════════════${NC}\n"

if [ "${FINAL_STATUS}" = "0" ]; then
  printf "\n${BOLD}${GREEN}✓ Setup complete — Relay connected!${NC}\n\n"
  printf "  Chat with Brace:  ${BOLD}http://localhost:18789${NC}\n"
  printf "  Run prompts at:   ${BOLD}https://promptroot.io${NC}\n\n"
else
  printf "\n${WARN}⚠ Setup finished with failures above.${NC}\n"
  printf "  Fix each FAIL item, then re-run this script.\n"
  printf "  Re-running is safe and idempotent.\n\n"
fi

exit "${FINAL_STATUS}"
