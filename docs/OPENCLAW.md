# PromptRoot × OpenClaw Setup

Connect a local AI assistant (Brace) to PromptRoot so you can run prompts, queue coding tasks, and chat via browser or mobile.

---

## Before you start

You need:

1. **An Anthropic API key** (or Claude.ai Pro/Max subscription)
   → [console.anthropic.com](https://console.anthropic.com)

2. **A PromptRoot account** (to generate your agent token)
   → [promptroot.io](https://promptroot.io) — sign in with GitHub

That's it. Everything else is handled automatically.

---

## Install

```bash
curl -sSL https://raw.githubusercontent.com/promptroot/promptroot/main/scripts/openclaw/install.sh | sh
```

The script will:
1. Install [OpenClaw](https://openclaw.ai) (the AI assistant runtime)
2. Configure your Anthropic credentials
3. Install the PromptRoot plugins
4. Ask for your agent token (from [promptroot.io/agent-api](https://promptroot.io/agent-api))
5. Start the gateway service

**Total time: ~3 minutes**

---

## After install

| What | Where |
|------|-------|
| Chat with Brace | http://localhost:18789 |
| Run prompts | https://promptroot.io |
| Agent token management | https://promptroot.io/agent-api |

---

## How it works

```
PromptRoot → "Run in Brace" button
    └── HTTPS → promptroot-relay.fly.dev
                    └── WebSocket → OpenClaw (your machine :18789)
                                        └── Claude API → response
```

Your OpenClaw instance connects to `promptroot-relay.fly.dev` on startup and stays connected. When you click "Run in Brace" on any prompt, it routes through the relay to your local instance.

---

## Optional: Web UI

For a full chat interface (like Jules), deploy the Brace Web UI:

### Fly.io (recommended)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Clone and deploy
git clone https://github.com/promptroot/promptroot
cd promptroot/brace-ui   # coming soon
fly deploy
```

### Docker (self-hosted)

```bash
docker run -d \
  --name brace-ui \
  -p 8080:8080 \
  -e OPENAI_API_BASE_URL=https://promptroot-relay.fly.dev/v1 \
  -e OPENAI_API_KEY=pra_<your-token> \
  -e WEBUI_SECRET_KEY=$(openssl rand -hex 32) \
  -e ENABLE_SIGNUP=false \
  ghcr.io/promptroot/brace-ui:latest
```

Then open http://localhost:8080.

---

## Optional: Mobile access (Telegram)

1. Create a bot via [@BotFather](https://t.me/BotFather) on Telegram
2. Add to `~/.openclaw/.env`:
   ```
   TELEGRAM_BOT_TOKEN=<your-bot-token>
   ```
3. Restart: `openclaw gateway restart`
4. Open your bot in Telegram and start chatting

---

## Troubleshooting

**Gateway won't start**
```bash
openclaw gateway status
openclaw gateway restart
```

**Relay not connecting**
- Check your token: `openclaw plugins inspect promptroot-relay`
- Verify token at [promptroot.io/agent-api](https://promptroot.io/agent-api)
- Check logs: `tail -f /tmp/openclaw/openclaw-$(date +%Y-%m-%d).log | grep relay`

**Auth errors**
```bash
openclaw configure   # re-run auth setup
```

**Plugin not loading**
```bash
openclaw plugins doctor
openclaw plugins enable promptroot-relay
openclaw plugins enable promptroot-gateway
```

---

## Uninstall

```bash
openclaw uninstall   # removes gateway service + local data (keeps CLI)
npm uninstall -g openclaw   # removes CLI
```
