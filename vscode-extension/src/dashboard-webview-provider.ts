import * as vscode from 'vscode';
import { AuthManager } from './auth-manager';
import { COMMANDS } from './constants';

export class DashboardWebviewProvider implements vscode.WebviewViewProvider {
	private view: vscode.WebviewView | undefined;
	private messageDisposable: vscode.Disposable | undefined;

	constructor(
		private readonly authManager: AuthManager
	) {}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this.view = webviewView;
		this.messageDisposable?.dispose();
		webviewView.webview.options = {
			enableScripts: true
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);
		this.wireMessages(webviewView);
	}

	public refresh(): void {
		if (!this.view) {
			return;
		}
		this.view.webview.html = this.getHtml(this.view.webview);
	}

	private wireMessages(webviewView: vscode.WebviewView): void {
		this.messageDisposable = webviewView.webview.onDidReceiveMessage(async (message: { command?: string }) => {
			switch (message.command) {
				case 'openDocs':
					await vscode.commands.executeCommand(COMMANDS.openDocs);
					break;
				case 'signIn':
					await vscode.commands.executeCommand(COMMANDS.signIn);
					break;
				case 'signOut':
					await vscode.commands.executeCommand(COMMANDS.signOut);
					break;
				case 'focusQueue':
					await vscode.commands.executeCommand('workbench.view.extension.promptroot');
					await vscode.commands.executeCommand('promptroot.queueView.focus');
					break;
				default:
					break;
			}
		});
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = this.getNonce();
		const isSignedIn = this.authManager.isSignedIn();

		const authBadge = isSignedIn
			? '<span class="badge badge--success">&#x25CF; Signed in</span>'
			: '<span class="badge badge--muted">&#x25CB; Not signed in</span>';

		const authButton = isSignedIn
			? '<button class="btn btn--ghost" data-command="signOut">Sign out</button>'
			: '<button class="btn btn--accent" data-command="signIn">Sign in with GitHub</button>';

		const queueButton = isSignedIn
			? '<button class="btn btn--ghost" data-command="focusQueue">Open Jules Queue</button>'
			: '';

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Promptroot</title>
	<style>
		*, *::before, *::after { box-sizing: border-box; }

		:root {
			--bg:              #0a0e1a;
			--surface:         #141829;
			--surface-raised:  #1a1f35;
			--border:          #222438;
			--text:            #f0f3f8;
			--text-muted:      #8b94a8;
			--accent:          #4dd9ff;
			--accent-hover:    #5ad1ff;
			--accent-glow:     rgba(77, 217, 255, 0.12);
			--accent-strong:   rgba(77, 217, 255, 0.15);
			--accent-subtle:   rgba(77, 217, 255, 0.05);
			--success:         #4ade80;
		}

		html, body {
			margin: 0;
			padding: 0;
			background: linear-gradient(180deg, #0d1424 0%, #0a0e1a 100%);
			color: var(--text);
			font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
			font-size: 13px;
			min-height: 100vh;
		}

		.shell {
			padding: 14px 12px;
			display: flex;
			flex-direction: column;
			gap: 10px;
		}

		/* ── Brand header ─────────────────────────── */
		.brand {
			display: flex;
			align-items: center;
			gap: 8px;
			padding-bottom: 10px;
			border-bottom: 1px solid var(--border);
		}

		.brand__logo {
			width: 28px;
			height: 28px;
			border-radius: 7px;
			background: linear-gradient(135deg, var(--accent-strong), var(--accent-subtle));
			border: 1px solid rgba(77, 217, 255, 0.3);
			display: flex;
			align-items: center;
			justify-content: center;
			flex-shrink: 0;
			font-size: 14px;
			font-weight: 700;
			color: var(--accent);
			letter-spacing: -0.5px;
		}

		.brand__name {
			font-size: 14px;
			font-weight: 600;
			color: var(--text);
			letter-spacing: 0.2px;
		}

		.brand__badge-wrap {
			margin-left: auto;
		}

		/* ── Status badge ─────────────────────────── */
		.badge {
			display: inline-flex;
			align-items: center;
			gap: 4px;
			font-size: 11px;
			padding: 2px 8px;
			border-radius: 20px;
			font-weight: 500;
			letter-spacing: 0.2px;
		}

		.badge--success {
			background: rgba(74, 222, 128, 0.1);
			border: 1px solid rgba(74, 222, 128, 0.25);
			color: var(--success);
		}

		.badge--muted {
			background: rgba(139, 148, 168, 0.08);
			border: 1px solid rgba(139, 148, 168, 0.2);
			color: var(--text-muted);
		}

		/* ── Card ─────────────────────────────────── */
		.card {
			background: linear-gradient(135deg, rgba(20,24,41,0.6), rgba(20,24,41,0.3));
			border: 1px solid var(--border);
			border-radius: 12px;
			padding: 12px 14px;
			backdrop-filter: blur(8px);
		}

		.card__title {
			font-size: 12px;
			font-weight: 600;
			text-transform: uppercase;
			letter-spacing: 0.6px;
			color: var(--text-muted);
			margin: 0 0 8px;
		}

		.card__body {
			font-size: 12px;
			color: var(--text-muted);
			line-height: 1.5;
			margin: 0;
		}

		/* ── Action stack ─────────────────────────── */
		.actions {
			display: flex;
			flex-direction: column;
			gap: 7px;
		}

		/* ── Buttons ──────────────────────────────── */
		.btn {
			appearance: none;
			display: block;
			width: 100%;
			padding: 8px 12px;
			font-size: 12px;
			font-family: inherit;
			font-weight: 500;
			border-radius: 9px;
			cursor: pointer;
			transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.1s;
			text-align: left;
		}

		.btn:active { transform: translateY(1px); }

		.btn--accent {
			background: linear-gradient(135deg, var(--accent-strong), var(--accent-subtle));
			border: 1px solid rgba(77, 217, 255, 0.35);
			color: var(--accent);
		}

		.btn--accent:hover {
			background: linear-gradient(135deg, rgba(77, 217, 255, 0.22), rgba(77, 217, 255, 0.08));
			border-color: var(--accent);
			box-shadow: 0 0 12px var(--accent-glow);
		}

		.btn--ghost {
			background: linear-gradient(135deg, rgba(20,24,41,0.5), rgba(20,24,41,0.3));
			border: 1px solid var(--border);
			color: var(--text);
		}

		.btn--ghost:hover {
			border-color: var(--accent);
			background: linear-gradient(135deg, var(--accent-strong), var(--accent-subtle));
			box-shadow: 0 0 10px var(--accent-glow);
			color: var(--accent);
		}

		/* ── Divider ──────────────────────────────── */
		.divider {
			height: 1px;
			background: var(--border);
			margin: 2px 0;
		}
	</style>
</head>
<body>
	<div class="shell">
		<div class="brand">
			<div class="brand__logo">PR</div>
			<span class="brand__name">Promptroot</span>
			<div class="brand__badge-wrap">${authBadge}</div>
		</div>

		<div class="card">
			<p class="card__title">Status</p>
			<p class="card__body">${isSignedIn
				? 'You are signed in. Use the views below to manage your Jules queue, sessions, and repositories.'
				: 'Sign in with GitHub to access your Jules queue, session analytics, and repository browser.'
			}</p>
		</div>

		<div class="actions">
			${authButton}
			<div class="divider"></div>
			<button class="btn btn--ghost" data-command="openDocs">Open promptroot.ai</button>
			${queueButton}
		</div>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.querySelectorAll('[data-command]').forEach((el) => {
			el.addEventListener('click', () => {
				vscode.postMessage({ command: el.getAttribute('data-command') });
			});
		});
	</script>
</body>
</html>`;
	}

	private getNonce(): string {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
		let value = '';
		for (let i = 0; i < 24; i++) {
			value += chars.charAt(Math.floor(Math.random() * chars.length));
		}
		return value;
	}
}
