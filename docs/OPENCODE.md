# PromptRoot × OpenCode Integration Guide

This guide explains how to connect and run your PromptRoot prompt assets inside the OpenCode coding agent via the PromptRoot web application and the VS Code extension.

---

## 1. Overview

**OpenCode** is a terminal-native, provider-agnostic autonomous coding agent. PromptRoot integrates with OpenCode in two primary ways:

1. **Direct API Dispatch (Web App)**: Connect PromptRoot directly to a locally running `opencode serve` instance to execute prompts as chat completions without copy-pasting.
2. **Terminal Session Runner (VS Code Extension)**: Right-click any prompt asset in VS Code to spawn a terminal executing OpenCode loaded with the prompt.
3. **Copen Custom Protocol**: Choose "OpenCode" as your Copen application target to copy prompt text and trigger the `opencode://` scheme on your machine.

---

## 2. Web Application Setup

To dispatch prompts to a local OpenCode agent from the browser-based PromptRoot single-page application:

### Step 1: Start OpenCode Headless Server with CORS
By default, browser security (CORS) blocks web requests to local loopbacks. You must tell OpenCode to allow requests from PromptRoot by starting the server with CORS origins:

```bash
opencode serve --cors http://localhost:3000 --cors https://promptroot.ai
```
*(If you run PromptRoot on a different local port or domain, adjust the CORS flags accordingly).*

### Step 2: Configure Connection in PromptRoot
1. Open PromptRoot and go to the **OpenCode** settings page (accessible via the main navigation).
2. Click **Configure**.
3. Set your server endpoint (default is `http://localhost:4096`).
4. If you have Basic Auth enabled via `OPENCODE_SERVER_PASSWORD`, enter the password/token in the credentials field (this will be encrypted client-side using PBKDF2/AES-GCM prior to storage).
5. Click **Save**.

### Step 3: Run Prompts
Select any prompt file in the Prompt Browser, open the **Run in Agent** dropdown, select **OpenCode**, and click the button to execute it.

---

## 3. VS Code Extension Setup

The PromptRoot VS Code extension lets you run prompts directly using your local CLI terminal:

1. Open a workspace containing a `prompts/` directory.
2. Browse your prompts in the **Promptroot Assets** sidebar view.
3. Right-click any prompt file and select **Send to OpenCode**.
4. The extension will automatically open/focus a VS Code terminal named `OpenCode` and run:
   ```bash
   opencode run --file "/path/to/prompt.md"
   ```

### Settings
You can customize terminal execution via VS Code settings:
* `promptroot.opencode.executablePath`: Path to the `opencode` binary (default: `opencode`).
* `promptroot.opencode.defaultFlags`: Extra flags to append (e.g. `--auto` to auto-approve actions, `-m gpt-4o`, etc.).

---

## 4. Troubleshooting

* **CORS Error in Console**: If the prompt dispatch fails immediately, check the browser developer console. If you see a CORS error, confirm you started `opencode serve` with the correct `--cors` flags.
* **TUI Not Spawning**: If the VS Code terminal shows `opencode: command not found`, configure the full path to your `opencode` binary in the VS Code setting `promptroot.opencode.executablePath`.
