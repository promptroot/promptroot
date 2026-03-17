# PromptRoot

Share and amplify your team's AI knowledge — and execute it with your AI agent.
Hosted for free with GitHub Pages, backed by simple `.md` files.

## Live site

[https://promptroot.github.io/promptroot/](https://promptroot.github.io/promptroot/)

## What is PromptRoot?

PromptRoot is a zero-build web application for managing and sharing AI prompts as markdown files. It provides a browsable library interface with deep linking, GitHub integration, and direct integration with Google's Jules AI assistant and OpenClaw AI agents. Teams can organize prompts in folders, switch between branches, and send prompts directly to Jules or their own persistent AI agent.

### Key Features

*   **Prompt Library**: Browse and share prompts organized in a GitHub repository.
*   **Variable Substitution**: Create reusable prompt templates with `{PLACEHOLDER}` variables that are filled via modal UI before sending to Jules or Bliz.
*   **Jules Integration**: Send prompts directly to Google's Jules AI coding agent.
*   **🦞 OpenClaw Integration**: Send prompts to your own persistent OpenClaw AI agent via "Run in Bliz". Get results streamed back into the UI.
*   **Task Queue**: Queue up multiple subtasks for Jules or OpenClaw to execute sequentially.
*   **Session Management**: View and manage your active and past sessions across Jules and OpenClaw.
*   **Web Capture**: A browser extension that captures any webpage as Markdown and syncs it directly to your GitHub repository — with optional AI summarization via OpenClaw.

---

## OpenClaw Integration

PromptRoot integrates with [OpenClaw](https://openclaw.ai) — a persistent, self-hosted AI assistant — to bring your prompt library to life beyond the browser.

### What you can do

- **🦞 Run in Bliz**: Send any prompt directly to your OpenClaw agent from the PromptRoot UI, just like "Try in Jules". Variable substitution is preserved.
- **Prompt Library for your agent**: Your OpenClaw agent can fetch and execute any prompt by slug. No more copy-pasting.
- **SDD workflow**: OpenClaw pulls PromptRoot's versioned SDD templates, fills them interactively, and saves them locally — with optional PR back to your prompt library.
- **Web Clip summarization**: New captures from the browser extension are automatically summarized by your agent and delivered via Telegram/Signal/etc.
- **Agent-generated prompts**: Prompts that prove useful during agent sessions get automatically drafted as PRs back to your PromptRoot library.
- **Queue execution**: Tag queue items `[bliz]` and your OpenClaw agent picks them up and executes them as background tasks.

### Setup

1. **Install OpenClaw**: See [openclaw.ai](https://openclaw.ai) for setup.
2. **Install the PromptRoot skill** in your OpenClaw workspace:
   ```bash
   npx clawhub@latest install promptroot
   ```
3. **Add your gateway token** to PromptRoot settings (Settings → OpenClaw → Gateway Token).
4. **Click "🦞 Run in Bliz"** on any prompt.

> **Note:** The "Run in Bliz" button requires your OpenClaw gateway to be reachable from your browser. For local setups, this works out of the box. For remote access, use Tailscale or expose your gateway via a reverse proxy.

---

## Local development

To test the app locally, you must serve it over HTTP (not open the HTML file directly):

```bash
# From the repo root
npm start
# Or manually: python -m http.server 3000
```

Then open **`http://localhost:3000/`** in your browser.

**Important:** Opening `index.html` directly (via `file://` URL) will not work with Firebase authentication. The app must be served over HTTP for GitHub OAuth to function.

## Docker Development

For a more complete development environment with Firebase emulators, use Docker Compose:

```bash
docker-compose up --build
```

This provides:
- Local Firebase emulators (Firestore, Functions, Storage)
- Full emulator UI at http://localhost:4000
- App served at http://localhost:5000

See [docs/DOCKER.md](docs/DOCKER.md) for complete setup instructions.

## Adding a new prompt

1. Create a new file inside the `prompts/` folder.

   * Use lowercase filenames with no spaces. Example: `my-new-prompt.md`.
   * File must end with `.md`.

2. Start the file with a first-level heading (`#`) for the title:

   ```markdown
   # My New Prompt

   Prompt instructions go here...
   ```

3. Commit the file to the `main` branch:

   * Either upload directly through the GitHub web UI, or
   * Use git locally:

     ```bash
     git add prompts/my-new-prompt.md
     git commit -m "Add my-new-prompt.md"
     git push
     ```

4. After a minute or two, the live site will auto-refresh to include your new prompt.

## Linking to prompts

Every prompt has its own URL:

```
https://promptroot.github.io/promptroot/#p=<filename-without-.md>
```

Example:

* File: `prompts/stubs.md`
* Link: [https://promptroot.github.io/promptroot/#p=stubs](https://promptroot.github.io/promptroot/#p=stubs)

## Architecture

This is a zero-build, modular single-page application using plain JavaScript ES6 modules.

### Key Design Principles

* **No Build Step**: Files served directly from GitHub Pages
* **No Framework**: Plain JavaScript with ES6 modules
* **Modular**: Each feature is isolated in its own module
* **Zero Dependencies**: Only CDN-loaded libraries (marked.js, Firebase)
* **Fast**: Caching, lazy loading, and optimized rendering

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Markdown**: marked.js (CDN)
- **Authentication**: Firebase Authentication (GitHub OAuth)
- **Database**: Cloud Firestore
- **Backend**: Firebase Cloud Functions (Node.js)
- **Hosting**: GitHub Pages
- **APIs**: GitHub REST API, Jules API (Google), OpenClaw Gateway API

## Security

- **API Key Encryption**: Jules API keys encrypted using AES-GCM before storage
- **Firestore Rules**: Strict security rules ensuring users can only access their own data
- **GitHub OAuth**: Secure authentication flow via Firebase
- **OpenClaw Auth**: Gateway token stored in user settings, never committed to source
- **HTTPS Only**: All API calls and hosting over HTTPS

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test locally with `python -m http.server 8888`
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0-only). See [LICENSE](LICENSE).

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
