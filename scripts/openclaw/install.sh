#!/usr/bin/env bash
# ============================================================================
# PromptRoot × OpenClaw — Install Script
#
# Gets you from zero to "talking to Brace" in one command.
#
# Usage:
#   curl -sSL https://raw.githubusercontent.com/promptroot/promptroot/main/scripts/openclaw/install.sh | sh
#
# Options (env vars):
#   ANTHROPIC_API_KEY      Skip the API key prompt
#   PROMPTROOT_AGENT_TOKEN Skip the agent token prompt
#   OPENCLAW_NO_DAEMON     Set to "1" to skip systemd service install
# ============================================================================

set -euo pipefail

BOLD='\033[1m'
CYAN='\033[38;2;77;217;255m'
GREEN='\033[38;2;39;174;96m'
WARN='\033[38;2;243;156;18m'
ERROR='\033[38;2;192;80;77m'
NC='\033[0m'

REPO_RAW="https://raw.githubusercontent.com/promptroot/promptroot/main"
PLUGINS="promptroot-relay promptroot-gateway"
OPENCLAW_EXT_DIR="${HOME}/.openclaw/extensions"
OPENCLAW_ENV="${HOME}/.openclaw/.env"

log()  { printf "${CYAN}▶${NC} %s\n" "$*"; }
ok()   { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn() { printf "${WARN}⚠${NC} %s\n" "$*"; }
die()  { printf "${ERROR}✗${NC} %s\n" "$*" >&2; exit 1; }
header() { printf "\n${BOLD}${CYAN}%s${NC}\n" "$*"; }

# ── Prereq checks ─────────────────────────────────────────────────────────────

header "PromptRoot × OpenClaw Setup"

command -v curl >/dev/null 2>&1 || die "curl is required but not installed."
command -v node >/dev/null 2>&1 || {
  warn "Node.js not found — OpenClaw installer will handle this."
}

# ── Step 1: Install OpenClaw ──────────────────────────────────────────────────

header "Step 1 — Installing OpenClaw"

if command -v openclaw >/dev/null 2>&1; then
  CURRENT_VER=$(openclaw --version 2>/dev/null | grep -oE '[0-9]{4}\.[0-9]+\.[0-9]+' | head -1 || echo "unknown")
  ok "OpenClaw already installed (${CURRENT_VER}) — skipping"
else
  log "Downloading OpenClaw installer..."
  curl -fsSL --proto '=https' --tlsv1.2 https://openclaw.ai/install.sh | bash -s -- --no-onboard
  ok "OpenClaw installed"
fi

# Ensure openclaw is on PATH for subsequent steps
export PATH="${HOME}/.local/bin:${HOME}/.nvm/versions/node/$(node --version 2>/dev/null | tr -d v)/bin:${PATH}"
command -v openclaw >/dev/null 2>&1 || die "openclaw not found on PATH after install. Try opening a new terminal."

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
  printf "  [2] Claude.ai Pro/Max subscription (OAuth)\n"
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

header "Step 3 — Installing PromptRoot plugins"

mkdir -p "${OPENCLAW_EXT_DIR}"

for plugin in ${PLUGINS}; do
  dir="${OPENCLAW_EXT_DIR}/${plugin}"
  log "Installing ${plugin}..."
  mkdir -p "${dir}"

  for file in index.js openclaw.plugin.json package.json; do
    curl -fsSL "${REPO_RAW}/scripts/openclaw/plugins/${plugin}/${file}" \
      -o "${dir}/${file}" 2>/dev/null || {
      warn "Could not fetch ${file} for ${plugin} — skipping"
      continue
    }
  done

  # Install npm dependencies (ws for promptroot-relay)
  if [ -f "${dir}/package.json" ] && command -v npm >/dev/null 2>&1; then
    (cd "${dir}" && npm install --silent --no-fund --no-audit 2>/dev/null) || true
  fi

  # Enable plugin in openclaw config
  openclaw plugins enable "${plugin}" 2>/dev/null || \
    warn "Could not auto-enable ${plugin} — run: openclaw plugins enable ${plugin}"

  ok "${plugin} installed"
done

# ── Step 4: Agent token ───────────────────────────────────────────────────────

header "Step 4 — PromptRoot agent token"

if [ -n "${PROMPTROOT_AGENT_TOKEN:-}" ]; then
  ok "PROMPTROOT_AGENT_TOKEN already set — skipping"
else
  printf "\nGenerate your agent token at: ${BOLD}https://promptroot.io/agent-api${NC}\n"
  printf "(Sign in with GitHub, click \"New token\", copy it)\n\n"
  printf "Paste your agent token (pra_...): "
  read -rs AGENT_TOKEN </dev/tty
  echo

  [ -n "${AGENT_TOKEN}" ] || { warn "No token entered — skipping. Set PROMPTROOT_AGENT_TOKEN in ~/.openclaw/.env later."; }

  if [ -n "${AGENT_TOKEN}" ]; then
    # Write to .env
    touch "${OPENCLAW_ENV}"
    # Remove existing entry if present
    grep -v "^PROMPTROOT_AGENT_TOKEN=" "${OPENCLAW_ENV}" > "${OPENCLAW_ENV}.tmp" 2>/dev/null || true
    echo "PROMPTROOT_AGENT_TOKEN=${AGENT_TOKEN}" >> "${OPENCLAW_ENV}.tmp"
    mv "${OPENCLAW_ENV}.tmp" "${OPENCLAW_ENV}"
    ok "Agent token saved to ${OPENCLAW_ENV}"
  fi
fi

# ── Step 5: Restart gateway ───────────────────────────────────────────────────

header "Step 5 — Starting gateway"

if openclaw gateway status 2>/dev/null | grep -q "running\|active"; then
  log "Restarting gateway to load plugins..."
  openclaw gateway restart 2>/dev/null || \
    warn "Could not auto-restart — run: openclaw gateway restart"
else
  log "Starting gateway..."
  openclaw gateway start 2>/dev/null || \
    warn "Could not start gateway — run: openclaw gateway start"
fi

sleep 3

# ── Done ──────────────────────────────────────────────────────────────────────

printf "\n${BOLD}${GREEN}✓ All done!${NC}\n\n"
printf "  Chat with Brace:  ${BOLD}http://localhost:18789${NC}\n"
printf "  Run prompts at:   ${BOLD}https://promptroot.io${NC}\n"
printf "\n"
printf "Optional add-ons:\n"
printf "  Mobile access:  add a Telegram bot token to ~/.openclaw/.env\n"
printf "  Web UI:         see docs/OPENCLAW_SETUP.md\n"
printf "\n"
