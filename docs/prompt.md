# Promptroot VS Code Extension — Gameplan

## 1. Single Source of Truth (Context Anchor)

### Project Purpose & Domain Context
- **Goal:** Build a VS Code extension for Promptroot that streamlines the core Promptroot workflows directly inside the editor.
- **Primary audience:** Developers and contributors who use Promptroot and want tighter in-editor workflows.
- **Outcomes:** Reduce context switching, make Promptroot assets and tasks discoverable, and provide guided workflows consistent with Promptroot’s product philosophy.

### Coding Style & Conventions
- Use idiomatic TypeScript and the VS Code Extension API.
- Prefer small, composable modules with clear responsibilities.
- Favor explicit types over `any`.
- Keep command IDs, configuration keys, and view IDs centrally defined and documented.
- Align linting, formatting, and test config with repo-wide standards.
- Reference `code_style_guide.md` as the source of truth for formatting and code conventions (create or locate before implementation).

### UI / UX Guidelines
- Follow VS Code UX patterns (commands, views, quick picks, tree views, notifications).
- Keep flows minimal and non-blocking.
- Use clear, concise labels and descriptions.
- Prefer progressive disclosure over large modal dialogs.
- Ensure accessibility (keyboard-first, readable labels, avoid color-only signals).
- Reference `ui_guidelines.md` for detailed UI/UX standards (create or locate before implementation).

### Architectural Constraints
- Extension should run entirely within VS Code’s extension host.
- Use only officially supported VS Code APIs.
- Minimize dependencies; prefer built-in Node/VSC APIs.
- Ensure operations are cancelable when possible.
- Avoid hard-coded paths; use workspace-relative URIs.
- Follow `security.md` for security requirements, threat models, and data handling policies (create or locate before implementation).

### Prior Decisions & Assumptions
- The extension will be phased and validated per milestone.
- A single Markdown document (this file) is the authoritative plan.
- Implementation must follow the phased roadmap with verification gates.
- Jules API integration is a key milestone and must be explicitly planned and verified.

---

## 2. Desired Behavior & Constraints

### Primary User Flows (Happy Paths)
1. **Initialize Promptroot Workspace**
   - User runs a command to initialize or validate Promptroot configuration.
2. **Browse Promptroot Assets**
   - User opens a tree view to browse prompts, templates, or other assets.
3. **Run Core Promptroot Actions**
   - User triggers commands (e.g., run a prompt, open docs, or create a new asset).

### Important Edge Cases (High-Level)
- No workspace folder open.
- Workspace does not match expected Promptroot structure.
- Missing configuration or corrupted metadata.
- User cancels a long-running action.
- Conflicts between multiple workspace folders.

### Technical Constraints & Non-Goals
- **Constraints:**
  - Must remain compatible with supported VS Code versions in repo policy.
  - Must not require external services for core functionality.
- **Non-Goals:**
  - No custom editor/webview unless strictly necessary.
  - No advanced telemetry or analytics in MVP.
  - No automated modification of user code without explicit confirmation.

### Success Criteria (Behavioral)
- Core commands are discoverable via Command Palette.
- Primary flows complete without errors and with clear feedback.
- Edge cases provide actionable, user-friendly messaging.

---

## 3. Phased Roadmap (Verification Required Per Phase)

### Phase 1 — Foundation & Scaffolding ✅ COMPLETED
**Tasks**
- ✅ Define extension manifest (package.json) with base metadata.
- ✅ Scaffold activation events and a basic command.
- ✅ Set up lint/test scripts aligned with repo standards.
- ✅ Document initial extension architecture.

**Acceptance Criteria**
- ✅ Extension activates and command runs without errors.
- ✅ Command logs a clear message to output channel.
- ✅ Basic lint/test scripts are runnable.

**Completion Conditions**
- ✅ Verified activation + command in a local VS Code session
- ✅ Tests/lint executed with no errors

**Implementation Notes:**
- Created complete extension structure in `vscode-extension/` directory
- Implemented three commands: initialize, openDocs, browseAssets
- All commands log to dedicated output channel
- TypeScript compilation successful with strict mode
- ESLint passes with zero errors/warnings
- Created comprehensive documentation:
  - README.md (user-facing)
  - ARCHITECTURE.md (technical design)
  - ISSUES.md (issue tracking)
  - PHASE_1_VERIFICATION.md (verification guide)
