# @promptroot/mcp-server

MCP server that exposes the [PromptRoot](https://promptroot.ai) dev-history wiki to coding agents (Claude Code, Cursor, Continue, Cline, etc.). Lets agents search prior SDDs, create new ones, update existing ones, and view version history — without leaving the editor.

## Install

```sh
npm install -g @promptroot/mcp-server
```

## Authenticate (one-time)

```sh
promptroot-mcp-login
# Opens a browser to https://promptroot.ai/auth/device with a one-time code.
# Enter the code, click Authorize.
# Token written to ~/.config/promptroot/credentials.json (chmod 600).
```

Authentication uses the same GitHub OAuth identity as the PromptRoot web app — no PATs. Revoke from the PromptRoot profile page or by signing out of the web app.

## Register with Claude Code

```sh
claude mcp add promptroot npx @promptroot/mcp-server
```

For Cursor, Continue, Cline, etc., consult their MCP configuration docs and point at the `promptroot-mcp-server` binary.

## Tenant resolution

Each repo maps to a tenant. The server resolves tenant in this order:

1. Tool argument `tenantId` (explicit).
2. `.promptroot-tenant` file at repo root (single line, the tenant slug).
3. `git remote get-url origin` matched against `tenants[].githubRepo` in your account.

If none resolve, write tools error and ask you to run `npx promptroot-tenant-init`.

## Tools exposed

| Tool | Purpose |
|------|---------|
| `promptroot_search_sdds` | BM25 search; replaces the standalone Claude Code skill once installed. |
| `promptroot_list_sdds` | List SDDs in a tenant. |
| `promptroot_get_sdd` | Fetch one SDD's body and frontmatter, optionally pinned to a version. |
| `promptroot_create_sdd` | Create a new SDD. |
| `promptroot_update_sdd` | Update an existing SDD; writes a new version. |
| `promptroot_list_versions` | List version history. |
| `promptroot_restore_version` | Roll back to an earlier version (writes a new version, non-destructive). |

## Configuration via env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROMPTROOT_API_BASE` | `https://us-central1-promptroot-b02a2.cloudfunctions.net` | Override the Cloud Functions base URL (self-hosted deployments). |
| `PROMPTROOT_DEVICE_FLOW_URL` | `https://promptroot.ai/auth/device` | Override the user-facing device-auth URL. |
| `PROMPTROOT_CREDENTIALS_PATH` | `~/.config/promptroot/credentials.json` (or `%APPDATA%\promptroot\credentials.json` on Windows) | Override the credentials file path. |
| `PROMPTROOT_SESSION_TOKEN` | _(none)_ | Bypass the credentials file. Useful for CI. |

## License

AGPL-3.0-only.
