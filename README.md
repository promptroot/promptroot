# PromptRoot

Share and amplify your team's AI knowledge.
Write specs first. Ship faster with AI. Hosted for free with GitHub Pages.

## Live site

[https://promptroot.github.io/promptroot/](https://promptroot.github.io/promptroot/)

## What is PromptRoot?

PromptRoot is a platform for teams that use AI to build software. It's built around two ideas that work together:

**A shared prompt library** — store your team's best prompts as plain markdown files in a GitHub repo. Browse them, search them, send them to AI tools with one click, and build on each other's work instead of starting from scratch every time.

**Spec Driven Development** — write a design spec before you code. PromptRoot's **wikis** page stores those specs across all your apps in one searchable, versioned library. AI agents can pull spec context before starting work, so output stays aligned with your actual design intent instead of hallucinating architecture.

### Key Features

*   **Prompt Library**: Your team's reusable AI prompts, stored as markdown files in a GitHub repo. Browse with a folder tree, search by name, deep-link to any prompt, and send directly to Jules or other AI tools. Variable substitution (`{PLACEHOLDER}`) turns prompts into templates your whole team can fill in and reuse.
*   **Spec Driven Development**: Write design specs (SDDs) before coding. The [Wikis page](/pages/wiki/wiki.html) stores, versions, and cross-links specs across all your projects. Agents can query specs via MCP or the RAG API for grounded, design-aware output.
*   **Variable Substitution**: Create reusable prompt templates with `{PLACEHOLDER}` variables that are filled via modal UI before sending to Jules.
*   **Jules Integration**: Send prompts directly to Google's Jules AI coding agent.
*   **Task Queue**: Queue up multiple subtasks for Jules to execute sequentially.
*   **Session Management**: View and manage your active and past Jules sessions.
*   **Web Capture**: A browser extension that lets you capture any webpage as Markdown and sync it directly to your GitHub repository. See [browser-extension/README.md](browser-extension/README.md) for details.

## Spec Driven Development

Spec Driven Development (SDD) is a workflow where you write a design document *before* writing code or prompting an AI. The spec becomes the source of truth — for humans reviewing a PR and for AI agents executing tasks.

### How it works

1. **Write a spec** — Use the [Wikis page](/pages/wiki/wiki.html) to create a Software Design Document for a feature, bug fix, or architectural decision. Specs have structured frontmatter (status, owner, tags) and free-form markdown body.
2. **Reference it** — Link specs to each other. The graph view shows how designs relate across projects.
3. **Ground your agents** — Before starting a Jules task or a Claude Code session, pull in spec context. The MCP server and RAG API let any agent query specs by keyword so AI output stays aligned with your design.
4. **Track history** — Every spec is versioned. The history view shows what changed and when, so design decisions are never lost.

### The Wikis page

The [wikis page](/pages/wiki/wiki.html) is a multi-tenant SDD library — one PromptRoot instance hosts specs for *any number of apps*. Each app registers as a **tenant** and gets its own spec collection. Browse with the tree view, search by keyword, or explore relationships with the graph view.

**Tenant support** means your team can manage specs for your whole portfolio in one place, with per-tenant visibility controls (public or members-only).

### Agent integrations

| Integration | How to use |
|---|---|
| **MCP server** | `@promptroot/mcp-server` — read + write specs from any MCP-speaking agent (Claude Code, Cursor, etc.) |
| **RAG API** | `ragQuery` Cloud Function — BM25 keyword search, tenant-scoped, for any HTTP client |
| **Claude Code skill** | `.claude/skills/search-dev-history/` — read-only search built into this repo's Claude Code sessions |

See `AGENTS.md` for the full agent contract and tenant resolution order.

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

## Architecture

This is a zero-build, modular single-page application using plain JavaScript ES6 modules.

### Key Design Principles

* **No Build Step**: Files served directly from GitHub Pages
* **No Framework**: Plain JavaScript with ES6 modules
* **Modular**: Each feature is isolated in its own module
* **Zero Dependencies**: Only CDN-loaded libraries (marked.js, Firebase)
* **Fast**: Caching, lazy loading, and optimized rendering

### CSS Structure

- Aggregator: See [src/styles.css](src/styles.css) for ordered imports.
- Base: [src/styles/base.css](src/styles/base.css) defines variables and resets.
- Layout: [src/styles/layout.css](src/styles/layout.css) contains grid and responsive rules.
- Components: Modular styles in [src/styles/components/](src/styles/components/) (header, navbar, sidebar, buttons, status bar, etc.).
- Pages: Per-page overrides in [src/styles/pages/](src/styles/pages/).

Guidelines:
- Keep base/layout first, components next, pages last in the aggregator.
- Add new components under `src/styles/components/` and import them in `src/styles.css`.
- Use page styles sparingly for view-specific tweaks.

### Folder structure

```
promptroot/
├── index.html             # Home page (root)
├── vitest.config.js       # Vitest test configuration
├── package.json           # npm dependencies & scripts
├── pages/                 # Routed pages
│   ├── jules/jules.html   # Jules account management & sessions
│   ├── queue/queue.html   # Jules task queue management
│   ├── sessions/sessions.html # Full list of Jules sessions
│   ├── profile/profile.html   # User profile & settings
│   └── webcapture/webcapture.html # Web Capture extension
├── partials/
│   └── header.html        # Shared header partial (loaded on all pages)
├── src/firebase-init.js   # Firebase SDK initialization (src)
├── firebase.json          # Firebase hosting config
├── config/
│   └── firestore/firestore.rules # Firestore security rules
├── .github/
│   └── workflows/
│       └── test.yml       # GitHub Actions CI workflow for tests
├── oauth-callback.html    # GitHub OAuth callback for extension
├── src/
│   ├── app.js             # Main application initialization
│   ├── shared-init.js     # Shared initialization for all pages
│   ├── styles.css         # Aggregated stylesheet importing modular CSS
│   ├── modules/           # Feature modules (ES6)
│   │   ├── auth.js        # GitHub OAuth & auth state management
│   │   ├── jules-modal.js # Main Jules modal UI
│   │   ├── jules-queue.js # Queue system for batch processing
│   │   ├── jules-subtask-modal.js # Subtask splitting UI
│   │   ├── jules-account.js # Account management
│   │   ├── jules-keys.js  # API key storage
│   │   ├── jules-api.js   # Jules API client (sources, sessions, activities)
│   │   ├── jules-free-input.js # Free input handling
│   │   ├── github-api.js  # GitHub API calls & Gist handling
│   │   ├── prompt-list.js # Sidebar tree navigation & rendering
│   │   ├── prompt-renderer.js # Markdown rendering & display
│   │   ├── branch-selector.js # Branch listing & switching
│   │   ├── subtask-manager.js # Prompt splitting & parsing
│   │   ├── header.js      # Shared header component
│   │   ├── navbar.js      # Shared navigation component
│   │   ├── sidebar.js     # Sidebar component
│   │   ├── status-bar.js  # Status notifications
│   │   ├── toast.js       # Toast notifications
│   │   └── ... (+ other UI components)
│   ├── tests/             # Automated tests (Vitest)
│   │   ├── setup.js       # Global test configuration
│   │   ├── integration/   # Integration tests for modules
│   │   │   ├── auth.test.js
│   │   │   ├── toast.test.js
│   │   │   ├── jules-submission.test.js
│   │   │   └── prompt-loading.test.js
│   │   └── utils/         # Unit tests for utilities
│   │       ├── dom-helpers.test.js
│   │       ├── slug.test.js
│   │       ├── title.test.js
│   │       └── validation.test.js
│   └── utils/             # Shared utilities
│       ├── constants.js   # Config, regex patterns, storage keys
│       ├── slug.js        # URL-safe slug generation
│       ├── url-params.js  # URL parameter parsing
│       ├── dom-helpers.js # DOM manipulation helpers
│       ├── session-cache.js # Session data caching
│       ├── title.js       # Title extraction from prompts
│       ├── checkbox-helpers.js # Checkbox utilities
│       ├── icon-helpers.js # Icon utilities
│       └── validation.js  # Input validation
├── prompts/               # Markdown prompt files
│   └── tutorial/         # PromptRoot onboarding + templates
├── webclips/             # User web clips from browser extension
│   └── {username}/       # Each user's synced clips
├── browser-extension/    # Web capture browser extension
│   ├── manifest.json     # Extension configuration
│   ├── content.js        # Page content extraction
│   ├── popup.html        # Extension UI
│   ├── popup.js          # Extension logic
│   ├── popup.css         # Extension styles
│   ├── config.js         # OAuth configuration
│   ├── github-auth.js    # GitHub OAuth flow
│   ├── github-sync.js    # GitHub sync logic
│   └── background.js     # Service worker
└── functions/            # Firebase Cloud Functions
  ├── index.js          # Jules backend + GitHub OAuth proxy
  └── package.json
```

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

### Using a Gist pointer

Instead of storing the full prompt in this repo, you can point a prompt file at a GitHub Gist. Create a markdown file whose entire body is the raw Gist URL:

```markdown
https://gist.githubusercontent.com/your-username/abc123456789/raw/my-shared-prompt.md
```

The app will fetch and cache the Gist content automatically.

**Limitations:**
* Must be a publicly readable `gist.githubusercontent.com` raw link
* Only one URL per file
* Updates to the Gist appear on next fetch

### ChatGPT/Codex Links

If a prompt file contains only a ChatGPT conversation URL (e.g., `https://chatgpt.com/s/...`), the app detects it and provides a clickable link to open the conversation.

## Linking to prompts

Every prompt has its own URL:

```
https://promptroot.github.io/promptroot/#p=<filename-without-.md>
```

Example:

* File: `prompts/stubs.md`
* Link: [https://promptroot.github.io/promptroot/#p=stubs](https://promptroot.github.io/promptroot/#p=stubs)

These links can be shared in Discord, Whatsapp, docs, etc.

## Features

### Core Features

* **Prompt Library Browser**: Navigate prompts organized in folders with a collapsible tree view
* **Markdown Rendering**: Full markdown support with headings, lists, code blocks, and more
* **Deep Linking**: Every prompt has a shareable URL (`#p=slug`)
* **Branch Switching**: Switch between git branches to view different versions of your prompt library
* **Search**: Filter prompts by filename in real-time
* **One-Click Copy**: Copy prompt text to clipboard with a single click
* **Gist Integration**: Reference GitHub Gists as external prompt sources
* **ChatGPT/Codex Links**: Automatically detect and link to ChatGPT conversation URLs
* **Emoji Tags**: Automatic visual categorization based on filename keywords

### GitHub Authentication

* **GitHub OAuth**: Sign in with your GitHub account via Firebase
* **Persistent Sessions**: Stay logged in across browser sessions
* **User Profile**: Access your Jules profile and settings

### Jules API Integration

PromptRoot provides deep integration with Google's Jules AI assistant:

#### Try in Jules
* **One-Click Sending**: Send any prompt directly to Jules with the "⚡ Try in Jules" button
* **Repository Context**: Select which GitHub repository Jules should use
* **Branch Selection**: Choose specific branches for Jules to access
* **Custom Titles**: Name your Jules sessions for easy identification
* **Auto-Open**: Automatically open Jules sessions in new tabs

#### Jules Queue System
* **Batch Processing**: Queue multiple prompts to send to Jules
* **Queue Management**: View, edit, and delete queued items
* **Status Tracking**: Monitor pending, processing, and completed items
* **Auto-Open Control**: Choose whether to automatically open Jules tabs

#### Subtask Splitting
* **Intelligent Parsing**: Automatically detect task stubs, numbered lists, or paragraph breaks
* **Manual Splitting**: Define custom `---split---` markers in prompts
* **Preview & Edit**: Review and modify detected subtasks before sending
* **Sequential Execution**: Send subtasks to Jules one at a time or all at once
* **Context Preservation**: Each subtask includes the full prompt context

#### Variable Substitution

Create reusable prompt templates with placeholder variables:

* **Placeholder Syntax**: Use `{VARIABLE_NAME}` in your prompts (uppercase, alphanumeric, underscore, hyphen)
* **Interactive Modal**: When clicking "Try in Jules", a form appears to fill in variable values
* **Multiple Variables**: Support for multiple placeholders in a single prompt
* **Validation**: Required field validation ensures all variables are filled before sending
* **XSS Protection**: All user input is automatically sanitized to prevent security issues

**Example:**

```markdown
Fix the bug in `{FILE_PATH}` on line `{LINE_NUMBER}`.

Investigate the function `{FUNCTION_NAME}` and check if it 
handles the `{INPUT_TYPE}` input correctly.
```

When you click "Try in Jules", you'll be prompted to enter values for:
- FILE_PATH
- LINE_NUMBER  
- FUNCTION_NAME
- INPUT_TYPE

The substituted text is then sent to Jules with your actual values.

**Benefits:**
- Create generic, reusable prompts for common tasks
- Share prompt templates across your team
- Reduce copy-paste errors with structured input forms
- Maintain prompt libraries that adapt to different projects

#### User Profile Page

Click your username after signing in to access:

* **API Key Management**: 
  - Securely store your Jules API key (encrypted in Firestore)
  - Update or delete your stored key
  - Keys are encrypted using AES-GCM with your user ID
* **Connected Repositories**: 
  - View all GitHub repos connected via Jules GitHub App
  - See available branches for each repository
  - Refresh to sync latest connections
* **Recent Sessions**: 
  - Last 10 Jules sessions with titles and status
  - Direct links to Jules sessions and pull requests
  - Status indicators (active, completed, errored)
  - "View All →" to see complete session history
* **Full Sessions History Modal**:
  - Browse all your Jules sessions
  - Search by conversation title or session ID
  - Paginated loading (50 sessions at a time)
  - Session cards with timestamps and links

### Repository Management

* **Multi-Repository Support**: Browse prompts from any GitHub repository
* **URL Parameters**: Share links with custom owner/repo/branch
* **Cache Management**: Automatic caching with session storage
* **Real-Time Updates**: Changes appear 1-2 minutes after pushing to GitHub

## Browser Extension - Web Capture

PromptRoot includes a powerful browser extension that captures any webpage as Markdown and syncs it to GitHub.

### Features

* **📸 One-Click Capture**: Save any webpage as clean Markdown
* **☁️ GitHub Sync**: Automatically commit clips to this repository
* **🔐 OAuth Login**: Secure GitHub authentication (no PAT needed)
* **💾 Local Download**: Option to save locally without GitHub
* **👥 Multi-User**: Each user gets their own folder in `webclips/`

### Quick Start

1. **Install Extension**: Load `browser-extension` folder in Chrome (`chrome://extensions/`)
2. **Connect GitHub**: Click "🔗 Connect to GitHub" in extension popup
3. **Clip Pages**: Click extension icon, then "☁️ Sync to GitHub"
4. **View Clips**: Find them at `webclips/{your-username}/`

See [browser-extension/README.md](browser-extension/README.md) for full documentation.

### For Administrators

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for setup instructions and [QUICKSTART.md](QUICKSTART.md) for user guide.

## Getting Started with Jules

1. **Sign in**: Click "Sign in with GitHub" in the header
2. **Add API Key**: Click your username → "Add Jules API Key"
   - Get your key from [jules.google.com](https://jules.google.com) → Settings → API Keys
   - Your key is encrypted and stored securely
3. **Browse Prompts**: Navigate the prompt library and find a useful prompt
4. **Send to Jules**: Click "⚡ Try in Jules" on any prompt
5. **Configure**: Select repository and branch for context
6. **Track Sessions**: View your Jules activity in your profile

## Emoji Classification

The app automatically adds emojis to filenames for visual categorization:

* **🔍** - Code review, PR, rubric
* **🩹** - Bug fixes, triage
* **📖** - Documentation, specs, design, explorers
* **🧹** - Refactoring

These are purely cosmetic and based on keywords in the filename.

## Notes

* Repository must remain public for GitHub Pages and API access
* Changes appear live 1–2 minutes after pushing to `main`
* No in-browser editing; manage prompts via git or GitHub web interface
* Browser caching may require hard refresh (Ctrl+Shift+R) after updates
* Firebase configuration required for authentication features
* Jules integration requires valid Jules API key from [jules.google.com](https://jules.google.com)

## Use Cases

- **Spec Driven Development**: Write design specs before coding so AI agents have grounded context and humans have a reviewable audit trail
- **Multi-App Spec Library**: Store and cross-link design docs for your entire portfolio in one searchable, versioned library
- **Team Onboarding**: Repository explorer prompts and specs help new contributors understand codebases and past decisions
- **Prompt Library**: Centralized collection of reusable AI prompts shared across your team
- **Jules Workflow**: Streamline sending prompts to Jules with proper repository and spec context
- **Knowledge Sharing**: Capture effective prompts and design decisions before they're forgotten

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

## Development Guide

### Running locally

```bash
cd promptroot
npm start
# Visit http://localhost:3000/
```

Routing notes:
- Root `/` serves `index.html` (home page)
- All other pages use `/pages/{pagename}/{pagename}.html` structure

The dev setup loads modules directly without compilation. Changes are reflected immediately (reload browser).

### Testing

Run automated tests:

```bash
npm test              # Watch mode - reruns on file save
npm run test:run      # Run once
npm run test:coverage # Generate coverage report
```

Tests are organized by type:
- `src/tests/utils/` - Unit tests for pure functions
- `src/tests/integration/` - Integration tests for modules with mocks

Coverage reports are generated in `coverage/` directory. Open `coverage/index.html` to view detailed coverage.

### Pre-commit Hooks

We recommend setting up pre-commit hooks to ensure code quality.

1. Install `husky` and `lint-staged`:
   ```bash
   npm install --save-dev husky lint-staged
   ```
2. Initialize husky:
   ```bash
   npx husky init
   ```
3. Add a hook to run tests before commit:
   ```bash
   echo "npm run test:run" > .husky/pre-commit
   ```

### Project organization

Each module in `src/modules/` handles one major feature area:

- **auth.js**: Firebase authentication, GitHub OAuth flow, user state management
- **Jules Integration Modules**: Complete Jules integration split across specialized modules:
  - **jules-modal.js**: Main "Try in Jules" modal UI and workflow
  - **jules-queue.js**: Queue system for batch processing
  - **jules-subtask-modal.js**: Subtask splitting and management UI
  - **jules-account.js**: User account management
  - **jules-keys.js**: API key encryption and secure storage
  - **jules-free-input.js**: Free input handling
- **jules-api.js**: Jules API client wrapper:
  - List connected sources (repositories)
  - Retrieve sessions with filtering and pagination
  - Fetch activity logs
  - Handle API authentication
- **github-api.js**: GitHub API interactions:
  - Fetch repository contents and file trees
  - Load raw markdown files
  - Resolve and fetch GitHub Gists
  - List repository branches
- **prompt-list.js**: Sidebar prompt browser:
  - Tree-based folder navigation
  - Collapsible folders with state persistence
  - Search/filter functionality
  - Active item highlighting
- **prompt-renderer.js**: Content display:
  - Markdown rendering with marked.js
  - Code syntax highlighting
  - Copy to clipboard functionality
  - Deep linking support
- **branch-selector.js**: Branch management:
  - List available branches
  - Switch between branches
  - User/feature branch filtering
- **subtask-manager.js**: Prompt parsing and splitting:
  - Detect task stubs, numbered lists, manual splits
  - Analyze prompt structure
  - Build subtask sequences with context
  - Validate subtask integrity
- **status-bar.js**: User notifications and status messages

Utilities in `src/utils/` provide shared helpers:

- **constants.js**: All configuration, magic strings, regex patterns, emoji mappings, storage keys
- **slug.js**: Generate URL-safe slugs from filenames
- **url-params.js**: Parse URL query strings and hash parameters
- **dom-helpers.js**: Reusable DOM manipulation functions
- **title.js**: Extract titles from markdown content

### Firestore Data Model

The application stores user-specific data in Cloud Firestore:

- **users/{uid}**: User profile and preferences
  - `favoriteRepos`: Array of favorite repository objects `[{id, name, branch}]`
  - `favoriteBranches`: Array of favorite branch names (user-specific; "main" and "web-captures" are hardcoded)
- **apiKeys/{uid}**: Encrypted Jules API keys (AES-GCM)
- **julesQueues/{uid}/items**: User's queued Jules tasks

### Code style

- ES6 modules with explicit imports/exports
- No transpilation or build step required
- Plain JavaScript (no frameworks or libraries except CDN-loaded dependencies)
- Modular architecture with clear separation of concerns
- Async/await for asynchronous operations
- SessionStorage for caching and state persistence
- Firestore for secure data storage (API keys, queue items)

## Technology Stack

- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Markdown**: marked.js (CDN)
- **Authentication**: Firebase Authentication (GitHub OAuth)
- **Database**: Cloud Firestore
- **Backend**: Firebase Cloud Functions (Node.js)
- **Hosting**: GitHub Pages
- **APIs**: GitHub REST API, Jules API (Google)

## Security

- **API Key Encryption**: Jules API keys encrypted using AES-GCM before storage
- **Firestore Rules**: Strict security rules ensuring users can only access their own data
- **GitHub OAuth**: Secure authentication flow via Firebase
- **HTTPS Only**: All API calls and hosting over HTTPS