- VS Code launch configuration ready for F5 debugging

**Verification Results (February 5, 2026):**
- ✅ Extension activates without errors in Extension Development Host
- ✅ All 3 commands registered and executable via Command Palette
- ✅ Output channel "Promptroot" logs all activity correctly
- ✅ Configuration settings appear in VS Code settings UI
- ✅ Tree view placeholder registered in Explorer sidebar
- ✅ All acceptance criteria met
- ✅ Ready to proceed to Phase 2

---

### Phase 2 — Core UI Surface (Commands + View)
**Tasks**
- Add primary commands (init, open docs, browse assets).
- Add a Tree View for Promptroot assets.
- Define centralized constants for command/view IDs.

**Acceptance Criteria**
- Commands appear in Command Palette.
- Tree View renders a placeholder or sample nodes.
- UI strings are clear and consistent.

**Completion Conditions**
- Manual walkthrough of command flows.
- Tree view loads without errors in VS Code.

---

### Phase 3 — Promptroot Integration (Read-Only)
**Tasks**
- Detect Promptroot workspace structure.
- Read prompt assets from disk and populate the view.
- Add basic validation and helpful errors.

**Acceptance Criteria**
- Tree view displays real Promptroot assets.
- Invalid workspaces show clear error messages.
- Actions are cancelable where applicable.

**Completion Conditions**
- Verified on a valid workspace.
- Verified error handling on an invalid workspace.

---

### Phase 4 — Jules API Integration (Read-Only)
**Tasks**
- Define the Jules API surface required for the extension (endpoints, auth, data model).
- Implement a read-only integration (e.g., fetch metadata or run a safe query).
- Add configuration for Jules API base URL and credentials in VS Code settings.
- Add clear error handling for network/auth failures.

**Acceptance Criteria**
- Extension can connect to Jules API using configured settings.
- Successful responses are displayed in a user-friendly way.
- Failures surface actionable guidance (e.g., missing credentials, network error).

**Completion Conditions**
- Verified connection on a valid Jules API environment.
- Verified failure handling with invalid credentials or unreachable endpoint.

---

### Phase 5 — Authoring & Actions (Write Operations)
**Tasks**
- Add command to create new prompt assets.
- Add basic templates with user input.
- Confirm before writing files.

**Acceptance Criteria**
- New assets appear in tree view after creation.
- User confirmation is required before writing.
- Failures show clear error info.

**Completion Conditions**
- Manual creation of a new asset.
- Validation of file output and tree refresh.

---

### Phase 6 — Quality & Release Readiness
**Tasks**
- Add unit tests for key logic.
- Add e2e tests for core flows.
- Update README/docs with usage instructions.
- Package extension for local install.

**Acceptance Criteria**
- Tests pass or failures are documented.
- Documentation is complete and accurate.
- Extension can be installed locally.

**Completion Conditions**
- Test run results recorded.
- Verified install and activation.

---

## 4. Execution Rules (How Work Proceeds)

1. **Execute One Phase at a Time**
   - Only the current phase is implemented.
   - No speculative features outside the phase.

2. **Intentional Logging**
   - Log key checkpoints and decisions in the phase implementation notes.

3. **Verification Gate**
   - Each phase must pass acceptance criteria and completion conditions before progressing.

4. **Roadmap Maintenance**
   - Update this document to reflect completed tasks and any scope adjustments.

---

## 5. Verification Checklist (Per Phase)

- Run unit tests and/or lint scripts.
- Manually walk the primary flows for the phase.
- Watch logs/console output for anomalies.
- Record any failures or warnings.

---

## 6. Issue Capture

- All issues must be recorded in a dedicated Markdown file: `promptroot-vscode-issues.md`.
- Each issue should include:
  - Title
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details
  - Logs or screenshots if applicable

---

## 7. Notes & Open Questions

- Confirm preferred minimum VS Code version.
- Identify canonical Promptroot asset directories.
- Confirm desired command list for MVP.
